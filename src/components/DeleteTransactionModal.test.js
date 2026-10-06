// src/components/DeleteTransactionModal.test.js
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DeleteTransactionModal from "./DeleteTransactionModal";
import { deleteAndRevertTransaction } from "../services/transactionRevertService";

jest.mock("../services/transactionRevertService", () => ({
  deleteAndRevertTransaction: jest.fn(),
}));

describe("DeleteTransactionModal", () => {
  const mockTransaction = {
    id: "20261005-095046-PVQ",
    total: 188000,
    memberName: "Khamim Mansyur, S.AB.",
    isMember: true,
    nomorAnggota: "25097",
    paymentMethod: "qris",
    isPaidViaQris: true,
    timestamp: { toDate: () => new Date("2026-10-05T09:50:00Z") },
    items: [
      { itemName: "Map Display 60 Lembar", quantity: 3, unit: "pcs" },
      { itemName: "Kertas Hvs Sidu A4", quantity: 1, unit: "rim" },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("does not render when isOpen is false", () => {
    const { container } = render(
      <DeleteTransactionModal
        isOpen={false}
        onClose={jest.fn()}
        transaction={mockTransaction}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("renders transaction details and items to restore", () => {
    render(
      <DeleteTransactionModal
        isOpen={true}
        onClose={jest.fn()}
        transaction={mockTransaction}
        userRole="Cashier"
      />
    );

    expect(screen.getByText("Hapus & Batalkan Transaksi")).toBeInTheDocument();
    expect(screen.getByText("20261005-095046-PVQ")).toBeInTheDocument();
    expect(screen.getByText(/Khamim Mansyur, S.AB./)).toBeInTheDocument();
    expect(screen.getByText("Map Display 60 Lembar")).toBeInTheDocument();
    expect(screen.getByText("+3 pcs")).toBeInTheDocument();
    expect(screen.getByText("Kertas Hvs Sidu A4")).toBeInTheDocument();
    expect(screen.getByText("+1 rim")).toBeInTheDocument();
  });

  test("calls deleteAndRevertTransaction and triggers onSuccess on confirm", async () => {
    deleteAndRevertTransaction.mockResolvedValueOnce({
      success: true,
      transactionId: "20261005-095046-PVQ",
    });

    const onClose = jest.fn();
    const onSuccess = jest.fn();

    render(
      <DeleteTransactionModal
        isOpen={true}
        onClose={onClose}
        transaction={mockTransaction}
        onSuccess={onSuccess}
        currentUser={{ email: "kasir@unipdu.ac.id" }}
        userRole="Cashier"
        isProduction={true}
      />
    );

    const deleteBtn = screen.getByRole("button", {
      name: /Hapus & Revert Transaksi/i,
    });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteAndRevertTransaction).toHaveBeenCalledWith({
        transactionId: "20261005-095046-PVQ",
        currentUser: { email: "kasir@unipdu.ac.id" },
        userRole: "Cashier",
        isProduction: true,
        reason: "Transaksi duplikat / salah input",
      });
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  test("displays error message if revert fails", async () => {
    deleteAndRevertTransaction.mockRejectedValueOnce(
      new Error("Gagal mengembalikan data stok")
    );

    render(
      <DeleteTransactionModal
        isOpen={true}
        onClose={jest.fn()}
        transaction={mockTransaction}
        userRole="Wakil Rektor 2"
      />
    );

    const deleteBtn = screen.getByRole("button", {
      name: /Hapus & Revert Transaksi/i,
    });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Gagal mengembalikan data stok")
      ).toBeInTheDocument();
    });
  });
});
