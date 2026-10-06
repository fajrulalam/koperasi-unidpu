import React from "react";
import { render, screen } from "@testing-library/react";
import Stocks from "./Stocks";

const mockQueryCollection = jest.fn();

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ currentUser: { email: "admin@unipdu.ac.id" }, userRole: "Admin" }),
}));

jest.mock("../context/FirestoreContext", () => ({
  useFirestore: () => ({
    createDoc: jest.fn(),
    readDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    queryCollection: mockQueryCollection,
    query: jest.fn(),
    where: jest.fn(),
  }),
}));

jest.mock("../context/EnvironmentContext", () => ({
  useEnvironment: () => ({ isProduction: false, environment: "testing" }),
}));

// Export libraries aren't under test and jsdom has no canvas for them.
jest.mock("jspdf", () => ({ jsPDF: jest.fn() }));
jest.mock("jspdf-autotable", () => ({}));
jest.mock("xlsx", () => ({}));

jest.mock("../firebase", () => ({
  db: {},
  uploadFile: jest.fn(),
  getEnvironmentCollection: jest.fn(),
  getEnvironmentDoc: jest.fn(),
}));

const day = () => {
  const date = new Date();
  return { toDate: () => date, toMillis: () => date.getTime() };
};

describe("Stocks summary cards", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    mockQueryCollection.mockImplementation(async (name) => {
      if (name === "stockTransactions") {
        return [
          { transactionType: "pengadaan", transactionVia: "bulkPurchase", cost: 120000, timestampInMillisEpoch: day() },
          // Cost-bearing loss and an old Tetapkan record: neither may show as a card any more
          { transactionType: "pengurangan", transactionVia: "stockDeletion", cost: 45000, timestampInMillisEpoch: day() },
        ];
      }
      if (name === "stocks") {
        return [{ id: "p1", name: "Kertas A4", stock: 10, stockValue: 5000, base_unit: "pcs", satuan: ["pcs"] }];
      }
      return [];
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("shows only Belanja Bulan Ini and Total Nilai Stok", async () => {
    render(<Stocks />);

    expect(await screen.findByText("Belanja Bulan Ini")).toBeInTheDocument();
    expect(screen.getByText("Total Nilai Stok")).toBeInTheDocument();
    expect(screen.queryByText("Stock Hilang")).not.toBeInTheDocument();
  });

  test("the two remaining cards share the row", async () => {
    render(<Stocks />);

    const card = (await screen.findByText("Belanja Bulan Ini")).closest(".grid");
    expect(card).toHaveClass("md:grid-cols-2");
    expect(card).not.toHaveClass("md:grid-cols-3");
    expect(card.children).toHaveLength(2);
  });

  test("does not show lost stock as money anywhere on the cards", async () => {
    render(<Stocks />);
    await screen.findByText("Belanja Bulan Ini");

    expect(document.body).not.toHaveTextContent("45.000");
  });
});
