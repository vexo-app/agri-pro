// Step 4 — UI primitives: financial formatting (not colour-only), Modal Esc,
// ConfirmDialog safe default focus. Uses react-dom directly (no extra deps).
import React, { act } from "react";
import { createRoot } from "react-dom/client";

import {
  formatCurrency, formatNumber, formatProfit, formatNetPosition, formatDeduction,
} from "../../utils/formatters";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";

// raw react-dom (no Testing Library installed) → act() is required here.
/* eslint-disable testing-library/no-unnecessary-act */
window.IS_REACT_ACT_ENVIRONMENT = true;

const nf = (v, o) => new Intl.NumberFormat("ar-EG", o).format(v);

describe("financial formatting", () => {
  test("currency shows piasters only when present", () => {
    expect(formatCurrency(1000)).toBe(`${nf(1000, { maximumFractionDigits: 0 })} ج.م`);
    expect(formatCurrency(832.5)).toBe(`${nf(832.5, { maximumFractionDigits: 2 })} ج.م`);
    expect(formatCurrency(110.00000000000001)).toBe(formatCurrency(110));
    expect(formatNumber(1.1)).toBe(nf(1.1, { maximumFractionDigits: 2 }));
    expect(formatNumber(2.345, 1)).toBe(nf(2.3, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  });
  test("profit/loss is explicit in text, not colour only", () => {
    expect(formatProfit(500)).toBe(`▲ ${formatCurrency(500)}`);
    expect(formatProfit(-500)).toBe(`▼ خسارة ${formatCurrency(500)}`);
    expect(formatProfit(0)).toBe(formatCurrency(0));
    expect(formatNetPosition(300)).toBe(`ليك ${formatCurrency(300)}`);
    expect(formatNetPosition(-300)).toBe(`عليك ${formatCurrency(300)}`);
    expect(formatDeduction(120)).toBe(`− ${formatCurrency(120)}`);
    expect(formatDeduction(0)).toBe(formatCurrency(0));
  });
});

describe("dialogs", () => {
  let container, root;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  test("Modal closes on Escape", () => {
    const onClose = jest.fn();
    act(() => root.render(<Modal open onClose={onClose} title="t"><p>x</p></Modal>));
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("ConfirmDialog focuses Cancel by default; confirm runs onConfirm", () => {
    const onConfirm = jest.fn(); const onClose = jest.fn();
    act(() => root.render(<ConfirmDialog open onClose={onClose} onConfirm={onConfirm} message="m" />));
    const buttons = [...document.body.querySelectorAll('[role="dialog"] button')];
    const cancel = buttons.find((b) => b.textContent.includes("إلغاء"));
    const confirm = buttons.find((b) => b.textContent.includes("تأكيد"));
    expect(document.activeElement).toBe(cancel);
    act(() => confirm.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
