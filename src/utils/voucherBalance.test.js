import {
  buildVoucherRedemption,
  getVoucherAmountSpent,
  getVoucherRemainingBalance,
  hydrateVoucherBalance,
} from "./voucherBalance";

describe("voucher balance lifecycle", () => {
  test("recovers a NaN amountSpent from recorded transaction usage", () => {
    const brokenVoucher = {
      id: "voucher-a",
      value: 500000,
      isOneTimeUse: false,
      amountSpent: Number.NaN,
    };

    const hydrated = hydrateVoucherBalance(brokenVoucher, 106500);

    expect(hydrated.amountSpent).toBe(106500);
    expect(hydrated.sisaSaldo).toBe(393500);
    expect(hydrated.isClaimed).toBe(false);
    expect(getVoucherRemainingBalance(hydrated)).toBe(393500);
  });

  test("uses transaction history when it is newer than a legacy sisaSaldo", () => {
    const voucher = {
      value: 500000,
      isOneTimeUse: false,
      amountSpent: Number.NaN,
      sisaSaldo: 500000,
    };

    expect(getVoucherAmountSpent(voucher, 238500)).toBe(238500);
    expect(getVoucherRemainingBalance(voucher, 238500)).toBe(261500);
  });

  test("debits a multi-use voucher and persists both canonical fields", () => {
    const redemption = buildVoucherRedemption({
      voucher: {
        value: 500000,
        isOneTimeUse: false,
        amountSpent: 106500,
      },
      discount: 200000,
    });

    expect(redemption.balanceBefore).toBe(393500);
    expect(redemption.balanceAfter).toBe(193500);
    expect(redemption.updateData).toEqual({
      amountSpent: 306500,
      sisaSaldo: 193500,
      isClaimed: false,
    });
  });

  test("marks a multi-use voucher claimed exactly when its balance is exhausted", () => {
    const redemption = buildVoucherRedemption({
      voucher: {
        value: 500000,
        isOneTimeUse: false,
        amountSpent: Number.NaN,
      },
      recoveredAmountSpent: 238500,
      discount: 261500,
    });

    expect(redemption.balanceAfter).toBe(0);
    expect(redemption.updateData.amountSpent).toBe(500000);
    expect(redemption.updateData.isClaimed).toBe(true);
  });

  test("rejects a debit larger than the latest remaining balance", () => {
    expect(() =>
      buildVoucherRedemption({
        voucher: {
          value: 500000,
          isOneTimeUse: false,
          amountSpent: 450000,
        },
        discount: 50001,
      })
    ).toThrow("Saldo voucher tidak mencukupi");
  });

  test("repairs the legacy campaign state produced by the old modal", () => {
    const hydrated = hydrateVoucherBalance({
      type: "cashbackCampaign",
      status: "CLAIMED",
      isClaimed: true,
      isActive: true,
    });

    expect(hydrated.status).toBe("REDEEMED");
    expect(hydrated.isActive).toBe(false);
    expect(hydrated.balanceRecovered).toBe(true);
  });
});
