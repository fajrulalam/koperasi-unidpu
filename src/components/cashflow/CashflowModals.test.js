import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExpenseModal } from "./CashflowModals";

const baseExpense = {
  id: "e1",
  category: "Pembelian Grosir - Toko Maju",
  amount: 150000,
  date: "2026-10-06",
  sourceAccount: "kredit",
  createdBy: "admin@unipdu.ac.id",
};

const renderExpenseModal = (expense, onSave = jest.fn()) => {
  render(
    <ExpenseModal
      expense={expense}
      categories={[]}
      onSave={onSave}
      onDelete={jest.fn()}
      onClose={jest.fn()}
      loading={false}
    />
  );
  return { onSave };
};

describe("ExpenseModal source account", () => {
  test("keeps Kredit selectable for a Pembelian Grosir expense", () => {
    renderExpenseModal({ ...baseExpense, addedFrom: "bulkPurchase" });

    expect(screen.getByText("Dari Pembelian Grosir oleh admin@unipdu.ac.id")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cash" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "QRIS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kredit" })).toHaveClass("text-white");
  });

  test("lets a manager move a Pembelian Grosir expense to another account", () => {
    const { onSave } = renderExpenseModal({ ...baseExpense, addedFrom: "bulkPurchase" });

    fireEvent.click(screen.getByRole("button", { name: "Cash" }));
    fireEvent.click(screen.getByText("Simpan Perubahan"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAccount: "cash", amount: 150000 })
    );
  });

  test("keeps the account options side by side in the Finance dialogs", () => {
    renderExpenseModal({ ...baseExpense, addedFrom: "bulkPurchase" });

    const pills = screen.getByRole("button", { name: "Cash" }).parentElement;
    expect(pills).not.toHaveClass("flex-col");
  });

  test("still limits ordinary expenses to Cash and QRIS", () => {
    renderExpenseModal({ ...baseExpense, sourceAccount: "cash", addedFrom: "finance" });

    expect(screen.getByRole("button", { name: "Cash" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "QRIS" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kredit" })).not.toBeInTheDocument();
  });
});
