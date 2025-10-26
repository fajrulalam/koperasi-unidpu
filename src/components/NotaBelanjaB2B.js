import React, { useState, useEffect } from "react";
import {
  FaFileInvoice,
  FaUpload,
  FaEye,
  FaCheck,
  FaClock,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import "../styles/NotaBelanjaB2B.css";
import { useAuth } from "../context/AuthContext";
import { useFirestore } from "../context/FirestoreContext";
import { uploadFile } from "../firebase";

// Helper function for currency formatting
function formatRupiah(value) {
  if (!value) return "0";
  const numeric = value.toString().replace(/\D/g, "");
  if (!numeric) return "0";
  return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Helper function to format date in Indonesian
function formatIndonesianDate(dateString) {
  if (!dateString) return "N/A";

  const date =
    typeof dateString === "string"
      ? new Date(dateString)
      : dateString.toDate?.();
  if (!date || isNaN(date.getTime())) return "N/A";

  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${day} ${month} ${year}`;
}

const NotaBelanjaB2B = () => {
  const { currentUser, userRole } = useAuth();
  const { queryCollection, updateDoc } = useFirestore();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [expandedRecords, setExpandedRecords] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // Check permissions
  const canUploadBuktiTransfer = userRole === "BAK";

  // Fetch nota belanja records
  const fetchRecords = async () => {
    try {
      const recordsData = await queryCollection("notaBelanja_b2b");
      // Sort by createdAt descending (newest first)
      const sortedRecords = recordsData.sort((a, b) => {
        const dateA =
          typeof a.createdAt === "string"
            ? new Date(a.createdAt)
            : a.createdAt?.toDate?.() || new Date(0);
        const dateB =
          typeof b.createdAt === "string"
            ? new Date(b.createdAt)
            : b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      setRecords(sortedRecords);
    } catch (error) {
      console.error("Error fetching records:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total from items array
  const calculateTotal = (items) => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((total, item) => {
      return total + (item.subtotal || 0);
    }, 0);
  };

  // Get status display
  const getStatusDisplay = (record) => {
    const { process } = record;

    if (process?.transferBAK?.completed) {
      return {
        text: "Selesai",
        color: "#28a745",
        bgColor: "#d4edda",
        textColor: "#155724",
        icon: <FaCheck />,
      };
    } else {
      return {
        text: "Nota dibuat",
        color: "#ffc107",
        bgColor: "#fff3cd",
        textColor: "#856404",
        icon: <FaClock />,
      };
    }
  };

  // File upload handler
  const handleFileUpload = async (recordId, file) => {
    const uploadKey = `${recordId}_bukti_transfer`;

    try {
      setUploadingFiles((prev) => ({ ...prev, [uploadKey]: true }));

      // Generate file path
      const timestamp = Date.now();
      const fileExtension = file.name.split(".").pop();
      const fileName = `${recordId}_bukti_transfer_${timestamp}.${fileExtension}`;
      const filePath = `nota_belanja_b2b/bukti_transfer/${fileName}`;

      // Upload file to Firebase Storage
      const downloadURL = await uploadFile(file, filePath);

      // Update process status
      const updateData = {
        "process.transferBAK": {
          completed: true,
          completedAt: new Date(),
          fileName: file.name,
          originalFileName: file.name,
          storagePath: filePath,
          downloadURL: downloadURL,
          uploadedBy: {
            email: currentUser?.email || "unknown",
            uid: currentUser?.uid || "unknown",
          },
        },
        status: "completed",
      };

      await updateDoc("notaBelanja_b2b", recordId, updateData);
      await fetchRecords();

      setSnackbar({
        open: true,
        message: "Bukti transfer berhasil diupload!",
      });

      setTimeout(() => {
        setSnackbar({ open: false, message: "" });
      }, 3000);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file: " + error.message);
    } finally {
      setUploadingFiles((prev) => {
        const newState = { ...prev };
        delete newState[uploadKey];
        return newState;
      });
    }
  };

  // Handle viewing files
  const handleViewFile = (fileInfo) => {
    if (fileInfo?.downloadURL) {
      window.open(fileInfo.downloadURL, "_blank");
    } else {
      alert("File not available");
    }
  };

  // Handle viewing nota document
  const handleViewNota = (record) => {
    if (record.downloadURL) {
      window.open(record.downloadURL, "_blank");
    } else {
      alert("Nota document not available");
    }
  };

  // Toggle record expansion
  const toggleExpanded = (recordId) => {
    setExpandedRecords((prev) => ({
      ...prev,
      [recordId]: !prev[recordId],
    }));
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Calculate pagination
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = records.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(records.length / recordsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return <div className="nota-belanja-b2b-loading">Memuat...</div>;
  }

  return (
    <div className="nota-belanja-b2b-container">
      <div className="nota-belanja-b2b-header">
        <h1>Nota Belanja B2B</h1>
      </div>

      <div className="nota-belanja-b2b-records">
        {records.length === 0 ? (
          <div className="nota-belanja-b2b-empty">
            <p>Tidak ada nota belanja B2B ditemukan.</p>
          </div>
        ) : (
          <>
            {currentRecords.map((record) => {
              const statusDisplay = getStatusDisplay(record);
              const total = calculateTotal(record.items);
              const isExpanded = expandedRecords[record.id];

              return (
                <div key={record.id} className="nota-belanja-b2b-record-tile">
                  <div className="record-header">
                    <div className="record-main-info">
                      <div className="record-title-row">
                        <h3 className="supplier-name">
                          {record.supplierName || "Unknown Supplier"}
                        </h3>
                      </div>
                      <div className="record-metadata">
                        <span className="record-date">
                          {formatIndonesianDate(record.createdAt)}
                        </span>
                        <span className="record-id">ID: {record.id}</span>
                      </div>
                    </div>
                    <div className="record-right-side">
                      <span
                        className="status-tag"
                        style={{
                          backgroundColor: statusDisplay.bgColor,
                          color: statusDisplay.textColor,
                          border: `1px solid ${statusDisplay.color}`,
                        }}
                      >
                        {statusDisplay.icon}
                        {statusDisplay.text}
                      </span>
                      <div className="total-price-badge">
                        Rp {formatRupiah(total.toString())}
                      </div>
                    </div>
                  </div>

                  <div className="action-row">
                    {/* View Nota Button */}
                    <button
                      className="action-btn completed"
                      onClick={() => handleViewNota(record)}
                    >
                      <FaFileInvoice /> Lihat Nota
                    </button>

                    {/* Bukti Transfer Button */}
                    {uploadingFiles[`${record.id}_bukti_transfer`] ? (
                      <button className="action-btn loading" disabled>
                        <div className="loading-spinner"></div> Mengunggah...
                      </button>
                    ) : record.process?.transferBAK?.completed ? (
                      <button
                        className="action-btn completed"
                        onClick={() =>
                          handleViewFile(record.process.transferBAK)
                        }
                      >
                        <FaEye /> Lihat Bukti Transfer
                      </button>
                    ) : canUploadBuktiTransfer ? (
                      <label className="action-btn active">
                        <FaUpload /> Upload Bukti Transfer
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            if (e.target.files[0]) {
                              handleFileUpload(record.id, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    ) : (
                      <button className="action-btn disabled" disabled>
                        <FaUpload /> Upload Bukti Transfer
                      </button>
                    )}

                    {/* Toggle Details Button */}
                    <button
                      className="action-btn toggle"
                      onClick={() => toggleExpanded(record.id)}
                    >
                      {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      {isExpanded ? "Sembunyikan" : "Detail"} Items
                    </button>
                  </div>

                  {/* Expanded Items Details */}
                  {isExpanded && (
                    <div className="items-detail">
                      <h4>Detail Items:</h4>
                      <div className="items-list">
                        {record.items && record.items.length > 0 ? (
                          record.items.map((item, index) => (
                            <div key={index} className="item-row">
                              <div className="item-info">
                                <span className="item-name">
                                  {item.itemName}
                                </span>
                                <span className="item-quantity">
                                  {item.quantity} {item.unit}
                                </span>
                              </div>
                              <div className="item-price">
                                <span className="unit-price">
                                  @Rp{" "}
                                  {formatRupiah((item.price || 0).toString())}
                                </span>
                                <span className="subtotal">
                                  Rp{" "}
                                  {formatRupiah(
                                    (item.subtotal || 0).toString()
                                  )}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p>Tidak ada items tersedia</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="nota-belanja-b2b-pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    opacity: currentPage === 1 ? 0.5 : 1,
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  &laquo; Previous
                </button>

                <div className="pagination-numbers">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => {
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 1 &&
                          pageNum <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            className={`pagination-number ${
                              pageNum === currentPage ? "active" : ""
                            }`}
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === currentPage - 2 ||
                        pageNum === currentPage + 2
                      ) {
                        return (
                          <span key={pageNum} className="pagination-ellipsis">
                            ...
                          </span>
                        );
                      }
                      return null;
                    }
                  )}
                </div>

                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    cursor:
                      currentPage === totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  Next &raquo;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Snackbar */}
      {snackbar.open && (
        <div className="nota-belanja-b2b-snackbar">{snackbar.message}</div>
      )}
    </div>
  );
};

export default NotaBelanjaB2B;
