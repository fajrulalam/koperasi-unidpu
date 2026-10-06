import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LaporanHarianModal from "./LaporanHarianModal";
import { cashflowService } from "../../services/cashflowService";

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ currentUser: { email: "kasir@unipdu.ac.id" } }),
}));

jest.mock("../../context/EnvironmentContext", () => ({
  useEnvironment: () => ({ isProduction: false }),
}));

jest.mock("../../services/cashflowService", () => ({
  cashflowService: {
    fetchTransactionsForDate: jest.fn(),
    fetchExpensesForDate: jest.fn(),
    fetchReport: jest.fn(),
    submitDailyReport: jest.fn(),
    fetchExpenseCategories: jest.fn(),
  },
}));

describe("LaporanHarianModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cashflowService.fetchTransactionsForDate.mockResolvedValue([
      { total: 150000, cashAmount: 150000, qrisAmount: 0 },
      { total: 60000, cashAmount: 0, qrisAmount: 60000 },
      { total: 40000, kreditAmount: 40000, cashAmount: 0, qrisAmount: 0 },
    ]);
    cashflowService.fetchExpensesForDate.mockResolvedValue([
      { id: "e1", category: "Es Batu", amount: 10000, sourceAccount: "cash", addedFrom: "pos" },
      { id: "e2", category: "Gaji", amount: 500000, sourceAccount: "cash", addedFrom: "finance" },
    ]);
    cashflowService.fetchReport.mockResolvedValue(null);
    cashflowService.submitDailyReport.mockResolvedValue(undefined);
  });

  test("a day document that only holds a Finance anchor is not treated as submitted", async () => {
    cashflowService.fetchReport.mockResolvedValue({
      date: "2026-10-06", anchorCash: 50000, anchoredBy: "admin@unipdu.ac.id",
    });
    render(<LaporanHarianModal isOpen onClose={jest.fn()} onSaved={jest.fn()} />);

    await screen.findByText("3 transaksi");
    expect(screen.queryByText(/sudah pernah disimpan/)).not.toBeInTheDocument();
  });

  test("a submitted report is still recognised", async () => {
    cashflowService.fetchReport.mockResolvedValue({
      date: "2026-10-06", submittedBy: "kasir@unipdu.ac.id", actualCash: 140000, actualQris: 60000,
    });
    render(<LaporanHarianModal isOpen onClose={jest.fn()} onSaved={jest.fn()} />);

    expect(await screen.findByText(/sudah pernah disimpan oleh kasir@unipdu.ac.id/)).toBeInTheDocument();
  });

  test("reconciles the count against sales minus drawer expenses", async () => {
    const onSaved = jest.fn();
    render(<LaporanHarianModal isOpen onClose={jest.fn()} onSaved={onSaved} />);

    await screen.findByText("3 transaksi");
    // System total is masked: 150.000 + 60.000 + 40.000
    expect(screen.getByText("Rp 2**.***")).toBeInTheDocument();
    // Back-office expenses from the Finance page are not drawer money.
    expect(screen.getByText("Es Batu")).toBeInTheDocument();
    expect(screen.queryByText("Gaji")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Uang Cash (Rp)"), {
      target: { value: "135000" },
    });
    fireEvent.change(screen.getByLabelText("Uang QRIS (Rp)"), {
      target: { value: "60000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rekap Harian" }));

    // Expected cash 140.000 stays masked while the shortfall is flagged.
    expect(screen.getByText(/Ada selisih/)).toBeInTheDocument();
    expect(screen.getByText(/Sistem: Rp 1\*\*\.\*\*\*/)).toBeInTheDocument();
    expect(screen.getByText(/Rp 60\.000 — Sesuai/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(cashflowService.submitDailyReport).toHaveBeenCalledWith(
      expect.objectContaining({
        sales: { cash: 150000, qris: 60000, kredit: 40000, total: 250000, count: 3 },
        expenses: { cash: 10000, qris: 0, kredit: 0 },
        actual: { cash: 135000, qris: 60000 },
        submittedBy: "kasir@unipdu.ac.id",
      }),
      false
    );
  });
});
