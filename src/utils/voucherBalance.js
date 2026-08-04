const hasNumericValue = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value));

const toNonNegativeNumber = (value, fallback = 0) => {
  if (!hasNumericValue(value)) return fallback;
  return Math.max(0, Number(value));
};

export const hasValidVoucherAmountSpent = (voucher) =>
  hasNumericValue(voucher?.amountSpent);

export const getVoucherFaceValue = (voucher) => {
  if (
    hasNumericValue(voucher?.nominal) &&
    toNonNegativeNumber(voucher.nominal) > 0
  ) {
    return toNonNegativeNumber(voucher.nominal);
  }
  return toNonNegativeNumber(voucher?.value);
};

export const getVoucherAmountSpent = (voucher, recoveredAmountSpent = 0) => {
  const faceValue = getVoucherFaceValue(voucher);

  if (hasValidVoucherAmountSpent(voucher)) {
    return Math.min(faceValue, toNonNegativeNumber(voucher.amountSpent));
  }

  let legacyAmountSpent = 0;
  // Older voucher documents sometimes stored the remaining balance instead.
  if (hasNumericValue(voucher?.sisaSaldo)) {
    const remaining = Math.min(
      faceValue,
      toNonNegativeNumber(voucher.sisaSaldo)
    );
    legacyAmountSpent = faceValue - remaining;
  }

  return Math.min(
    faceValue,
    Math.max(legacyAmountSpent, toNonNegativeNumber(recoveredAmountSpent))
  );
};

export const getVoucherRemainingBalance = (
  voucher,
  recoveredAmountSpent = 0
) =>
  Math.max(
    0,
    getVoucherFaceValue(voucher) -
      getVoucherAmountSpent(voucher, recoveredAmountSpent)
  );

/**
 * Reconstructs broken legacy voucher state from its recorded transactions.
 * The returned object is only a hydrated view; the next redemption persists
 * the repaired canonical amountSpent/sisaSaldo values atomically.
 */
export const hydrateVoucherBalance = (voucher, transactionUsage = 0) => {
  if (!voucher) return voucher;

  if (voucher.type === "cashbackCampaign") {
    if (voucher.status === "CLAIMED" && voucher.isClaimed === true) {
      return {
        ...voucher,
        status: "REDEEMED",
        isActive: false,
        balanceRecovered: true,
      };
    }
    return voucher;
  }

  if (
    voucher.isOneTimeUse !== false ||
    hasValidVoucherAmountSpent(voucher)
  ) {
    return voucher;
  }

  const amountSpent = getVoucherAmountSpent(voucher, transactionUsage);
  const remaining = getVoucherRemainingBalance(voucher, transactionUsage);

  return {
    ...voucher,
    amountSpent,
    sisaSaldo: remaining,
    isClaimed: remaining <= 0,
    balanceRecovered: true,
  };
};

/**
 * Produces the canonical update for every supported voucher lifecycle.
 * Throws when the voucher cannot cover the requested discount.
 */
export const buildVoucherRedemption = ({
  voucher,
  discount,
  recoveredAmountSpent = 0,
}) => {
  const redemptionAmount = Number(discount);
  if (!Number.isFinite(redemptionAmount) || redemptionAmount <= 0) {
    throw new Error("Nilai pemakaian voucher tidak valid");
  }

  const faceValue = getVoucherFaceValue(voucher);

  if (voucher?.type === "cashbackCampaign") {
    if (voucher.status !== "CLAIMED" || voucher.isClaimed === true) {
      throw new Error("Voucher sudah pernah digunakan");
    }
    if (redemptionAmount > faceValue) {
      throw new Error("Saldo voucher tidak mencukupi");
    }

    return {
      balanceBefore: faceValue,
      balanceAfter: faceValue - redemptionAmount,
      updateData: {
        status: "REDEEMED",
        isClaimed: true,
        isActive: false,
      },
    };
  }

  if (voucher?.isOneTimeUse === false) {
    const amountSpent = getVoucherAmountSpent(voucher, recoveredAmountSpent);
    const balanceBefore = Math.max(0, faceValue - amountSpent);
    if (redemptionAmount > balanceBefore) {
      throw new Error("Saldo voucher tidak mencukupi");
    }

    const newAmountSpent = amountSpent + redemptionAmount;
    const balanceAfter = Math.max(0, faceValue - newAmountSpent);
    return {
      balanceBefore,
      balanceAfter,
      updateData: {
        amountSpent: newAmountSpent,
        sisaSaldo: balanceAfter,
        isClaimed: balanceAfter <= 0,
      },
    };
  }

  if (voucher?.isClaimed) {
    throw new Error("Voucher sudah pernah digunakan");
  }
  if (redemptionAmount > faceValue) {
    throw new Error("Saldo voucher tidak mencukupi");
  }

  return {
    balanceBefore: faceValue,
    balanceAfter: 0,
    updateData: { isClaimed: true },
  };
};
