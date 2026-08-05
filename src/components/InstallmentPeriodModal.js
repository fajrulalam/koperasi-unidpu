import React, { useMemo, useState } from "react";

function defaultPayrollPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let year = Number(value.year);
  let month = Number(value.month);
  if (Number(value.day) <= 5) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function InstallmentPeriodModal({ loan, submitting, onClose, onSubmit }) {
  const [payrollPeriod, setPayrollPeriod] = useState(defaultPayrollPeriod);
  const installment = useMemo(
    () => Math.round((Number(loan.jumlahPinjaman) || 0) / (Number(loan.tenor) || 1)),
    [loan],
  );
  const paidAfter = Math.min(Number(loan.tenor) || 0, (Number(loan.jumlahMenyicil) || 0) + 1);
  const willPayOff = paidAfter >= (Number(loan.tenor) || 0);

  return (
    <div className="installment-period-overlay" onClick={submitting ? undefined : onClose}>
      <form
        className="installment-period-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(payrollPeriod);
        }}
      >
        <h3>Catat Cicilan Berbasis Periode</h3>
        <p className="installment-period-description">
          Cicilan ini memakai penanda periode yang sama dengan Verifikasi &amp; Kunci payroll,
          sehingga periode yang sama tidak dapat dibukukan dua kali.
        </p>
        <div className="installment-period-summary">
          <span>Pinjaman</span><strong>#{loan.id.substring(0, 8)}</strong>
          <span>Cicilan</span><strong>{paidAfter}/{loan.tenor}</strong>
          <span>Nominal</span><strong>Rp {installment.toLocaleString("id-ID")}</strong>
          <span>Hasil</span><strong>{willPayOff ? "Lunas" : "Tetap aktif"}</strong>
        </div>
        <label htmlFor="installment-payroll-period">Periode payroll</label>
        <input
          id="installment-payroll-period"
          type="month"
          value={payrollPeriod}
          onChange={(event) => setPayrollPeriod(event.target.value)}
          required
          disabled={submitting}
        />
        <div className="installment-period-actions">
          <button type="button" onClick={onClose} disabled={submitting}>Batal</button>
          <button type="submit" disabled={submitting || !payrollPeriod}>
            {submitting ? "Mencatat..." : willPayOff ? "Cicil & Lunaskan" : "Catat Cicilan"}
          </button>
        </div>
      </form>
    </div>
  );
}
