// src/components/DaftarAnggotaBaru.js
import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { db, getEnvironmentCollection } from "../firebase";
import "../styles/DaftarAnggotaBaru.css";

const DaftarAnggotaBaru = ({ isProduction = true }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editMemberData, setEditMemberData] = useState(null);

  const statusOptions = [
    { value: "all", label: "Semua Status" },
    { value: "approved", label: "Approved" },
    { value: "Pending", label: "Pending" },
    { value: "inactive", label: "Non Aktif" },
    { value: "rejected", label: "Ditolak" },
  ];

  const satuanKerjaOptions = [
    "BAA",
    "BAK",
    "BAKM",
    "BU",
    "FAI",
    "FBBP",
    "FIK",
    "HUMAS",
    "LPPM",
    "PASCA",
    "PERPUS",
    "PJM",
    "PMB",
    "PSA",
    "PSB",
    "PSQ",
    "PSW",
    "PUSKOMNET",
    "REKTORAT",
    "SAINTEK",
    "SDM",
  ];

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true);
      try {
        // Get all members, not just pending ones
        const q = query(collection(db, "users"), where("role", "==", "Member"));

        const querySnapshot = await getDocs(q);
        const membersData = [];

        querySnapshot.forEach((doc) => {
          // Convert Firestore timestamp to Date if it exists
          const data = doc.data();
          if (data.createdAt && data.createdAt.toDate) {
            data.createdAt = data.createdAt.toDate();
          }

          membersData.push({
            id: doc.id,
            ...data,
          });
        });

        // Sort by creation date (newest first)
        membersData.sort((a, b) => {
          return b.createdAt - a.createdAt;
        });

        setMembers(membersData);
      } catch (error) {
        console.error("Error fetching members:", error);
        setError("Gagal memuat data anggota. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [isProduction]);

  const handleViewMember = (member) => {
    setSelectedMember(member);
    setShowViewModal(true);
  };

  const handleEditMember = (member) => {
    setSelectedMember(member);
    setEditMemberData({
      ...member,
      // Make a copy to prevent modifying the original
    });
    setShowEditModal(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditMemberData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveEditedMember = async () => {
    if (!editMemberData) return;

    setActionLoading(true);
    try {
      // Update user in Firestore
      const userRef = doc(db, "users", selectedMember.id);
      await updateDoc(userRef, {
        nama: editMemberData.nama,
        kantor: editMemberData.kantor,
        satuanKerja: editMemberData.satuanKerja || "",
        nomorWhatsapp: editMemberData.nomorWhatsapp,
        membershipStatus: editMemberData.membershipStatus,
        iuranPokok: Number(editMemberData.iuranPokok) || 0,
        iuranWajib: Number(editMemberData.iuranWajib) || 0,
      });

      // Update local state
      setMembers((prev) =>
        prev.map((member) =>
          member.id === selectedMember.id
            ? { ...member, ...editMemberData }
            : member
        )
      );

      // Show success message
      alert("Data anggota berhasil diperbarui");

      // Close modal
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating member:", error);
      alert("Gagal memperbarui data anggota. Silakan coba lagi.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveReject = async (action) => {
    if (!selectedMember) return;

    setActionLoading(true);
    try {
      // Update user membership status in Firestore
      const userRef = doc(db, "users", selectedMember.id);
      const newStatus = action === "approve" ? "approved" : "rejected";

      await updateDoc(userRef, {
        membershipStatus: newStatus,
      });

      // Update local state
      setMembers((prev) =>
        prev.map((member) =>
          member.id === selectedMember.id
            ? { ...member, membershipStatus: newStatus }
            : member
        )
      );

      // Update the selected member for the modal display
      setSelectedMember({
        ...selectedMember,
        membershipStatus: newStatus,
      });

      // Show success message
      const successMessage =
        action === "approve"
          ? "Anggota berhasil disetujui"
          : "Anggota berhasil ditolak";

      alert(successMessage);

      // Don't close modal - user can still see the details
    } catch (error) {
      console.error(
        `Error ${action === "approve" ? "approving" : "rejecting"} member:`,
        error
      );
      alert(
        `Gagal ${
          action === "approve" ? "menyetujui" : "menolak"
        } anggota. Silakan coba lagi.`
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Generate WhatsApp message with approval or rejection
  const getWhatsAppUrl = (phoneNumber, isApproved) => {
    // Clean the phone number (remove any non-digit characters)
    const cleanNumber = phoneNumber.replace(/\D/g, "");

    // Add country code if not present
    const formattedNumber = cleanNumber.startsWith("62")
      ? cleanNumber
      : cleanNumber.startsWith("0")
      ? `62${cleanNumber.substring(1)}`
      : `62${cleanNumber}`;

    const message = isApproved
      ? "Pendaftaran Anda sebagai anggota Koperasi Unipdu telah disetujui. Terima kasih telah bergabung dengan kami."
      : "Mohon maaf, pendaftaran Anda sebagai anggota Koperasi Unipdu belum dapat disetujui. Silakan hubungi admin untuk informasi lebih lanjut.";

    return `https://wa.me/${formattedNumber}?text=${encodeURIComponent(
      message
    )}`;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Format date object to readable string
  const formatDate = (dateString) => {
    try {
      const date = dateString ? new Date(dateString) : null;
      return date ? date.toLocaleDateString("id-ID") : "-";
    } catch (error) {
      console.error("Error formatting date:", error);
      return "-";
    }
  };

  // Filter members based on search term and status filter
  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      member.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.nomorWhatsapp?.includes(searchTerm) ||
      member.kantor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.satuanKerja?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || member.membershipStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="loading">Memuat data...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="daftar-anggota-container">
      <h1>Daftar Anggota</h1>

      {/* Search and Filter */}
      <div className="filter-container">
        <div className="search-box">
          <input
            type="text"
            placeholder="Cari nama, whatsapp, kantor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="status-filter">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <div className="empty-state">
          <p>Tidak ada anggota yang ditemukan.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="members-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kantor</th>
                <th>Satuan Kerja</th>
                <th>WhatsApp</th>
                <th>Iuran Pokok</th>
                <th>Iuran Wajib</th>
                <th>Status Pembayaran</th>
                <th>Status Keanggotaan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id}>
                  <td>{member.nama || "-"}</td>
                  <td>{member.kantor || "-"}</td>
                  <td>{member.satuanKerja || "-"}</td>
                  <td>{member.nomorWhatsapp || "-"}</td>
                  <td>{formatCurrency(member.iuranPokok)}</td>
                  <td>{formatCurrency(member.iuranWajib)}</td>
                  <td>{member.paymentStatus || "-"}</td>
                  <td>
                    <span
                      className={`status-badge ${member.membershipStatus?.toLowerCase()}`}
                    >
                      {member.membershipStatus || "-"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {member.membershipStatus === "Pending" ? (
                        <button
                          className="review-button"
                          onClick={() => handleViewMember(member)}
                        >
                          Tinjau
                        </button>
                      ) : (
                        <button
                          className="edit-button"
                          onClick={() => handleEditMember(member)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View/Approval Modal */}
      {showViewModal && selectedMember && (
        <div className="modal-backdrop">
          <div className="member-modal">
            <div className="modal-header">
              <h3>Detail Anggota</h3>
              <button
                className="modal-close"
                onClick={() => setShowViewModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="member-detail-grid">
                <div className="detail-item">
                  <strong>Nama:</strong>
                  <span>{selectedMember.nama || "-"}</span>
                </div>

                <div className="detail-item">
                  <strong>NIK:</strong>
                  <span>{selectedMember.nik || "-"}</span>
                </div>

                <div className="detail-item">
                  <strong>Kantor:</strong>
                  <span>{selectedMember.kantor || "-"}</span>
                </div>

                <div className="detail-item">
                  <strong>Satuan Kerja:</strong>
                  <span>{selectedMember.satuanKerja || "-"}</span>
                </div>

                <div className="detail-item">
                  <strong>Email:</strong>
                  <span>{selectedMember.email || "-"}</span>
                </div>

                <div className="detail-item">
                  <strong>WhatsApp:</strong>
                  <span>{selectedMember.nomorWhatsapp || "-"}</span>
                </div>

                <div className="detail-item">
                  <strong>Tanggal Registrasi:</strong>
                  <span>{formatDate(selectedMember.registrationDate)}</span>
                </div>

                <div className="detail-item">
                  <strong>Status Pembayaran:</strong>
                  <span>{selectedMember.paymentStatus || "-"}</span>
                </div>

                <div className="detail-item">
                  <strong>Iuran Pokok:</strong>
                  <span>{formatCurrency(selectedMember.iuranPokok)}</span>
                </div>

                <div className="detail-item">
                  <strong>Iuran Wajib:</strong>
                  <span>{formatCurrency(selectedMember.iuranWajib)}</span>
                </div>

                <div className="detail-item">
                  <strong>Status Keanggotaan:</strong>
                  <span
                    className={`status-badge ${selectedMember.membershipStatus?.toLowerCase()}`}
                  >
                    {selectedMember.membershipStatus || "-"}
                  </span>
                </div>
              </div>

              {/* Payment Proof (if exists) */}
              {selectedMember.paymentProof && (
                <div className="payment-proof-section">
                  <h4>Bukti Pembayaran</h4>
                  <a
                    href={selectedMember.paymentProof}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="payment-link"
                  >
                    Lihat Bukti Pembayaran
                  </a>
                </div>
              )}

              {/* Action buttons for pending members */}
              {selectedMember.membershipStatus === "Pending" && (
                <div className="modal-actions">
                  <button
                    className="reject-button"
                    onClick={() => handleApproveReject("reject")}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Memproses..." : "Tolak"}
                  </button>

                  <button
                    className="approve-button"
                    onClick={() => handleApproveReject("approve")}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Memproses..." : "Setujui"}
                  </button>
                </div>
              )}

              {/* WhatsApp button for sending messages */}
              {(selectedMember.membershipStatus === "approved" ||
                selectedMember.membershipStatus === "rejected") && (
                <div className="whatsapp-section">
                  <a
                    href={getWhatsAppUrl(
                      selectedMember.nomorWhatsapp,
                      selectedMember.membershipStatus === "approved"
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whatsapp-button"
                  >
                    Hubungi via WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {showEditModal && editMemberData && (
        <div className="modal-backdrop">
          <div className="member-modal">
            <div className="modal-header">
              <h3>Edit Anggota</h3>
              <button
                className="modal-close"
                onClick={() => setShowEditModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="edit-form">
                <div className="form-group">
                  <label>Nama</label>
                  <input
                    type="text"
                    name="nama"
                    value={editMemberData.nama || ""}
                    onChange={handleEditInputChange}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Kantor</label>
                  <select
                    name="kantor"
                    value={editMemberData.kantor || ""}
                    onChange={handleEditInputChange}
                    className="form-input"
                  >
                    <option value="">Pilih Kantor</option>
                    <option value="Unipdu">Unipdu</option>
                    <option value="SD Plus">SD Plus</option>
                    <option value="RS Unipdu Medika">RS Unipdu Medika</option>
                  </select>
                </div>

                {/* Show Satuan Kerja only for Unipdu employees */}
                {editMemberData.kantor === "Unipdu" && (
                  <div className="form-group">
                    <label>Satuan Kerja</label>
                    <select
                      name="satuanKerja"
                      value={editMemberData.satuanKerja || ""}
                      onChange={handleEditInputChange}
                      className="form-input"
                    >
                      <option value="">Pilih Satuan Kerja</option>
                      {satuanKerjaOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>WhatsApp</label>
                  <input
                    type="text"
                    name="nomorWhatsapp"
                    value={editMemberData.nomorWhatsapp || ""}
                    onChange={handleEditInputChange}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Iuran Pokok</label>
                  <input
                    type="number"
                    name="iuranPokok"
                    value={editMemberData.iuranPokok || 0}
                    onChange={handleEditInputChange}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Iuran Wajib</label>
                  <input
                    type="number"
                    name="iuranWajib"
                    value={editMemberData.iuranWajib || 0}
                    onChange={handleEditInputChange}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Status Keanggotaan</label>
                  <select
                    name="membershipStatus"
                    value={editMemberData.membershipStatus || ""}
                    onChange={handleEditInputChange}
                    className="form-input"
                  >
                    <option value="approved">Approved</option>
                    <option value="Pending">Pending</option>
                    <option value="inactive">Non Aktif</option>
                    <option value="rejected">Rejected</option>
                    <option value="removed">Removed</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="cancel-button"
                  onClick={() => setShowEditModal(false)}
                >
                  Batal
                </button>

                <button
                  className="save-button"
                  onClick={saveEditedMember}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DaftarAnggotaBaru;
