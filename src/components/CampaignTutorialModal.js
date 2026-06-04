import React, { useEffect, useState } from "react";
import "../styles/CampaignTutorialModal.css";

// Import tutorial images from src/assets
import step1Image from "../assets/tutorial/step-1-tell-cashier.png";
import step2Image from "../assets/tutorial/step-2-earn-points-v2.png";
import step3Image from "../assets/tutorial/step-3-reach-target.png";
import step4Image from "../assets/tutorial/step-4-claim-use.png";

const CampaignTutorialModal = ({ isOpen, onClose }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const steps = [
    {
      icon: "💬",
      image: step1Image,
      imageAlt:
        "Ilustrasi pelanggan memberitahu nomor anggota ke kasir di minimarket",
      title: "Sebutkan Nomor Anggota",
      description: "Saat bayar di kasir, sebutkan 5 digit Nomor Anggota kamu.",
    },
    {
      icon: "⭐",
      image: step2Image,
      imageAlt:
        "Ilustrasi poin bertambah otomatis sesuai jumlah belanja dengan angka poin naik",
      title: "Poin Otomatis Masuk",
      description:
        "Setiap belanja, poin langsung ditambahkan sejumlah nominal belanjaanmu.",
    },
    {
      icon: "🎯",
      image: step3Image,
      imageAlt:
        "Ilustrasi progress bar yang hampir penuh menuju target dengan timer countdown",
      title: "Capai Target Sebelum Waktu Habis",
      description:
        "Kumpulkan poin sampai target tercapai. Perhatikan batas waktunya!",
    },
    {
      icon: "🎁",
      image: step4Image,
      imageAlt:
        "Ilustrasi tombol klaim voucher dan voucher yang siap digunakan di kasir",
      title: "Klaim & Gunakan",
      description:
        "Klaim voucher di aplikasi, lalu gunakan saat belanja berikutnya.",
    },
  ];

  return (
    <div
      className={`campaign-tutorial-overlay ${isMobile ? "mobile" : "desktop"}`}
      onClick={handleOverlayClick}
    >
      <div
        className={`campaign-tutorial-modal ${isMobile ? "bottom-sheet" : ""}`}
      >
        {/* Drag handle for mobile */}
        {isMobile && <div className="tutorial-drag-handle" />}

        {/* Header */}
        <div className="tutorial-header">
          <div className="tutorial-header-content">
            <span className="tutorial-header-icon">🎯</span>
            <h3 className="tutorial-title">Cara Ikut Kampanye</h3>
          </div>
          <button
            className="tutorial-close-btn"
            onClick={onClose}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Steps */}
        <div className="tutorial-steps">
          {steps.map((step, index) => (
            <div key={index} className="tutorial-step">
              <div className="step-number">{index + 1}</div>
              <div className="step-content">
                <div className="step-image-container">
                  <img
                    src={step.image}
                    alt={step.imageAlt}
                    className="step-image"
                    loading="lazy"
                  />
                  {/* <span className="step-icon-overlay">{step.icon}</span> */}
                </div>
                <div className="step-text">
                  <h4 className="step-title">{step.title}</h4>
                  <p className="step-description">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="tutorial-footer">
          <button className="tutorial-got-it-btn" onClick={onClose}>
            Mengerti, Mulai Kumpulkan Poin!
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignTutorialModal;
