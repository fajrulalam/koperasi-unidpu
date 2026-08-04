import { validateVoucher } from "./transaksiUtils";

describe("validateVoucher", () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString();
  const lastYear = new Date(Date.now() - 365 * 86400000).toISOString();

  test("returns valid true and isValid true for active unclaimed voucher", () => {
    const voucher = {
      activeDate: yesterday,
      expireDate: nextYear,
      isActive: true,
      isClaimed: false,
      value: 50000,
    };
    const res = validateVoucher(voucher);
    expect(res.valid).toBe(true);
    expect(res.isValid).toBe(true);
  });

  test("returns valid false and message when voucher expired", () => {
    const voucher = {
      activeDate: lastYear,
      expireDate: yesterday,
      isActive: true,
      isClaimed: false,
      value: 50000,
    };
    const res = validateVoucher(voucher);
    expect(res.valid).toBe(false);
    expect(res.isValid).toBe(false);
    expect(res.reason).toBe("Voucher sudah kedaluwarsa");
    expect(res.message).toBe("Voucher sudah kedaluwarsa");
  });

  test("returns valid false when single-use voucher is claimed", () => {
    const voucher = {
      activeDate: yesterday,
      expireDate: nextYear,
      isActive: true,
      isClaimed: true,
      isOneTimeUse: true,
      value: 50000,
    };
    const res = validateVoucher(voucher);
    expect(res.valid).toBe(false);
    expect(res.isValid).toBe(false);
    expect(res.reason).toBe("Voucher sudah pernah digunakan");
  });
});
