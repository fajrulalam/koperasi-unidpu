import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Finance from "./Finance";
import { cashflowService } from "../services/cashflowService";
import { getLocalDateKey, getMonthKey } from "../utils/cashflowUtils";

let mockRole = "Director";

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ currentUser: { email: "kasir@unipdu.ac.id" }, userRole: mockRole }),
}));

jest.mock("../context/EnvironmentContext", () => ({
  useEnvironment: () => ({ isProduction: false }),
}));

jest.mock("../services/cashflowPdfService", () => ({
  generateCashflowPdf: jest.fn(),
}));

jest.mock("../services/cashflowService", () => ({
  cashflowService: {
    fetchMonthData: jest.fn(),
    hasPendingLegacyMigration: jest.fn(),
    fetchExpenseCategories: jest.fn(),
    updateExpense: jest.fn(),
  },
}));

const month = getMonthKey(getLocalDateKey());

const monthData = {
  opening: { cash: 1000000, qris: 0, kredit: 0, isOverride: true },
  reports: [
    {
      id: `${month}-01`,
      date: `${month}-01`,
      submittedBy: "kasir@unipdu.ac.id",
      systemSalesCash: 300000,
      systemSalesQris: 120000,
      systemSalesKredit: 45000,
      discrepancyCash: -2000,
      discrepancyQris: 0,
      discrepancyKredit: 0,
    },
  ],
  expenses: [
    {
      id: "e1",
      date: `${month}-01`,
      category: "Token Listrik",
      amount: 50000,
      sourceAccount: "cash",
      addedFrom: "pos",
    },
  ],
  transfers: [],
  sales: [
    { date: `${month}-01`, cash: 300000, qris: 120000, kredit: 45000, total: 465000, count: 12 },
  ],
};

const renderFinance = async () => {
  render(<Finance />);
  await screen.findByText("Token Listrik");
};

describe("Finance cashflow statement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = "Director";
    cashflowService.fetchMonthData.mockResolvedValue(monthData);
    cashflowService.hasPendingLegacyMigration.mockResolvedValue(false);
    cashflowService.fetchExpenseCategories.mockResolvedValue(["Token Listrik"]);
  });

  test("shows each account's running balance", async () => {
    await renderFinance();

    const closingRow = screen.getByText("Saldo Akhir").closest("tr");
    // cash 1.000.000 + 300.000 - 2.000 - 50.000, qris 120.000, kredit 45.000
    expect(within(closingRow).getByText("1.248.000")).toBeInTheDocument();
    expect(within(closingRow).getByText("120.000")).toBeInTheDocument();
    expect(within(closingRow).getByText("45.000")).toBeInTheDocument();
    expect(screen.getByText("Rp 45.000")).toBeInTheDocument();
  });

  test("filters the ledger to one account", async () => {
    await renderFinance();

    fireEvent.click(screen.getByRole("button", { name: /Kredit/ }));

    expect(screen.queryByText("Token Listrik")).not.toBeInTheDocument();
    expect(screen.queryByText("Selisih")).not.toBeInTheDocument();
    expect(screen.getByText("Penjualan")).toBeInTheDocument();
  });

  test("lets managers edit an expense", async () => {
    await renderFinance();

    fireEvent.click(screen.getByText("Token Listrik"));

    expect(screen.getByText("Ubah Pengeluaran")).toBeInTheDocument();
    expect(screen.getByDisplayValue("50.000")).toBeInTheDocument();
  });

  test("gives admins the manager controls", async () => {
    mockRole = "Admin";
    await renderFinance();

    expect(screen.getAllByRole("button", { name: /Tambah pengeluaran/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Mutasi saldo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anchor saldo/ })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Token Listrik"));
    expect(screen.getByText("Ubah Pengeluaran")).toBeInTheDocument();
  });

  test("lets admins set the opening balance", async () => {
    mockRole = "Admin";
    await renderFinance();

    fireEvent.click(screen.getByTitle("Ubah saldo awal"));

    expect(screen.getByText("Ubah Saldo Awal")).toBeInTheDocument();
  });

  test("uses the full width of the page instead of a centered column", async () => {
    await renderFinance();

    const container = document.querySelector(".finance-container");
    expect(container.className).not.toMatch(/\bmax-w-/);
    expect(container.className).not.toMatch(/\bmx-auto\b/);
  });

  describe("days without a Laporan Harian", () => {
    const qrisOnly = {
      opening: { cash: 0, qris: 0, kredit: 0, isOverride: false },
      reports: [],
      expenses: [],
      transfers: [],
      sales: [{ date: `${month}-06`, cash: 0, qris: 40000, kredit: 0, total: 40000, count: 1 }],
    };

    test("shows a Sales row from the POS as soon as a sale is made", async () => {
      cashflowService.fetchMonthData.mockResolvedValue(qrisOnly);
      render(<Finance />);

      const sales = (await screen.findByText("Penjualan")).closest("tr");
      expect(sales).toHaveTextContent("40.000");
      expect(screen.queryByText("Selisih")).not.toBeInTheDocument();
      expect(screen.getByText("Saldo Akhir").closest("tr")).toHaveTextContent("40.000");
      expect(screen.queryByText(/Belum ada penjualan/)).not.toBeInTheDocument();
    });

    test("the Sales row says where its numbers come from", async () => {
      cashflowService.fetchMonthData.mockResolvedValue(qrisOnly);
      render(<Finance />);

      fireEvent.mouseEnter((await screen.findByText("Penjualan")).parentElement);

      expect(screen.getByText("1 transaksi tercatat di POS")).toBeInTheDocument();
      expect(screen.getByText("Laporan Harian belum dikirim")).toBeInTheDocument();
    });

    test("such a day can still be anchored", async () => {
      cashflowService.fetchMonthData.mockResolvedValue(qrisOnly);
      render(<Finance />);
      await screen.findByText("Penjualan");

      expect(screen.getByText(/Anchor saldo/)).toBeInTheDocument();
    });

    test("an empty month says there are no sales or expenses yet", async () => {
      cashflowService.fetchMonthData.mockResolvedValue({ ...qrisOnly, sales: [] });
      render(<Finance />);

      expect(await screen.findByText("Belum ada penjualan atau pengeluaran untuk bulan ini.")).toBeInTheDocument();
      expect(screen.queryByText(/Anchor saldo/)).not.toBeInTheDocument();
    });
  });

  test("a submitted Laporan Harian is named on the Sales row", async () => {
    await renderFinance();

    fireEvent.mouseEnter(screen.getByText("Penjualan").parentElement);

    expect(screen.getByText("12 transaksi tercatat di POS")).toBeInTheDocument();
    expect(screen.getByText("Laporan Harian dikirim oleh kasir@unipdu.ac.id")).toBeInTheDocument();
  });

  test("keeps the ledger read-only for cashiers", async () => {
    mockRole = "Cashier";
    await renderFinance();

    expect(screen.queryByText(/Tambah pengeluaran/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Anchor saldo/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Token Listrik"));
    expect(screen.queryByText("Ubah Pengeluaran")).not.toBeInTheDocument();
  });
});
