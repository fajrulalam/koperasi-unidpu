// Page content fills the width beside the sidebar (see "Layout" in UI_GUIDE.md).
// Each page container below used to be capped and centered, which left large
// empty margins on wide screens. This keeps the caps from creeping back.
import fs from "fs";
import path from "path";

const PAGE_CONTAINERS = [
  ["SejarahTransaksiNew.css", ".st-container", "Sejarah Transaksi"],
  ["SejarahTransaksi.css", ".sejarah-transaksi-container", "Sejarah Transaksi Gudang"],
  ["SejarahBelanja.css", ".sb-container", "Sejarah Belanja"],
  ["TransaksiRefactored.css", ".transaksi-container", "Transaksi"],
  ["NotaBelanjaB2B.css", ".nota-belanja-b2b-container", "Nota Belanja B2B"],
  ["VoucherKoperasiPageNew.css", ".voucher-page", "Voucher Koperasi"],
  ["AdminSettings.css", ".admin-settings", "Pengaturan Admin"],
  ["PrinterSettings.css", ".printer-settings", "Pengaturan Printer"],
];

const ruleBody = (file, selector) => {
  const css = fs.readFileSync(path.join(__dirname, file), "utf8");
  const escaped = selector.replace(/\./g, "\\.");
  const match = css.match(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`${selector} not found in ${file}`);
  return match[1];
};

describe("page containers use the full available width", () => {
  test.each(PAGE_CONTAINERS)("%s (%s) has no width cap", (file, selector) => {
    expect(ruleBody(file, selector)).not.toMatch(/max-width\s*:/);
  });

  test.each(PAGE_CONTAINERS)("%s (%s) is not centered with auto side margins", (file, selector) => {
    expect(ruleBody(file, selector)).not.toMatch(/margin\s*:[^;]*\bauto\b/);
  });

  test("the guard reads real rules", () => {
    // Sanity check: the padding of Sejarah Transaksi is still there.
    expect(ruleBody("SejarahTransaksiNew.css", ".st-container")).toMatch(/padding\s*:\s*24px/);
  });
});
