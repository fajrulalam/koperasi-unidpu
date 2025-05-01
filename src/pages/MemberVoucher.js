import React, { useState } from "react";
import "../styles/Member.css";

const MemberVoucher = () => {
  const [availableVouchers, setAvailableVouchers] = useState([
    {
      id: 1,
      code: "UNIPDU10",
      discount: "10%",
      expiry: "30 April 2025",
      status: "available",
    },
    {
      id: 2,
      code: "MEMBER25",
      discount: "25%",
      expiry: "15 Mei 2025",
      status: "available",
    },
  ]);

  const handleClaimVoucher = (id) => {
    setAvailableVouchers(
      availableVouchers.map((voucher) =>
        voucher.id === id ? { ...voucher, status: "claimed" } : voucher
      )
    );
  };

  return (
    <div className="member-content">
      <h2 className="page-title">Ambil Sembako</h2>

      <div className="info-card">
        <h3 className="section-title">Voucher Tersedia</h3>

        <div className="voucher-list">
          {availableVouchers.map((voucher) => (
            <div key={voucher.id} className="voucher-item">
              <div className="voucher-details">
                <div className="voucher-code">{voucher.code}</div>
                <div className="voucher-discount">
                  {voucher.discount} diskon
                </div>
                <div className="voucher-expiry">
                  Berlaku hingga: {voucher.expiry}
                </div>
              </div>

              <button
                onClick={() => handleClaimVoucher(voucher.id)}
                className={`brutal-button ${
                  voucher.status === "claimed"
                    ? "secondary-button"
                    : "primary-button"
                }`}
                disabled={voucher.status === "claimed"}
                style={{ margin: "0" }}
              >
                {voucher.status === "claimed" ? "Claimed" : "Claim"}
              </button>
            </div>
          ))}
        </div>

        <div className="voucher-info">
          <p>
            <strong>Cara Menggunakan Voucher:</strong>
          </p>
          <ol>
            <li>Claim voucher yang Anda inginkan</li>
            <li>Tunjukkan kode voucher pada kasir saat melakukan pembayaran</li>
            <li>Diskon akan otomatis diterapkan pada total belanja Anda</li>
          </ol>
          <p>
            Voucher hanya berlaku untuk produk non-promo dan tidak dapat
            digabungkan dengan diskon lainnya.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MemberVoucher;
