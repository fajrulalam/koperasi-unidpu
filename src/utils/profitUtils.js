/**
 * Helpers for keeping sale cost/profit calculations consistent across the
 * point-of-sale and transaction-history views.
 */

export function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Return the unit cost used for a sale.
 *
 * The inventory value is preferred when it can provide a valid weighted
 * average. lastPurchasePrice is the fallback shown in the stock screen and
 * remains available when the stock count/value is zero or incomplete.
 */
export function getUnitCost(stockData = {}) {
  const stock = toFiniteNumber(stockData.stock);
  const stockValue = toFiniteNumber(stockData.stockValue);

  if (stock !== null && stock > 0 && stockValue !== null && stockValue > 0) {
    const averageCost = stockValue / stock;
    if (Number.isFinite(averageCost) && averageCost >= 0) {
      return averageCost;
    }
  }

  const lastPurchasePrice = toFiniteNumber(stockData.lastPurchasePrice);
  if (lastPurchasePrice !== null && lastPurchasePrice > 0) {
    return lastPurchasePrice;
  }

  return 0;
}

/**
 * Resolve the cost of one recorded sale line.
 *
 * New sale records contain stockWorth and costPrice. Older records may have
 * a missing/invalid stockWorth, so use the stock item's configured cost as a
 * backwards-compatible display fallback instead of treating the sale total
 * as pure profit.
 */
export function getSaleCost(
  saleRecord = {},
  stockData = {},
  fallbackQuantity = 0
) {
  const storedStockWorth = toFiniteNumber(saleRecord.stockWorth);
  const hasCostSnapshot =
    Object.prototype.hasOwnProperty.call(saleRecord, "costPrice") ||
    Object.prototype.hasOwnProperty.call(saleRecord, "costPerUnit");

  if (
    storedStockWorth !== null &&
    (storedStockWorth > 0 || hasCostSnapshot)
  ) {
    return storedStockWorth;
  }

  const recordedUnitCost = toFiniteNumber(
    saleRecord.costPrice ?? saleRecord.costPerUnit
  );
  if (recordedUnitCost !== null && recordedUnitCost >= 0 && hasCostSnapshot) {
    const quantity =
      toFiniteNumber(saleRecord.quantity) ?? toFiniteNumber(fallbackQuantity) ?? 0;
    return recordedUnitCost * quantity;
  }

  const quantity = toFiniteNumber(fallbackQuantity) ?? 0;
  return getUnitCost(stockData) * quantity;
}

export function calculateSaleProfit(revenue, cost) {
  return (toFiniteNumber(revenue) ?? 0) - (toFiniteNumber(cost) ?? 0);
}
