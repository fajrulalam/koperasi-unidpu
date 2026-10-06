import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BulkPurchaseModal from "./BulkPurchaseModal";
import { uploadFile } from "../firebase";
import { generateIncrementalId } from "../services/transactionHistoryService";

jest.mock("../firebase", () => ({
  uploadFile: jest.fn(() => Promise.resolve("https://example.test/nota.pdf")),
}));

jest.mock("../context/FirestoreContext", () => ({
  useFirestore: () => ({
    queryCollection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
  }),
}));

jest.mock("../services/transactionHistoryService", () => ({
  generateIncrementalId: jest.fn(() => Promise.resolve("BP-0001")),
}));

const PRODUCTS = {
  p1: {
    id: "p1",
    itemId: "111",
    name: "Kertas A4",
    base_unit: "pcs",
    bulk_unit_name: "pack",
    bulk_unit_conversion: 100,
    satuan: ["pcs", "pack"],
    stock: 10,
    stockValue: 5000,
  },
  p2: {
    id: "p2",
    itemId: "222",
    name: "Pulpen",
    base_unit: "pcs",
    satuan: ["pcs"],
    stock: 4,
    stockValue: 2000,
  },
};

// Mirrors how Stocks.js hosts the modal: always mounted, toggled via isOpen,
// and the onSave handler updates the products it passes back down.
const Host = ({ onSave, refreshProductsAfterSave = false, isWarehouse = false }) => {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState(PRODUCTS);

  return (
    <>
      <button onClick={() => setOpen(true)}>Buka Pembelian</button>
      <BulkPurchaseModal
        isOpen={open}
        onClose={() => setOpen(false)}
        products={products}
        currentUser={{ email: "kasir@unipdu.ac.id", uid: "u1" }}
        isWarehouse={isWarehouse}
        onSave={async (action, data, id, collectionName) => {
          await onSave(action, data, id, collectionName);
          if (action === "updateStock") {
            setProducts((prev) => ({
              ...prev,
              [data.id]: { ...prev[data.id], stock: data.stock, stockValue: data.stockValue },
            }));
          }
          if (action === "createNotaBelanja" && refreshProductsAfterSave) {
            // A realtime refresh handing back brand-new product objects
            setProducts((prev) =>
              Object.fromEntries(Object.entries(prev).map(([key, product]) => [key, { ...product }]))
            );
          }
        }}
      />
    </>
  );
};

const openModal = () => fireEvent.click(screen.getByText("Buka Pembelian"));

const fillFirstRow = async () => {
  const file = new File(["x"], "nota.pdf", { type: "application/pdf" });
  const fileInput = document.querySelector('input[type="file"]');
  await act(async () => {
    fireEvent.change(fileInput, { target: { files: [file] } });
  });
  await screen.findByText(/File berhasil diupload/);

  fireEvent.change(screen.getByPlaceholderText("Masukkan nama supplier..."), {
    target: { value: "Toko Maju" },
  });

  // Only the first row is used, so drop the two blank rows.
  fireEvent.click(document.querySelectorAll(".bulk-remove-btn")[2]);
  fireEvent.click(document.querySelectorAll(".bulk-remove-btn")[1]);

  const search = screen.getByPlaceholderText("Cari produk...");
  fireEvent.focus(search);
  fireEvent.change(search, { target: { value: "Kertas" } });
  fireEvent.mouseDown(await screen.findByText("Kertas A4"));

  fireEvent.change(screen.getByPlaceholderText("Jumlah (mis: 1.5)"), { target: { value: "2" } });
  fireEvent.change(screen.getByPlaceholderText("Harga per satuan"), { target: { value: "1000" } });
};

