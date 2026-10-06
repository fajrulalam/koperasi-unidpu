import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import WarehouseStockModal from "./WarehouseStockModal";

const products = {
  p1: {
    name: "Beras 25kg",
    base_unit: "kg",
    bulk_unit_name: "sak",
    bulk_unit_conversion: 25,
    stock: 100,
    stockValue: 1200000,
  },
};

const renderModal = (dialogType, tempState = {}) => {
  const onSave = jest.fn();
  render(
    <WarehouseStockModal
      dialogOpen
      dialogType={dialogType}
      selectedProductId="p1"
      products={products}
      onClose={jest.fn()}
      onSave={onSave}
      tempState={{ tempAmount: "", tempSatuan: "kg", tempCost: "", ...tempState }}
      setTempState={jest.fn()}
    />
  );
  return { onSave };
};

describe("WarehouseStockModal Tetapkan Stok", () => {
  test("only asks for the quantity, never a price", () => {
    renderModal("tetapkan");

    expect(screen.getByText("Tetapkan Stok")).toBeInTheDocument();
    expect(screen.getByText("Jumlah dan Satuan")).toBeInTheDocument();
    expect(screen.queryByText(/Harga Pembelian/)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("e.g. 100.000")).not.toBeInTheDocument();
    expect(document.querySelector(".currency-input")).toBeNull();
  });

  test("saves with a quantity and no price", () => {
    const { onSave } = renderModal("tetapkan", { tempAmount: "40" });

    fireEvent.click(screen.getByText("Simpan"));

    expect(onSave).toHaveBeenCalledWith("tetapkan");
  });

  test("still requires a quantity", () => {
    const { onSave } = renderModal("tetapkan");

    fireEvent.click(screen.getByText("Simpan"));

    expect(onSave).not.toHaveBeenCalled();
  });

  test("Tambah Stok keeps its purchase price field", () => {
    renderModal("tambah");

    expect(screen.getByText("Total Harga Beli (Rp)")).toBeInTheDocument();
  });
});
