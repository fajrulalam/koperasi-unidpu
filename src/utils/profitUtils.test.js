import {
  calculateSaleProfit,
  getSaleCost,
  getUnitCost,
} from "./profitUtils";

describe("profit calculations", () => {
  test("falls back to the displayed purchase price when stock is empty", () => {
    expect(
      getUnitCost({ stock: 0, stockValue: 0, lastPurchasePrice: 2000 })
    ).toBe(2000);
  });

  test("uses a valid weighted stock value when available", () => {
    expect(
      getUnitCost({ stock: 10, stockValue: 20000, lastPurchasePrice: 2500 })
    ).toBe(2000);
  });

  test("resolves a legacy sale with an invalid stored cost", () => {
    const cost = getSaleCost(
      { quantity: 2, stockWorth: Number.NaN },
      { stock: 0, stockValue: 0, lastPurchasePrice: 2000 },
      2
    );

    expect(cost).toBe(4000);
    expect(calculateSaleProfit(6000, cost)).toBe(2000);
  });

  test("preserves an explicit zero-cost snapshot", () => {
    expect(
      getSaleCost(
        { quantity: 2, costPrice: 0, stockWorth: 0 },
        { lastPurchasePrice: 2000 },
        2
      )
    ).toBe(0);
  });
});
