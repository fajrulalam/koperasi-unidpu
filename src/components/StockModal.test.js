import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import StockModal from "./StockModal";

const products = {
  p1: {
    name: "Kertas",
    base_unit: "pcs",
    bulk_unit_name: "pack",
    bulk_unit_conversion: 100,
    satuan: ["pcs", "pack"],
    stock: 10,
    stockValue: 5000,
  },
};

const renderModal = (dialogType, tempState = {}) => {
  const onSave = jest.fn();
  render(
    <StockModal
      dialogOpen
      dialogType={dialogType}
      selectedProductId="p1"
      products={products}
      onClose={jest.fn()}
      onSave={onSave}
      tempState={{ tempAmount: "", tempSatuan: "pcs", tempCost: "", ...tempState }}
      setTempState={jest.fn()}
      convertToSmallestUnit={jest.fn()}
    />
  );
  return { onSave };
};

describe("StockModal", () => {
  test("Tetapkan Stok only asks for the quantity", () => {
    renderModal("tetapkan");

    expect(screen.getByText("Tetapkan Stok")).toBeInTheDocument();
    expect(screen.getByText("Jumlah")).toBeInTheDocument();
    expect(screen.queryByText(/Harga Pembelian/)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("e.g. 100.000")).not.toBeInTheDocument();
  });

  test("Tetapkan Stok saves without a price", () => {
    const { onSave } = renderModal("tetapkan", { tempAmount: "5" });

    fireEvent.click(screen.getByText("Simpan"));

    expect(onSave).toHaveBeenCalledWith("tetapkan");
  });

  test("Tetapkan Stok still requires a quantity", () => {
    const { onSave } = renderModal("tetapkan");

    fireEvent.click(screen.getByText("Simpan"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Jumlah wajib diisi")).toBeInTheDocument();
  });

  test("Tambah Stok keeps its purchase price field", () => {
    renderModal("tambah");

    expect(screen.getByText("Total Harga Kulak (Rp)")).toBeInTheDocument();
  });
});
