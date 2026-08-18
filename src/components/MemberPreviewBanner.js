import React from "react";
import { FaArrowLeft, FaEye, FaLock } from "react-icons/fa";
import "../styles/MemberPreview.css";

const MemberPreviewBanner = ({ member, onExit }) => (
  <div className="member-preview-banner" role="status" aria-live="polite">
    <div className="member-preview-banner__icon" aria-hidden="true">
      <FaEye />
    </div>
    <div className="member-preview-banner__content">
      <div className="member-preview-banner__title">
        Mode pratinjau anggota
        <span className="member-preview-banner__readonly">
          <FaLock aria-hidden="true" /> Hanya baca
        </span>
      </div>
      <div className="member-preview-banner__member">
        Melihat aplikasi sebagai <strong>{member?.nama || "Anggota"}</strong>
        {member?.nomorAnggota ? ` · No. ${member.nomorAnggota}` : ""}
      </div>
    </div>
    <button
      type="button"
      className="member-preview-banner__exit"
      onClick={onExit}
    >
      <FaArrowLeft aria-hidden="true" />
      Kembali ke Daftar Anggota
    </button>
  </div>
);

export default MemberPreviewBanner;
