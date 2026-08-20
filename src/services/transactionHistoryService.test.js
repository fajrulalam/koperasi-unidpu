import { groupTransactionsByItem } from "./transactionHistoryService";

describe("transaction history profit totals", () => {
  test("uses the stock purchase price when a legacy sale has no usable cost", () => {
    const result = groupTransactionsByItem(
      [
        {
          itemId: "le-mineral-600ml",
          itemName: "Le Mineral 600ml",
          unit: "pcs",
          quantity: 2,
          price: 3000,
          stockWorth: Number.NaN,
          timestampInMillisEpoch: { toDate: () => new Date() },
        },
      ],
      {
        "le-mineral-600ml": {
          stock: 0,
          stockValue: 0,
          lastPurchasePrice: 2000,
        },
      }
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        revenue: 6000,
        stockWorth: 4000,
        profitMargin: 2000,
      })
    );
  });
});