describe("BulkPurchaseModal (create mode)", () => {
  beforeEach(() => {
    localStorage.clear();
    uploadFile.mockResolvedValue("https://example.test/nota.pdf");
    generateIncrementalId.mockResolvedValue("BP-0001");
    jest.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("starts the next purchase from an empty table after a successful submit", async () => {
    const onSave = jest.fn(() => Promise.resolve());
    render(<Host onSave={onSave} />);

    openModal();
    await fillFirstRow();
    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => expect(screen.queryByText("Pembelian Grosir")).not.toBeInTheDocument());
    expect(onSave).toHaveBeenCalledWith("createNotaBelanja", expect.anything(), expect.anything(), "notaBelanja");

    openModal();

    expect(screen.getAllByPlaceholderText("Cari produk...")).toHaveLength(3);
    screen.getAllByPlaceholderText("Cari produk...").forEach((input) => expect(input).toHaveValue(""));
    screen.getAllByPlaceholderText("Jumlah (mis: 1.5)").forEach((input) => expect(input).toHaveValue(""));
    screen.getAllByPlaceholderText("Harga per satuan").forEach((input) => expect(input).toHaveValue(""));
    expect(screen.getByPlaceholderText("Masukkan nama supplier...")).toHaveValue("");
    expect(screen.queryByText(/File berhasil diupload/)).not.toBeInTheDocument();
    expect(screen.getByText("Rp 0")).toBeInTheDocument();
  });

  test("stays empty with slow writes and a products refresh landing as the submit finishes", async () => {
    const slow = () => new Promise((resolve) => setTimeout(resolve, 30));
    render(<Host onSave={jest.fn(slow)} refreshProductsAfterSave />);

    openModal();
    await fillFirstRow();
    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => expect(screen.queryByText("Pembelian Grosir")).not.toBeInTheDocument());
    // Let any late effects or refreshes settle before reopening
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    openModal();

    screen.getAllByPlaceholderText("Cari produk...").forEach((input) => expect(input).toHaveValue(""));
    screen.getAllByPlaceholderText("Jumlah (mis: 1.5)").forEach((input) => expect(input).toHaveValue(""));
    expect(screen.getByText("Rp 0")).toBeInTheDocument();
  });

  test("leaves no draft behind in localStorage after a successful submit", async () => {
    render(<Host onSave={jest.fn(() => Promise.resolve())} />);

    openModal();
    await fillFirstRow();
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(screen.queryByText("Pembelian Grosir")).not.toBeInTheDocument());

    const draftRows = localStorage.getItem("retail_purchase_draft_rows");
    const rows = draftRows ? JSON.parse(draftRows) : [];
    expect(rows.every((row) => !row.product && !row.quantity)).toBe(true);
    expect(localStorage.getItem("retail_purchase_draft_supplier") || "").toBe("");
    expect(localStorage.getItem("retail_purchase_draft_uploaded_nota")).toBeNull();
  });

  test("keeps the draft when saving fails so nothing is lost", async () => {
    const onSave = jest.fn((action) =>
      action === "createNotaBelanja" ? Promise.reject(new Error("offline")) : Promise.resolve()
    );
    render(<Host onSave={onSave} />);

    openModal();
    await fillFirstRow();
    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(screen.getByText("Pembelian Grosir")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cari produk...")).toHaveValue("Kertas A4");
  });
});

