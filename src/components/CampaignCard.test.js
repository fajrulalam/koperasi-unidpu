import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CampaignCard from "./CampaignCard";

jest.mock("../utils/memberBerandaUtils", () => ({
  formatCurrency: (value) => `Rp${value}`,
}));

const campaign = {
  voucherGroupId: "campaign-1",
  voucherName: "Voucher Belanja",
  threshold: 100000,
  value: 10000,
  expireDate: {
    toDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
};

test("prevents voucher claims during member preview", () => {
  const onClaim = jest.fn();

  render(
    <CampaignCard
      campaign={campaign}
      progress={{ userPoints: 100000, status: "IN_PROGRESS" }}
      claimingVoucher={null}
      onClaim={onClaim}
      readOnly
    />
  );

  const claimButton = screen.getByRole("button", {
    name: /mode pratinjau.*klaim dinonaktifkan/i,
  });
  expect(claimButton).toBeDisabled();

  fireEvent.click(claimButton);
  expect(onClaim).not.toHaveBeenCalled();
});
