import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import MemberPreviewBanner from "./MemberPreviewBanner";

test("shows the selected member and returns to the member list", () => {
  const onExit = jest.fn();

  render(
    <MemberPreviewBanner
      member={{ nama: "Siti Aminah", nomorAnggota: "00123" }}
      onExit={onExit}
    />
  );

  expect(screen.getByText("Siti Aminah", { exact: false })).toBeInTheDocument();
  expect(screen.getByText("Hanya baca", { exact: false })).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: /kembali ke daftar anggota/i })
  );
  expect(onExit).toHaveBeenCalledTimes(1);
});
