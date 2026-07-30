import {
  aggregateVoucherItems,
  buildVoucherRecipientSummary,
} from "./voucherReportData";

describe("voucher report data", () => {
  test("aggregates quantities and gross sales while retaining varied prices", () => {
    const result = aggregateVoucherItems([
      {
        items: [
          {
            itemId: "stabilo",
            itemName: "Stabilo",
            quantity: 1,
            price: 2000,
            subtotal: 2000,
          },
          {
            itemId: "paper",
            itemName: "Paper",
            quantity: 2,
            price: 10000,
            subtotal: 20000,
          },
        ],
      },
      {
        items: [
          {
            itemId: "stabilo",
            itemName: "Stabilo",
            quantity: 1,
            price: 2500,
            subtotal: 2500,
          },
        ],
      },
    ]);

    const stabilo = result.items.find((item) => item.key === "stabilo");
    expect(stabilo.quantity).toBe(2);
    expect(stabilo.totalValue).toBe(4500);
    expect(stabilo.unitPrices).toEqual([2000, 2500]);
    expect(result.grandQuantity).toBe(4);
    expect(result.grandSalesValue).toBe(24500);
  });

  test("attributes a purchase to the voucher recipient, not copied transaction identity", () => {
    const vouchers = [
      {
        id: "voucher-a",
        userId: "member-a",
        nama: "Member A",
        nomorAnggota: "001",
        value: 500000,
      },
      {
        id: "voucher-b",
        userId: "member-b",
        nama: "Member B",
        nomorAnggota: "002",
        value: 500000,
      },
    ];
    const transactions = [
      {
        id: "tx-1",
        voucherId: "voucher-a",
        userId: "member-b",
        voucherDiscount: 75000,
        total: 75000,
      },
      {
        id: "tx-2",
        voucherId: "voucher-a",
        userId: null,
        voucherDiscount: 25000,
        total: 25000,
      },
    ];

    const result = buildVoucherRecipientSummary(vouchers, transactions, {
      value: 500000,
    });
    const memberA = result.recipients.find(
      (recipient) => recipient.key === "user:member-a"
    );
    const memberB = result.recipients.find(
      (recipient) => recipient.key === "user:member-b"
    );

    expect(memberA.totalTransactions).toBe(2);
    expect(memberA.totalVoucherUsed).toBe(100000);
    expect(memberA.hasPurchased).toBe(true);
    expect(memberB.totalTransactions).toBe(0);
    expect(memberB.hasPurchased).toBe(false);
    expect(result.purchasedRecipientCount).toBe(1);
    expect(result.notPurchasedRecipientCount).toBe(1);
  });
});
