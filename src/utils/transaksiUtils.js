// src/utils/transaksiUtils.js

const CONVERSION_TABLE = {
  kwintal: 100000,
  ton: 1000000,
  kg: 1000,
  ons: 100,
  gram: 1,
  pcs: 1,
};

export const convertToSmallestUnit = (quantity, unit, product) => {
  const baseUnit = product.base_unit || product.smallestUnit;
  const bulkUnitName = product.bulk_unit_name || "box";
  const bulkUnitConversion = product.bulk_unit_conversion || product.piecesPerBox;

  if (unit === bulkUnitName) {
    if (!bulkUnitConversion) {
      throw new Error("Pieces per box or bulk conversion not defined");
    }
    return quantity * bulkUnitConversion;
  }

  const quantityInGrams = quantity * CONVERSION_TABLE[unit];

  if (baseUnit === "pcs") return quantityInGrams;
  if (baseUnit === "gram") return quantityInGrams;
  if (baseUnit === "ons") return quantityInGrams / 100;
  if (baseUnit === "kg") return quantityInGrams / 1000;

  return quantityInGrams;
};

export const convertFromSmallestUnit = (
  quantityInSmallest,
  targetUnit,
  product
) => {
  const baseUnit = product.base_unit || product.smallestUnit;
  const bulkUnitName = product.bulk_unit_name || "box";
  const bulkUnitConversion = product.bulk_unit_conversion || product.piecesPerBox;

  if (targetUnit === bulkUnitName) {
    if (!bulkUnitConversion) {
      throw new Error("Pieces per box or bulk conversion not defined for this product");
    }
    return quantityInSmallest / bulkUnitConversion;
  }

  if (!baseUnit || !CONVERSION_TABLE[baseUnit]) {
    throw new Error(`Unknown base unit: ${baseUnit}`);
  }

  let quantityInGrams;
  if (baseUnit === "gram") {
    quantityInGrams = quantityInSmallest;
  } else if (baseUnit === "ons") {
    quantityInGrams = quantityInSmallest * 100;
  } else if (baseUnit === "kg") {
    quantityInGrams = quantityInSmallest * 1000;
  } else if (baseUnit === "pcs") {
    quantityInGrams = quantityInSmallest;
  } else {
    throw new Error(`Unsupported base unit: ${baseUnit}`);
  }

  return quantityInGrams / CONVERSION_TABLE[targetUnit];
};

export const formatCurrency = (number) => {
  return "Rp. " + number.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const formatNumber = (number) => {
  return number.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const getInitialQuantity = (satuan) => {
  switch (satuan.toLowerCase()) {
    case "liter":
    case "kg":
    case "pcs":
    case "box":
      return 1;
    case "gram":
      return 100;
    default:
      return 1;
  }
};

export const getIncrement = (satuan) => {
  switch (satuan.toLowerCase()) {
    case "kg":
    case "liter":
      return 0.5;
    case "gram":
      return 100;
    default:
      return 1;
  }
};

export const getBarcodeIncrement = (unit) => {
  switch (unit.toLowerCase()) {
    case "gram":
      return 100;
    case "kg":
    case "ons":
    case "kwintal":
    case "tons":
    case "box":
    case "pcs":
    default:
      return 1;
  }
};

export { CONVERSION_TABLE };

// Voucher validation function
export const validateVoucher = (voucher) => {
  if (!voucher) {
    return { isValid: false, message: "Voucher tidak ditemukan" };
  }

  const now = new Date();
  const activeDate = voucher.activeDate?.toDate
    ? voucher.activeDate.toDate()
    : new Date(voucher.activeDate);
  const expireDate = voucher.expireDate?.toDate
    ? voucher.expireDate.toDate()
    : new Date(voucher.expireDate);

  // Check date validity
  if (now < activeDate) {
    return { isValid: false, message: "Voucher belum aktif" };
  }
  if (now > expireDate) {
    return { isValid: false, message: "Voucher sudah kedaluwarsa" };
  }

  // Handle campaign vouchers (cashbackCampaign type)
  if (voucher.type === "cashbackCampaign") {
    // Campaign voucher must have status "CLAIMED" to be usable
    if (voucher.status === "IN_PROGRESS") {
      return {
        isValid: false,
        message: "Voucher belum bisa digunakan - target belanja belum tercapai",
      };
    }
    if (voucher.status === "REDEEMED") {
      return { isValid: false, message: "Voucher sudah pernah digunakan" };
    }
    // Status "CLAIMED" means it's ready to use
    if (voucher.status !== "CLAIMED") {
      return { isValid: false, message: "Voucher tidak valid" };
    }
    // For CLAIMED campaign vouchers, isActive should be true
    if (!voucher.isActive) {
      return { isValid: false, message: "Voucher sudah tidak aktif" };
    }
    return { isValid: true, message: "", isCampaignVoucher: true };
  }

  // Handle regular vouchers
  if (!voucher.isActive) {
    return { isValid: false, message: "Voucher sudah tidak aktif" };
  }

  // Multi-use vouchers: check remaining balance instead of isClaimed
  if (voucher.isOneTimeUse === false) {
    const amountSpent = voucher.amountSpent || 0;
    if (amountSpent >= voucher.value) {
      return { isValid: false, message: "Saldo voucher sudah habis" };
    }
    const remaining = voucher.value - amountSpent;
    return { isValid: true, message: "", isCampaignVoucher: false, remaining };
  }

  // One-time use vouchers
  if (voucher.isClaimed) {
    return { isValid: false, message: "Voucher sudah pernah digunakan" };
  }

  return { isValid: true, message: "", isCampaignVoucher: false };
};
