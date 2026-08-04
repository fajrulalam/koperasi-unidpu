import {
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { voucherService } from "./voucherService";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn((...args) => args),
  limit: jest.fn(),
  where: jest.fn((...args) => args),
  orderBy: jest.fn(),
  startAfter: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
}));

jest.mock("../firebase", () => ({
  db: { name: "test-db" },
  getEnvironmentCollection: jest.fn((name) => `${name}-collection`),
  getEnvironmentDoc: jest.fn((name, id) => `${name}/${id}`),
}));

describe("voucherService.commitTransactionWithVoucher", () => {
  const activeDate = new Date(Date.now() - 60_000);
  const expireDate = new Date(Date.now() + 60_000);
  const timestampSentinel = { serverTimestamp: true };

  beforeEach(() => {
    jest.clearAllMocks();
    serverTimestamp.mockReturnValue(timestampSentinel);
  });

  test("recovers NaN from transaction history and atomically stores the next debit", async () => {
    const liveVoucher = {
      value: 500000,
      isOneTimeUse: false,
      amountSpent: Number.NaN,
      isActive: true,
      isClaimed: false,
      activeDate,
      expireDate,
      voucherGroupId: "group-a",
    };
    const voucherSnapshot = {
      id: "voucher-a",
      exists: () => true,
      data: () => liveVoucher,
    };

    getDoc.mockResolvedValue(voucherSnapshot);
    getDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            voucherId: "voucher-a",
            voucherDiscount: 106500,
          }),
        },
      ],
    });

    const transactionApi = {
      get: jest
        .fn()
        .mockResolvedValueOnce(voucherSnapshot)
        .mockResolvedValueOnce({ exists: () => false }),
      update: jest.fn(),
      set: jest.fn(),
    };
    runTransaction.mockImplementation((database, callback) =>
      callback(transactionApi)
    );

    const result = await voucherService.commitTransactionWithVoucher({
      voucherId: "voucher-a",
      voucherDiscount: 200000,
      transactionId: "tx-a",
      transactionData: { total: 200000 },
    });

    expect(transactionApi.update.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        amountSpent: 306500,
        sisaSaldo: 193500,
        isClaimed: false,
        lastRedemptionTransactionId: "tx-a",
      })
    );
    expect(transactionApi.set.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        voucherId: "voucher-a",
        voucherGroupId: "group-a",
        voucherDiscount: 200000,
        voucherBalanceBefore: 393500,
        voucherBalanceAfter: 193500,
      })
    );
    expect(result.balanceAfter).toBe(193500);
  });

  test("rejects a stale checkout when the live voucher balance is insufficient", async () => {
    const liveVoucher = {
      value: 500000,
      isOneTimeUse: false,
      amountSpent: 490000,
      isActive: true,
      activeDate,
      expireDate,
    };
    const voucherSnapshot = {
      id: "voucher-a",
      exists: () => true,
      data: () => liveVoucher,
    };

    getDoc.mockResolvedValue(voucherSnapshot);
    const transactionApi = {
      get: jest
        .fn()
        .mockResolvedValueOnce(voucherSnapshot)
        .mockResolvedValueOnce({ exists: () => false }),
      update: jest.fn(),
      set: jest.fn(),
    };
    runTransaction.mockImplementation((database, callback) =>
      callback(transactionApi)
    );

    await expect(
      voucherService.commitTransactionWithVoucher({
        voucherId: "voucher-a",
        voucherDiscount: 20000,
        transactionId: "tx-stale",
        transactionData: { total: 20000 },
      })
    ).rejects.toThrow("Saldo voucher tidak mencukupi");

    expect(transactionApi.update).not.toHaveBeenCalled();
    expect(transactionApi.set).not.toHaveBeenCalled();
  });
});