describe("BulkPurchaseModal payment account", () => {
  beforeEach(() => {
    localStorage.clear();
    uploadFile.mockResolvedValue("https://example.test/nota.pdf");
    generateIncrementalId.mockResolvedValue("BP-0001");
    jest.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const submitPurchase = async () => {
    fireEvent.click(screen.getByText("Submit"));
    await waitFor(() => expect(screen.queryByText("Pembelian Grosir")).not.toBeInTheDocument());
  };

  test("offers Cash, QRIS and Kredit with Cash selected by default", () => {
    render(<Host onSave={jest.fn(() => Promise.resolve())} />);
    openModal();

    expect(screen.getByText("Dibayar dari")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cash" })).toHaveClass("text-white");
    expect(screen.getByRole("button", { name: "QRIS" })).not.toHaveClass("text-white");
    expect(screen.getByRole("button", { name: "Kredit" })).not.toHaveClass("text-white");
  });

  test("puts supplier and upload on the left half and the account picker on the right", () => {
    render(<Host onSave={jest.fn(() => Promise.resolve())} />);
    openModal();

    const section = document.querySelector(".nota-upload-section");
    expect(section).toHaveClass("nota-upload-section-split");

    const [left, right] = section.children;
    expect(left).toHaveClass("nota-upload-main");
    expect(left).toContainElement(screen.getByPlaceholderText("Masukkan nama supplier..."));
    expect(left).toContainElement(screen.getByText("Upload Nota Supplier"));
    expect(right).toHaveClass("bulk-payment-account");
    expect(right).toContainElement(screen.getByText("Dibayar dari"));
    expect(right).toContainElement(screen.getByRole("button", { name: "Kredit" }));
  });

  test("stacks the account options vertically without extra explanatory text", () => {
    render(<Host onSave={jest.fn(() => Promise.resolve())} />);
    openModal();

    const pills = screen.getByRole("button", { name: "Cash" }).parentElement;
    expect(pills).toHaveClass("flex-col");
    expect(pills.children).toHaveLength(3);
    expect(screen.queryByText(/tercatat sebagai pengeluaran/)).not.toBeInTheDocument();
  });

  test("keeps the nota section a single column for warehouse purchases", () => {
    render(<Host onSave={jest.fn(() => Promise.resolve())} isWarehouse />);
    openModal();

    const section = document.querySelector(".nota-upload-section");
    expect(section).not.toHaveClass("nota-upload-section-split");
    expect(section.querySelector(".bulk-payment-account")).toBeNull();
    expect(screen.getByPlaceholderText("Masukkan nama supplier...")).toBeInTheDocument();
  });

  test("records the purchase total as an expense from the chosen account", async () => {
    const onSave = jest.fn(() => Promise.resolve());
    render(<Host onSave={onSave} />);

    openModal();
    await fillFirstRow();
    fireEvent.click(screen.getByRole("button", { name: "QRIS" }));
    await submitPurchase();

    expect(onSave).toHaveBeenCalledWith("createExpense", {
      amount: 2000,
      category: "Pembelian Grosir - Toko Maju",
      sourceAccount: "qris",
      bulkPurchaseId: "BP-0001",
    }, undefined, undefined);
    // The expense is written last, once the purchase itself is saved.
    expect(onSave.mock.calls.map(([action]) => action).pop()).toBe("createExpense");
  });

  test("can pay from Kredit", async () => {
    const onSave = jest.fn(() => Promise.resolve());
    render(<Host onSave={onSave} />);

    openModal();
    await fillFirstRow();
    fireEvent.click(screen.getByRole("button", { name: "Kredit" }));
    await submitPurchase();

    expect(onSave).toHaveBeenCalledWith(
      "createExpense",
      expect.objectContaining({ sourceAccount: "kredit" }),
      undefined,
      undefined
    );
  });

  test("goes back to Cash for the next purchase", async () => {
    render(<Host onSave={jest.fn(() => Promise.resolve())} />);

    openModal();
    await fillFirstRow();
    fireEvent.click(screen.getByRole("button", { name: "Kredit" }));
    await submitPurchase();

    expect(localStorage.getItem("retail_purchase_draft_account")).toBeNull();
    openModal();
    expect(screen.getByRole("button", { name: "Cash" })).toHaveClass("text-white");
    expect(screen.getByRole("button", { name: "Kredit" })).not.toHaveClass("text-white");
  });

  test("remembers the chosen account across a reload while the draft is open", () => {
    const { unmount } = render(<Host onSave={jest.fn(() => Promise.resolve())} />);
    openModal();
    fireEvent.click(screen.getByRole("button", { name: "QRIS" }));
    unmount();

    render(<Host onSave={jest.fn(() => Promise.resolve())} />);
    openModal();

    expect(screen.getByRole("button", { name: "QRIS" })).toHaveClass("text-white");
  });

  test("still completes the purchase and warns when only the expense fails", async () => {
    const onSave = jest.fn((action) =>
      action === "createExpense" ? Promise.reject(new Error("offline")) : Promise.resolve()
    );
    render(<Host onSave={onSave} />);

    openModal();
    await fillFirstRow();
    await submitPurchase();

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("gagal dicatat di Finance")));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Rp 2.000"));

    openModal();
    screen.getAllByPlaceholderText("Cari produk...").forEach((input) => expect(input).toHaveValue(""));
  });

  test("does not touch Finance for warehouse purchases", async () => {
    const onSave = jest.fn(() => Promise.resolve());
    render(<Host onSave={onSave} isWarehouse />);

    openModal();
    expect(screen.queryByText("Dibayar dari")).not.toBeInTheDocument();

    await fillFirstRow();
    await submitPurchase();

    expect(onSave).toHaveBeenCalledWith("createNotaBelanja", expect.anything(), expect.anything(), "notaBelanja_b2b");
    expect(onSave.mock.calls.map(([action]) => action)).not.toContain("createExpense");
  });
});
