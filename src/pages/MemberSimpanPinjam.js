import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  query,
  collection,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import "../styles/Member.css";

const MemberSimpanPinjam = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userDocRef, setUserDocRef] = useState(null);
  const [activeTab, setActiveTab] = useState("simpanan");
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [simpananForm, setSimpananForm] = useState({
    jumlah: "",
    jenis: "sukarela",
    catatan: "",
  });
  const [pinjamanForm, setPinjamanForm] = useState({
    jumlah: "",
    tenor: "3",
    tujuan: "",
    catatan: "",
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Try direct document match first
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data());
          setUserDocRef(docRef);
        } else {
          // Try to find by uid field
          const q = query(
            collection(db, "users"),
            where("uid", "==", user.uid)
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            setUserData(querySnapshot.docs[0].data());
            setUserDocRef(doc(db, "users", querySnapshot.docs[0].id));
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleSimpananChange = (e) => {
    const { name, value } = e.target;
    setSimpananForm({
      ...simpananForm,
      [name]: value,
    });
  };

  const handlePinjamanChange = (e) => {
    const { name, value } = e.target;
    setPinjamanForm({
      ...pinjamanForm,
      [name]: value,
    });
  };

  const handleSimpananSubmit = (e) => {
    e.preventDefault();
    // Placeholder for API call
    console.log("Simpanan form submitted:", simpananForm);
    alert("Pengajuan simpanan berhasil dikirim!");
    setSimpananForm({
      jumlah: "",
      jenis: "sukarela",
      catatan: "",
    });
  };

  const handlePinjamanSubmit = (e) => {
    e.preventDefault();
    // Placeholder for API call
    console.log("Pinjaman form submitted:", pinjamanForm);
    alert("Pengajuan pinjaman berhasil dikirim!");
    setPinjamanForm({
      jumlah: "",
      tenor: "3",
      tujuan: "",
      catatan: "",
    });
  };

  const handleUpdateToActiveStatus = async () => {
    if (!termsAgreed || !userDocRef) return;

    try {
      await updateDoc(userDocRef, {
        membershipStatus: "Pending",
        iuranPokok: 250000,
        iuranWajib: 25000,
        paymentStatus:
          userData.kantor === "Unipdu"
            ? "Payroll Deduction"
            : "Pending Verification",
      });

      // Update local state
      setUserData({
        ...userData,
        membershipStatus: "Pending",
        iuranPokok: 250000,
        iuranWajib: 25000,
        paymentStatus:
          userData.kantor === "Unipdu"
            ? "Payroll Deduction"
            : "Pending Verification",
      });

      setShowRegistrationModal(false);

      // Show success message
      alert(
        "Pendaftaran berhasil! Status keanggotaan Anda telah diubah menjadi Pending."
      );
    } catch (error) {
      console.error("Error updating membership status:", error);
      alert(
        "Terjadi kesalahan saat memperbarui status keanggotaan. Silakan coba lagi."
      );
    }
  };

  // Format currency input
  const formatCurrency = (value) => {
    if (!value) return "";
    return value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  if (loading) {
    return (
      <div className="member-content">
        <h2 className="page-title">Simpan/Pinjam</h2>
        <div className="loading-message">Memuat data...</div>
      </div>
    );
  }

  const isInactive = userData?.membershipStatus === "inactive";

  // If the user is inactive, show the inactive message
  if (isInactive) {
    return (
      <div className="member-content">
        <h2 className="page-title">Simpan/Pinjam</h2>

        <div className="info-card inactive-message-card">
          <h3 className="section-title">Layanan Tidak Tersedia</h3>
          <p className="inactive-message">
            Simpan/Pinjam hanya berlaku untuk anggota Aktif. Silakan daftar
            menjadi anggota aktif untuk mengakses fitur ini.
          </p>
          <button
            className="brutal-button primary-button"
            onClick={() => setShowRegistrationModal(true)}
          >
            Daftar Menjadi Anggota Aktif
          </button>
        </div>

        {/* Registration Modal/Bottom Sheet */}
        {showRegistrationModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowRegistrationModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Daftar Keanggotaan Aktif</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowRegistrationModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <p className="registration-info">
                  Dengan mendaftar sebagai anggota aktif, Anda akan mendapatkan
                  hak dan kewajiban sebagai anggota koperasi.
                </p>

                <div className="terms-agreement">
                  <div className="radio-container">
                    <input
                      type="checkbox"
                      id="termsAgreement"
                      checked={termsAgreed}
                      onChange={() => setTermsAgreed(!termsAgreed)}
                      className="brutal-checkbox"
                    />
                    <label htmlFor="termsAgreement" className="checkbox-label">
                      Saya bersedia menjadi anggota Koperasi dan menyetujui
                      persyaratan keanggotaan koperasi termasuk kesediaan
                      dipotong gaji untuk pembayaran iuran koperasi
                    </label>
                  </div>
                </div>

                <div className="fee-info">
                  <div className="fee-item">
                    <span>Iuran Pokok:</span>
                    <span className="fee-amount">Rp 250.000 (satu kali)</span>
                  </div>
                  <div className="fee-item">
                    <span>Iuran Wajib:</span>
                    <span className="fee-amount">Rp 25.000 / bulan</span>
                  </div>
                </div>

                <button
                  className={`brutal-button primary-button ${
                    !termsAgreed ? "button-disabled" : ""
                  }`}
                  onClick={handleUpdateToActiveStatus}
                  disabled={!termsAgreed}
                >
                  Daftar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Normal view for active or pending members
  return (
    <div className="member-content">
      <h2 className="page-title">Simpan/Pinjam</h2>

      <div className="tab-container">
        <div
          className={`tab-item ${activeTab === "simpanan" ? "active" : ""}`}
          onClick={() => setActiveTab("simpanan")}
        >
          Simpanan
        </div>
        <div
          className={`tab-item ${activeTab === "pinjaman" ? "active" : ""}`}
          onClick={() => setActiveTab("pinjaman")}
        >
          Pinjaman
        </div>
      </div>

      {activeTab === "simpanan" && (
        <div className="info-card">
          <h3 className="section-title">Ajukan Simpanan</h3>

          <form onSubmit={handleSimpananSubmit}>
            <div className="form-group">
              <label htmlFor="jenis">Jenis Simpanan</label>
              <select
                id="jenis"
                name="jenis"
                value={simpananForm.jenis}
                onChange={handleSimpananChange}
                className="form-input"
              >
                <option value="sukarela">Simpanan Sukarela</option>
                <option value="pendidikan">Simpanan Pendidikan</option>
                <option value="hari-raya">Simpanan Hari Raya</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="jumlah">Jumlah (Rp)</label>
              <div className="input-with-prefix">
                <span className="input-prefix">Rp</span>
                <input
                  id="jumlah"
                  name="jumlah"
                  type="text"
                  value={simpananForm.jumlah}
                  onChange={(e) => {
                    setSimpananForm({
                      ...simpananForm,
                      jumlah: formatCurrency(e.target.value),
                    });
                  }}
                  className="form-input"
                  required
                  placeholder="100.000"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="catatan">Catatan (opsional)</label>
              <textarea
                id="catatan"
                name="catatan"
                value={simpananForm.catatan}
                onChange={handleSimpananChange}
                className="form-input"
                rows="3"
                placeholder="Tambahkan catatan jika perlu"
              ></textarea>
            </div>

            <button type="submit" className="brutal-button primary-button">
              Ajukan Simpanan
            </button>
          </form>

          <div className="info-box">
            <h4>Informasi Simpanan</h4>
            <ul>
              <li>Simpanan Sukarela: Dapat diambil sewaktu-waktu</li>
              <li>Simpanan Pendidikan: Khusus untuk keperluan pendidikan</li>
              <li>
                Simpanan Hari Raya: Hanya dapat diambil menjelang hari raya
              </li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === "pinjaman" && (
        <div className="info-card">
          <h3 className="section-title">Ajukan Pinjaman</h3>

          <form onSubmit={handlePinjamanSubmit}>
            <div className="form-group">
              <label htmlFor="jumlah">Jumlah Pinjaman (Rp)</label>
              <div className="input-with-prefix">
                <span className="input-prefix">Rp</span>
                <input
                  id="jumlah"
                  name="jumlah"
                  type="text"
                  value={pinjamanForm.jumlah}
                  onChange={(e) => {
                    setPinjamanForm({
                      ...pinjamanForm,
                      jumlah: formatCurrency(e.target.value),
                    });
                  }}
                  className="form-input"
                  required
                  placeholder="1.000.000"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="tenor">Tenor (bulan)</label>
              <select
                id="tenor"
                name="tenor"
                value={pinjamanForm.tenor}
                onChange={handlePinjamanChange}
                className="form-input"
                required
              >
                <option value="3">3 bulan</option>
                <option value="6">6 bulan</option>
                <option value="12">12 bulan</option>
                <option value="24">24 bulan</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="tujuan">Tujuan Pinjaman</label>
              <input
                id="tujuan"
                name="tujuan"
                type="text"
                value={pinjamanForm.tujuan}
                onChange={handlePinjamanChange}
                className="form-input"
                required
                placeholder="Pendidikan, Kesehatan, dll."
              />
            </div>

            <div className="form-group">
              <label htmlFor="catatan">Catatan Tambahan</label>
              <textarea
                id="catatan"
                name="catatan"
                value={pinjamanForm.catatan}
                onChange={handlePinjamanChange}
                className="form-input"
                rows="3"
                placeholder="Informasi tambahan tentang pinjaman"
              ></textarea>
            </div>

            <button type="submit" className="brutal-button primary-button">
              Ajukan Pinjaman
            </button>
          </form>

          <div className="info-box">
            <h4>Ketentuan Pinjaman</h4>
            <ul>
              <li>Maksimal pinjaman: 5x jumlah simpanan</li>
              <li>Bunga pinjaman: 1% per bulan</li>
              <li>Denda keterlambatan: 0,5% dari angsuran</li>
              <li>Pengajuan akan diproses dalam 3 hari kerja</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberSimpanPinjam;
