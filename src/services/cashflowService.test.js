import { addDoc, getDoc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { getEnvironmentCollection } from "../firebase";
import { cashflowService } from "./cashflowService";

jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  arrayUnion: jest.fn(),
  deleteDoc: jest.fn(),
  deleteField: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(),
}));

jest.mock("../firebase", () => ({
  db: {},
  getEnvironmentCollection: jest.fn(),
  getEnvironmentDoc: jest.fn(),
}));

describe("cashflowService.addExpense", () => {
  beforeEach(() => {
    serverTimestamp.mockReturnValue("SERVER_TIMESTAMP");
    getEnvironmentCollection.mockImplementation((name) => ({ path: name }));
    getDocs.mockResolvedValue({ docs: [], empty: true });
    getDoc.mockResolvedValue({ exists: () => false });
    // Every ledger change re-stores the month's closing in one batch.
    writeBatch.mockReturnValue({ update: jest.fn(), set: jest.fn(), commit: jest.fn().mockResolvedValue() });
  });

  const expense = {
    amount: 150000,
    category: "Pembelian Grosir - Toko Maju",
    sourceAccount: "kredit",
    dateKey: "2026-10-06",
    addedFrom: "bulkPurchase",
    createdBy: "admin@unipdu.ac.id",
  };

  test("stores a Pembelian Grosir expense with its purchase link and source account", async () => {
    await cashflowService.addExpense({ ...expense, bulkPurchaseId: "BP-20261006-001" }, false);

    expect(getEnvironmentCollection).toHaveBeenCalledWith("expenses", false);
    expect(addDoc).toHaveBeenCalledWith(
      { path: "expenses" },
      {
        amount: 150000,
        category: "Pembelian Grosir - Toko Maju",
        sourceAccount: "kredit",
        date: "2026-10-06",
        month: "2026-10",
        addedFrom: "bulkPurchase",
        createdBy: "admin@unipdu.ac.id",
        bulkPurchaseId: "BP-20261006-001",
        createdAt: "SERVER_TIMESTAMP",
      }
    );
  });

  test("leaves the purchase link out for ordinary expenses", async () => {
    await cashflowService.addExpense(
      { ...expense, sourceAccount: "cash", addedFrom: "pos" },
      false
    );

    const [, written] = addDoc.mock.calls[0];
    expect(written).not.toHaveProperty("bulkPurchaseId");
    expect(Object.values(written)).not.toContain(undefined);
  });
});
