// Step 3: success toast only after server ack, or an honest "saved on device".
import { notifyWriteOutcome, LOCAL_SAVE_MESSAGE } from "./writeNotifier";

const makeToast = () => {
  const t = jest.fn();
  t.success = jest.fn();
  t.loading = jest.fn(() => "loading-id");
  t.dismiss = jest.fn();
  return t;
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("online + server acks quickly → normal success, no local message", async () => {
  const toast = makeToast(); const d = deferred();
  notifyWriteOutcome(d.promise, { successMessage: "تم", toast, isOnline: () => true });
  d.resolve(); await flush();
  expect(toast.success).toHaveBeenCalledWith("تم");
  expect(toast).not.toHaveBeenCalled();
});

test("offline → immediate 'saved on device', never a fake success later", async () => {
  const toast = makeToast(); const d = deferred();
  notifyWriteOutcome(d.promise, { successMessage: "تم", toast, isOnline: () => false });
  expect(toast).toHaveBeenCalledWith(LOCAL_SAVE_MESSAGE, expect.any(Object));
  d.resolve(); await flush();
  expect(toast.success).not.toHaveBeenCalled();
});

test("online but server slow → 'saved on device' after grace period", () => {
  const toast = makeToast(); const d = deferred();
  notifyWriteOutcome(d.promise, { successMessage: "تم", toast, isOnline: () => true, graceMs: 2500 });
  expect(toast).not.toHaveBeenCalled();
  jest.advanceTimersByTime(2600);
  expect(toast).toHaveBeenCalledWith(LOCAL_SAVE_MESSAGE, expect.any(Object));
});

test("rejected write → no success message at all", async () => {
  const toast = makeToast(); const d = deferred();
  notifyWriteOutcome(d.promise, { successMessage: "تم", toast, isOnline: () => true });
  d.reject(new Error("permission-denied")); await flush();
  expect(toast.success).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
});

test("requiresServer → loading until ack, never 'saved on device'", async () => {
  const toast = makeToast(); const d = deferred();
  notifyWriteOutcome(d.promise, { successMessage: "تم الحذف", requiresServer: true, toast, isOnline: () => false });
  expect(toast.loading).toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
  d.resolve(); await flush();
  expect(toast.success).toHaveBeenCalledWith("تم الحذف", { id: "loading-id" });
});

test("requiresServer rejected → loading dismissed, no success", async () => {
  const toast = makeToast(); const d = deferred();
  notifyWriteOutcome(d.promise, { successMessage: "تم الحذف", requiresServer: true, toast });
  d.reject(new Error("unavailable")); await flush();
  expect(toast.dismiss).toHaveBeenCalledWith("loading-id");
  expect(toast.success).not.toHaveBeenCalled();
});

test("no successMessage → does nothing", () => {
  const toast = makeToast();
  notifyWriteOutcome(Promise.resolve(), { toast, isOnline: () => false });
  expect(toast).not.toHaveBeenCalled();
});
