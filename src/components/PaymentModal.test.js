import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PaymentModal from "./PaymentModal";
import { voucherService } from "../services/voucherService";

jest.mock("../services/voucherService", () => ({
  voucherService: {
    getAllApprovedMembers: jest.fn(),
    getVoucherForPayment: jest.fn(),
    getMemberByNomorAnggota: jest.fn(),
  },
}));

const renderModal = (overrides = {}) => {
  const onPaymentComplete = jest.fn().mockResolvedValue(undefined);
  render(
    <PaymentModal
      isOpen
      onClose={jest.fn()}
      total={106500}
      onPaymentComplete={onPaymentComplete}
      isProduction
      {...overrides}
    />
  );
  return { onPaymentComplete };
};

describe("PaymentModal voucher checkout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    voucherService.getAllApprovedMembers.mockResolvedValue([]);
  });

  test("uses the recovered remaining credit and sends voucher handling to checkout", async () => {
    voucherService.getVoucherForPayment.mockResolvedValue({
      id: "voucher-a",
      voucherName: "ATK Agustus 2026",
      value: 500000,
      isOneTimeUse: false,
      amountSpent: 106500,
      isActive: true,
      isClaimed: false,
      activeDate: new Date(Date.now() - 60_000),
      expireDate: new Date(Date.now() + 60_000),
    });
    const { onPaymentComplete } = renderModal();

    fireEvent.change(screen.getByPlaceholderText("Scan atau ketik ID voucher"), {
      target: { value: "voucher-a" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cek" }));

    await screen.findByText(/Voucher Valid Terdeteksi/);
    expect(screen.getByText(/Sisa saldo:/)).toHaveTextContent(
      "Sisa saldo: Rp. 393.500 / Rp. 500.000"
    );

    fireEvent.click(screen.getByLabelText("QRIS"));
    expect(screen.getByPlaceholderText("0")).toHaveValue("0");
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }));

    await waitFor(() => expect(onPaymentComplete).toHaveBeenCalledTimes(1));
    expect(onPaymentComplete.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        totalNumeric: 0,
        paymentMethod: "qris",
        qrisAmount: 0,
        appliedVoucher: expect.objectContaining({
          id: "voucher-a",
          value: 393500,
          amountSpent: 106500,
          isOneTimeUse: false,
        }),
      })
    );
  });

  test("submits valid split payment amounts instead of an empty amountPaid", async () => {
    const { onPaymentComplete } = renderModal({ total: 100000 });

    fireEvent.click(screen.getByLabelText("Split (Cash + QRIS)"));
    fireEvent.change(screen.getByPlaceholderText("Scan / Ketik Nominal QRIS"), {
      target: { value: "40000" },
    });
    fireEvent.change(screen.getByPlaceholderText("Masukkan Uang Cash"), {
      target: { value: "70000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }));

    await waitFor(() => expect(onPaymentComplete).toHaveBeenCalledTimes(1));
    expect(onPaymentComplete.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        numericAmountPaid: 110000,
        totalNumeric: 100000,
        paymentMethod: "split",
        qrisAmount: 40000,
        cashAmount: 60000,
        cashTender: 70000,
        change: 10000,
      })
    );
  });
});
