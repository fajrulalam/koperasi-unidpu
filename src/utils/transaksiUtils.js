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
  if (unit === "box") {
    if (!product.piecesPerBox) {
      throw new Error("Pieces per box not defined");
    }
    return quantity * product.piecesPerBox;
  }

  const baseUnit = product.smallestUnit;
  const quantityInGrams = quantity * CONVERSION_TABLE[unit];
  
  if (baseUnit === "pcs") return quantityInGrams;
  if (baseUnit === "gram") return quantityInGrams;
  if (baseUnit === "ons") return quantityInGrams / 100;
  if (baseUnit === "kg") return quantityInGrams / 1000;
  
  return quantityInGrams;
};

export const convertFromSmallestUnit = (quantityInSmallest, targetUnit, product) => {
  if (targetUnit === "box") {
    if (!product.piecesPerBox) {
      throw new Error("Pieces per box not defined for this product");
    }
    return quantityInSmallest / product.piecesPerBox;
  }

  const baseUnit = product.smallestUnit;
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
  const activeDate = voucher.activeDate?.toDate ? voucher.activeDate.toDate() : new Date(voucher.activeDate);
  const expireDate = voucher.expireDate?.toDate ? voucher.expireDate.toDate() : new Date(voucher.expireDate);

  if (!voucher.isActive || voucher.isClaimed || now < activeDate || now > expireDate) {
    return { isValid: false, message: "Voucher sudah tidak aktif" };
  }

  return { isValid: true, message: "" };
};