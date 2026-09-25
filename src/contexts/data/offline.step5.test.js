// Step 5 — OFFLINE behaviour of the real mutation hooks (Firestore mocked):
// create/edit offline are applied locally at once and tracked, deletes that
// need the server are refused before touching the screen, a crashed
// "job + first payment" is recovered exactly once, and repeated submits of
// the same payment id never duplicate.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import toast from "react-hot-toast";
import { useJobsMutations } from "./mutations/jobsMutations";
import { useSupplierMutations } from "./mutations/supplierMutations";
import { usePendingPaymentsRecovery } from "./usePendingPaymentsRecovery";
import { reducer, initialState } from "./reducer";
import { savePendingJobPayment, getPendingJobPayments } from "../../utils/pendingJobPayments";
import { getJobPaidAmount } from "../../utils/calculations";
import { jobService } from "../../services/jobService";
import { paymentService } from "../../services/paymentService";
import { deleteParentWithChildren } from "../../services/cascadeDeleteService";

// an offline Firestore write: queued locally, never acknowledged
const pending = () => new Promise(() => {});

jest.mock("react-hot-toast", () => {
  const t = jest.fn(); t.success = jest.fn(); t.error = jest.fn(); t.loading = jest.fn(); t.dismiss = jest.fn();
  return { __esModule: true, default: t };
});
jest.mock("../../services/jobService", () => ({
  jobService: { add: jest.fn(() => ({ id: "job-new", promise: new Promise(() => {}) })), update: jest.fn(() => new Promise(() => {})) },
}));
jest.mock("../../services/paymentService", () => ({
  paymentService: {
    add: jest.fn((uid, d, presetId) => ({ id: presetId || "pay-new", promise: new Promise(() => {}) })),
    update: jest.fn(() => new Promise(() => {})), remove: jest.fn(() => new Promise(() => {})),
  },
}));
jest.mock("../../services/supplierInvoiceService", () => ({ supplierInvoiceService: {} }));
jest.mock("../../services/supplierPaymentService", () => ({
  supplierPaymentService: { add: jest.fn(() => ({ id: "sp-new", promise: new Promise(() => {}) })) },
}));
jest.mock("../../config/firebase", () => ({ db: "test-db" }));
jest.mock("../../services/cascadeDeleteService", () => {
  const actual = jest.requireActual("../../services/cascadeDeleteService");
  return { ...actual, deleteParentWithChildren: jest.fn(() => new Promise(() => {})), releaseDeleteLock: jest.fn(() => new Promise(() => {})) };
});
jest.mock("firebase/firestore", () => ({ doc: jest.fn(), writeBatch: jest.fn(), serverTimestamp: jest.fn() }));

// eslint-disable-next-line testing-library/no-unnecessary-act
window.IS_REACT_ACT_ENVIRONMENT = true;
const setOnline = (v) => Object.defineProperty(window.navigator, "onLine", { value: v, configurable: true });

const mount = (useHook, args) => {
  const out = {};
  const Probe = () => { Object.assign(out, useHook(args)); return null; };
  const el = document.createElement("div");
  const root = createRoot(el);
  // eslint-disable-next-line testing-library/no-unnecessary-act
  act(() => root.render(<Probe />));
  return { out, unmount: () => act(() => root.unmount()) };
};

let state; let dispatch; let trackWrite; let stateRef;
beforeEach(() => {
  // CRA resets mock implementations before each test — set them here.
  jobService.add.mockImplementation(() => ({ id: "job-new", promise: pending() }));
  jobService.update.mockImplementation(() => pending());
  paymentService.add.mockImplementation((uid, d, presetId) => ({ id: presetId || "pay-new", promise: pending() }));
  deleteParentWithChildren.mockImplementation(() => pending());
  localStorage.clear();
  state = { ...initialState, jobs: [{ id: "j1", acres: 10, pricePerAcre: 100 }, { id: "jl", acres: 1, pricePerAcre: 1, deleting: true }],
    supplierInvoices: [{ id: "i1", amount: 100 }], payments: [], supplierPayments: [] };
  stateRef = { current: state };
  dispatch = jest.fn((a) => { state = reducer(state, a); stateRef.current = state; });
  trackWrite = jest.fn((p) => p);
});
afterAll(() => setOnline(true));

