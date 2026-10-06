import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SejarahBelanja from "./SejarahBelanja";

const mockQueryCollection = jest.fn();

jest.mock("../context/FirestoreContext", () => ({
  useFirestore: () => ({
    queryCollection: mockQueryCollection,
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
  }),
}));

jest.mock("../context/EnvironmentContext", () => ({
  useEnvironment: () => ({ isProduction: false, environment: "testing" }),
}));

// Fixed "today" noon, so every record lands on the same day group.
const at = (hour) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return { toDate: () => date, toMillis: () => date.getTime() };
};

const base = { itemId: "111", kategori: "ATK", subKategori: "-", unit: "pcs", createdBy: "admin@unipdu.ac.id" };

const TRANSACTIONS = [
  { ...base, id: "p1", itemName: "Kertas A4", transactionType: "pengadaan", transactionVia: "stockAddition", quantity: 10, cost: 100000, timestampInMillisEpoch: at(9) },
  { ...base, id: "d1", itemName: "Pulpen", transactionType: "pengurangan", transactionVia: "stockDeletion", quantity: 3, cost: 15000, timestampInMillisEpoch: at(10) },
  // Tetapkan Stok records, one saved with a large cost by an older version
  { ...base, id: "s1", itemName: "Stapler", transactionType: "pengadaan", transactionVia: "stockSetTo", quantity: 5, cost: 999000, timestampInMillisEpoch: at(11) },
  { ...base, id: "s2", itemName: "Penggaris", transactionType: "pengurangan", transactionVia: "stockSetTo", quantity: 2, cost: 0, timestampInMillisEpoch: at(12) },
];

const renderScreen = async () => {
  mockQueryCollection.mockImplementation(async (name) => {
    if (name === "stockTransactions") return TRANSACTIONS;
    return [];
  });
  render(<SejarahBelanja />);
  await screen.findByText(/1 pengadaan/);
};

describe("Sejarah Belanja and Tetapkan Stok corrections", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("counts corrections separately from purchases and reductions", async () => {
    await renderScreen();

    expect(screen.getByText("1 pengadaan, 1 pengurangan, 2 koreksi")).toBeInTheDocument();
  });

  test("the day total only has real purchases and losses in it", async () => {
    await renderScreen();

    // 100.000 purchase + 15.000 deletion; the 999.000 correction is not money
    expect(screen.getAllByText("Rp 115.000").length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent("999.000");
  });

  test("shows each correction as its own kind, with no amounts", async () => {
    await renderScreen();

    const corrections = screen.getAllByText("Koreksi Stok");
    expect(corrections).toHaveLength(2);
    corrections.forEach((badge) => {
      expect(badge).toHaveClass("sb-tx-badge", "correction");
      const tile = badge.closest(".sb-tx-tile");
      expect(within(tile).getByText("Koreksi Stok (Tetapkan)")).toBeInTheDocument();
      expect(within(tile).getByText("Total Nota").nextElementSibling).toHaveTextContent("-");
      expect(tile).not.toHaveTextContent("Rp");
    });
  });

  test("a real purchase and a real deletion keep their money and labels", async () => {
    await renderScreen();

    const purchase = screen.getByText("Pengadaan", { selector: ".sb-tx-badge" }).closest(".sb-tx-tile");
    expect(purchase).toHaveTextContent("Rp 100.000");
    expect(screen.getByText("Pengurangan", { selector: ".sb-tx-badge" }).closest(".sb-tx-tile")).toHaveTextContent("Rp 15.000");
  });

  test("the item list marks corrections and leaves their cost blank", async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Daftar Item" }));

    const stapler = (await screen.findByText("Stapler")).closest("tr");
    expect(within(stapler).getByText("Koreksi Stok")).toHaveClass("correction");
    expect(stapler).not.toHaveTextContent("Rp");
    expect(stapler).toHaveTextContent("-");

    const kertas = screen.getByText("Kertas A4").closest("tr");
    expect(within(kertas).getByText("Pengadaan")).toBeInTheDocument();
    expect(kertas).toHaveTextContent("Rp 100.000");
  });

  test("the monthly stats cards ignore corrections", async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Daftar Item" }));
    await waitFor(() => expect(screen.getByText("Stapler")).toBeInTheDocument());

    expect(document.body).not.toHaveTextContent("999.000");
  });
});
