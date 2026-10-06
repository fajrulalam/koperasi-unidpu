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

const creditVoucher = (overrides = {}) => ({
  id: "voucher-a",
  voucherName: "ATK Agustus 2026",
  value: 500000,
  isOneTimeUse: false,
  amountSpent: 0,
  isActive: true,
  isClaimed: false,
  activeDate: new Date(Date.now() - 60_000),
  expireDate: new Date(Date.now() + 60_000),
  ...overrides,
});

const applyVoucher = async () => {
  fireEvent.change(screen.getByPlaceholderText("Scan atau ketik ID voucher"), {
    target: { value: "voucher-a" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cek" }));
  await screen.findByText(/Voucher Valid Terdeteksi/);
};

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

  test("records a purchase fully covered by a voucher as Kredit", async () => {
    voucherService.getVoucherForPayment.mockResolvedValue(
      creditVoucher({ amountSpent: 106500 })
    );
    const { onPaymentComplete } = renderModal();

    await applyVoucher();
    expect(screen.getByText(/Sisa saldo:/)).toHaveTextContent(
      "Sisa saldo: Rp. 393.500 / Rp. 500.000"
    );

    // Nothing is paid now, so no Cash/QRIS choice is offered.
    expect(screen.queryByLabelText("Cash")).not.toBeInTheDocument();
    expect(screen.getByText(/tertutup penuh oleh voucher/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }));

    await waitFor(() => expect(onPaymentComplete).toHaveBeenCalledTimes(1));
    expect(onPaymentComplete.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        totalNumeric: 0,
        paymentMethod: "kredit",
        cashAmount: 0,
        qrisAmount: 0,
        kreditAmount: 106500,
        appliedVoucher: expect.objectContaining({
          id: "voucher-a",
          value: 393500,
          amountSpent: 106500,
          isOneTimeUse: false,
        }),
      })
    );
  });

  test("pays the rest of a partial voucher in cash", async () => {
    voucherService.getVoucherForPayment.mockResolvedValue(
      creditVoucher({ value: 30000 })
    );
    const { onPaymentComplete } = renderModal({ total: 100000 });

    await applyVoucher();
    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "80000" },
    });
    expect(screen.getByPlaceholderText("0")).toHaveValue("80.000");
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }));

    await waitFor(() => expect(onPaymentComplete).toHaveBeenCalledTimes(1));
    expect(onPaymentComplete.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        totalNumeric: 70000,
        paymentMethod: "cash",
        cashAmount: 70000,
        qrisAmount: 0,
        kreditAmount: 30000,
        change: 10000,
      })
    );
  });

  test("blocks checkout while the cash received is short", () => {
    const { onPaymentComplete } = renderModal({ total: 50000 });

    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "20000" },
    });

    expect(
      screen.getByText("Uang yang diterima kurang dari harga pembelian")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selesai" })).toBeDisabled();
    expect(onPaymentComplete).not.toHaveBeenCalled();
  });

  test("submits valid split payment amounts instead of an empty amountPaid", async () => {
    const { onPaymentComplete } = renderModal({ total: 100000 });

    fireEvent.click(screen.getByLabelText("Cash + QRIS"));
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
        kreditAmount: 0,
        cashTender: 70000,
        change: 10000,
      })
    );
  });
});