test("create offline: shows on screen immediately and is queued (tracked)", async () => {
  setOnline(false);
  const { out, unmount } = mount(useJobsMutations, { user: { uid: "u" }, dispatch, stateRef, trackWrite });
  await act(() => out.addJob({ acres: 2, pricePerAcre: 50 }));
  expect(state.jobs.some((j) => j.id === "job-new")).toBe(true);
  expect(trackWrite).toHaveBeenCalledWith(expect.any(Promise), expect.objectContaining({ successMessage: "تم تسجيل العملية" }));
  unmount();
});

test("edit offline: partial update applied locally, other fields kept", async () => {
  setOnline(false);
  const { out, unmount } = mount(useJobsMutations, { user: { uid: "u" }, dispatch, stateRef, trackWrite });
  await act(() => out.updateJob("j1", { acres: 12 }));
  expect(state.jobs.find((j) => j.id === "j1")).toEqual({ id: "j1", acres: 12, pricePerAcre: 100 });
  unmount();
});

test("delete offline is refused BEFORE touching the screen (job + supplier invoice)", async () => {
  setOnline(false);
  const a = mount(useJobsMutations, { user: { uid: "u" }, dispatch, stateRef, trackWrite });
  const b = mount(useSupplierMutations, { user: { uid: "u" }, dispatch, stateRef, trackWrite });
  let r1, r2;
  await act(async () => { r1 = await a.out.deleteJob("j1"); r2 = await b.out.deleteSupplierInvoice("i1"); });
  expect([r1, r2]).toEqual([false, false]);
  expect(dispatch).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledTimes(2);
  a.unmount(); b.unmount();
});

test("delete online: needs server confirmation (requiresServer)", async () => {
  setOnline(true);
  const { out, unmount } = mount(useJobsMutations, { user: { uid: "u" }, dispatch, stateRef, trackWrite });
  await act(() => out.deleteJob("j1"));
  expect(deleteParentWithChildren).toHaveBeenCalled();
  expect(trackWrite).toHaveBeenCalledWith(expect.any(Promise), expect.objectContaining({ requiresServer: true }));
  unmount();
});

test("payment on a locked (deleting) job is refused up front", async () => {
  setOnline(true);
  const { out, unmount } = mount(useJobsMutations, { user: { uid: "u" }, dispatch, stateRef, trackWrite });
  let r; await act(async () => { r = await out.addPayment({ jobId: "jl", amount: 5 }); });
  expect(r).toBeNull();
  expect(state.payments).toEqual([]);
  unmount();
});

test("duplicate submit with the same payment id never double-counts", async () => {
  setOnline(false);
  const { out, unmount } = mount(useJobsMutations, { user: { uid: "u" }, dispatch, stateRef, trackWrite });
  await act(async () => { await out.addPayment({ jobId: "j1", amount: 300 }, "fixed-id"); await out.addPayment({ jobId: "j1", amount: 300 }, "fixed-id"); });
  expect(state.payments).toHaveLength(1);
  expect(getJobPaidAmount(state.jobs[0], state.payments)).toBe(300);
  unmount();
});

test("close/reopen after a crash: pending first payment recovered exactly once", () => {
  setOnline(true);
  savePendingJobPayment("u", { paymentId: "pp1", jobId: "j1", amount: 250, date: "2026-09-01", notes: "x" });
  const args = { user: { uid: "u" }, loading: false, jobs: state.jobs, payments: [], dispatch, trackWrite };
  const first = mount(usePendingPaymentsRecovery, args);
  expect(state.payments.map((p) => p.id)).toEqual(["pp1"]);
  expect(getPendingJobPayments("u")).toEqual([]);
  first.unmount();
  // reopen again: intent already cleared → nothing added twice
  const again = mount(usePendingPaymentsRecovery, { ...args, payments: state.payments });
  expect(state.payments).toHaveLength(1);
  again.unmount();
});

test("recovery skips an intent whose payment already reached the server (no duplicate)", () => {
  savePendingJobPayment("u", { paymentId: "pp2", jobId: "j1", amount: 100, date: "2026-09-01" });
  const r = mount(usePendingPaymentsRecovery, { user: { uid: "u" }, loading: false, jobs: state.jobs,
    payments: [{ id: "pp2", jobId: "j1", amount: 100 }], dispatch, trackWrite });
  expect(dispatch).not.toHaveBeenCalled();
  expect(getPendingJobPayments("u")).toEqual([]);
  r.unmount();
});
