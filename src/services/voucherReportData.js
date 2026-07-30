const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getItemName = (item) =>
  item.itemName ||
  item.nama ||
  item.name ||
  item.productName ||
  item.title ||
  "Barang Tanpa Nama";

const getItemQuantity = (item) =>
  toFiniteNumber(item.quantity ?? item.qty ?? item.jumlah, 1);

const getItemUnitPrice = (item) =>
  toFiniteNumber(item.price ?? item.harga ?? item.unitPrice, 0);

const getItemSubtotal = (item) => {
  const quantity = getItemQuantity(item);
  const unitPrice = getItemUnitPrice(item);
  return toFiniteNumber(item.subtotal ?? item.total, unitPrice * quantity);
};

const getTransactionSalesValue = (transaction) => {
  const transactionTotal = Number(transaction.total);
  if (Number.isFinite(transactionTotal)) {
    return transactionTotal;
  }

  return (Array.isArray(transaction.items) ? transaction.items : []).reduce(
    (sum, item) => sum + getItemSubtotal(item),
    0
  );
};

const getRecipientKey = (voucher) => {
  if (voucher.userId) return `user:${voucher.userId}`;
  if (voucher.nomorAnggota) return `member:${voucher.nomorAnggota}`;
  return `voucher:${voucher.id}`;
};

/**
 * Aggregate every line item bought with vouchers in the selected program.
 * Total sales value is the gross line-item value before the voucher discount.
 */
export const aggregateVoucherItems = (transactions = []) => {
  const itemsMap = new Map();

  transactions.forEach((transaction) => {
    const items = Array.isArray(transaction.items) ? transaction.items : [];

    items.forEach((item) => {
      const name = getItemName(item);
      const itemKey = String(
        item.itemId || item.id || item.productId || `name:${name.toLowerCase()}`
      );
      const unitPrice = getItemUnitPrice(item);
      const quantity = getItemQuantity(item);
      const totalValue = getItemSubtotal(item);

      if (!itemsMap.has(itemKey)) {
        itemsMap.set(itemKey, {
          key: itemKey,
          name,
          quantity: 0,
          totalValue: 0,
          unitPrices: new Set(),
        });
      }

      const aggregate = itemsMap.get(itemKey);
      aggregate.quantity += quantity;
      aggregate.totalValue += totalValue;
      aggregate.unitPrices.add(unitPrice);
    });
  });

  const items = Array.from(itemsMap.values())
    .map((item) => ({
      ...item,
      unitPrices: Array.from(item.unitPrices).sort((a, b) => a - b),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));

  return {
    items,
    grandQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    grandSalesValue: items.reduce((sum, item) => sum + item.totalValue, 0),
  };
};

/**
 * Build one row per voucher recipient and attach transactions using voucherId.
 * voucherId is authoritative because copied user/member fields on a transaction
 * can be absent or can refer to a different member entered at checkout.
 */
export const buildVoucherRecipientSummary = (
  vouchers = [],
  transactions = [],
  voucherGroup = {}
) => {
  const recipients = new Map();
  const recipientKeyByVoucherId = new Map();

  vouchers.forEach((voucher) => {
    const recipientKey = getRecipientKey(voucher);
    recipientKeyByVoucherId.set(voucher.id, recipientKey);

    if (!recipients.has(recipientKey)) {
      recipients.set(recipientKey, {
        key: recipientKey,
        name: voucher.nama || "Voucher Cetak (Non-Member)",
        nomorAnggota: voucher.nomorAnggota || "-",
        office: voucher.kantor || voucher.satuanKerja || "-",
        voucherIds: [],
        voucherValue: 0,
        transactions: [],
      });
    }

    const recipient = recipients.get(recipientKey);
    recipient.voucherIds.push(voucher.id);
    recipient.voucherValue += toFiniteNumber(
      voucher.value,
      toFiniteNumber(voucherGroup.value, 0)
    );
  });

  transactions.forEach((transaction) => {
    const recipientKey = recipientKeyByVoucherId.get(transaction.voucherId);
    if (!recipientKey || !recipients.has(recipientKey)) return;
    recipients.get(recipientKey).transactions.push(transaction);
  });

  const recipientList = Array.from(recipients.values())
    .map((recipient) => {
      const totalVoucherUsed = recipient.transactions.reduce(
        (sum, transaction) =>
          sum + toFiniteNumber(transaction.voucherDiscount, 0),
        0
      );
      const totalSalesValue = recipient.transactions.reduce(
        (sum, transaction) => sum + getTransactionSalesValue(transaction),
        0
      );

      return {
        ...recipient,
        hasPurchased: recipient.transactions.length > 0,
        totalTransactions: recipient.transactions.length,
        totalVoucherUsed,
        totalSalesValue,
      };
    })
    .sort((a, b) => {
      if (a.hasPurchased !== b.hasPurchased) return a.hasPurchased ? -1 : 1;
      return a.name.localeCompare(b.name, "id");
    });

  return {
    recipients: recipientList,
    purchasedRecipientCount: recipientList.filter(
      (recipient) => recipient.hasPurchased
    ).length,
    notPurchasedRecipientCount: recipientList.filter(
      (recipient) => !recipient.hasPurchased
    ).length,
    totalVoucherUsed: recipientList.reduce(
      (sum, recipient) => sum + recipient.totalVoucherUsed,
      0
    ),
  };
};

export const buildVoucherReportData = ({
  vouchers = [],
  transactions = [],
  voucherGroup = {},
}) => {
  const itemSummary = aggregateVoucherItems(transactions);
  const recipientSummary = buildVoucherRecipientSummary(
    vouchers,
    transactions,
    voucherGroup
  );

  return {
    ...itemSummary,
    ...recipientSummary,
    totalTransactions: transactions.length,
  };
};
