// src/components/ImportMembersModal.js
import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import "../styles/ImportMembersModal.css";

const ImportMembersModal = ({ 
  isOpen, 
  onClose, 
  onImport,
  importProgress,
  totalRows,
  currentRow,
  isImporting
}) => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState([]);
  const [errors, setErrors] = useState([]);
  const [step, setStep] = useState("upload"); // upload, validation, preview, importing

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setData([]);
      setErrors([]);
      setStep("upload");
    }
  }, [isOpen]);

  // Update step based on import progress
  useEffect(() => {
    if (isImporting) {
      setStep("importing");
    }
  }, [isImporting]);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setFile(file);
      parseFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  });

  const parseFile = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Force text format for cells to prevent Excel from converting NIK to number
        XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0].forEach((header, idx) => {
          if (header === 'nik') {
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            for (let row = range.s.r + 1; row <= range.e.r; row++) {
              const cellRef = XLSX.utils.encode_cell({ r: row, c: idx });
              if (worksheet[cellRef]) {
                worksheet[cellRef].t = 's'; // Set cell type to string
              }
            }
          }
        });
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Get headers from first row
        const headers = jsonData[0];
        
        // Map data rows - clean apostrophes from NIK
        const rows = jsonData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, i) => {
            if (header === 'nik' && row[i]) {
              // Remove apostrophe at the beginning if present
              const nikValue = String(row[i]);
              obj[header] = nikValue.startsWith("'") ? nikValue.substring(1) : nikValue;
            } else {
              obj[header] = row[i] || '';
            }
          });
          return obj;
        });
        
        // Check for duplicate NIKs and emails within the imported data
        const { duplicateNiks, duplicateEmails } = findDuplicates(rows);
        
        // Prepare error messages
        const duplicateErrors = [];
        
        // Add NIK duplicate errors
        duplicateNiks.forEach(dup => {
          duplicateErrors.push({
            row: dup.index + 2, // +2 for header row and 0-indexing
            errors: {
              nik: `NIK duplikat terdeteksi pada baris: ${dup.duplicateIndexes.map(i => i + 2).join(', ')}`
            }
          });
        });
        
        // Add email duplicate errors
        duplicateEmails.forEach(dup => {
          duplicateErrors.push({
            row: dup.index + 2, // +2 for header row and 0-indexing
            errors: {
              email: `Email duplikat terdeteksi pada baris: ${dup.duplicateIndexes.map(i => i + 2).join(', ')}`
            }
          });
        });
        
        if (duplicateErrors.length > 0) {
          setErrors(duplicateErrors);
          setStep("validation");
          return;
        }
        
        setData(rows);
        validateData(rows);
      } catch (error) {
        setErrors([{ general: `Gagal memproses file: ${error.message}` }]);
        setStep("validation");
      }
    };
    
    reader.onerror = () => {
      setErrors([{ general: "Gagal membaca file. Silakan coba file lain." }]);
      setStep("validation");
    };
    
    reader.readAsArrayBuffer(file);
  };
  
  // Helper function to find duplicate NIKs and emails within the imported data
  const findDuplicates = (rows) => {
    const nikMap = new Map();
    const emailMap = new Map();
    const duplicateNiks = [];
    const duplicateEmails = [];
    
    rows.forEach((row, index) => {
      // Check for duplicate NIKs
      if (row.nik) {
        if (nikMap.has(row.nik)) {
          // Get existing indexes for this NIK
          const existingIndexes = nikMap.get(row.nik);
          existingIndexes.push(index);
          
          // Add to duplicates list if not already present
          if (!duplicateNiks.some(d => d.nik === row.nik)) {
            duplicateNiks.push({
              nik: row.nik,
              index: existingIndexes[0],
              duplicateIndexes: existingIndexes.slice(1)
            });
          }
        } else {
          // First occurrence of this NIK
          nikMap.set(row.nik, [index]);
        }
      }
      
      // Check for duplicate emails
      if (row.email) {
        if (emailMap.has(row.email.toLowerCase())) {
          // Get existing indexes for this email
          const existingIndexes = emailMap.get(row.email.toLowerCase());
          existingIndexes.push(index);
          
          // Add to duplicates list if not already present
          if (!duplicateEmails.some(d => d.email === row.email.toLowerCase())) {
            duplicateEmails.push({
              email: row.email.toLowerCase(),
              index: existingIndexes[0],
              duplicateIndexes: existingIndexes.slice(1)
            });
          }
        } else {
          // First occurrence of this email
          emailMap.set(row.email.toLowerCase(), [index]);
        }
      }
    });
    
    return { duplicateNiks, duplicateEmails };
  };

  const validateData = (rows) => {
    const validationErrors = [];
    
    rows.forEach((row, index) => {
      const rowErrors = {};
      
      // Required fields validation
      if (!row.nama) rowErrors.nama = "Nama wajib diisi";
      if (!row.email) rowErrors.email = "Email wajib diisi";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) rowErrors.email = "Format email tidak valid";
      
      // NIK validation
      if (!row.nik) rowErrors.nik = "NIK wajib diisi";
      else if (!/^\d{16}$/.test(row.nik.toString().replace(/\s/g, ''))) 
        rowErrors.nik = "NIK harus terdiri dari 16 digit angka";
      
      // WhatsApp validation
      if (!row.nomorWhatsapp) rowErrors.nomorWhatsapp = "Nomor WhatsApp wajib diisi";
      else {
        const cleaned = row.nomorWhatsapp.toString().replace(/\D/g, "");
        if (!(cleaned.startsWith("62") || cleaned.startsWith("08")))
          rowErrors.nomorWhatsapp = "Nomor WhatsApp harus diawali dengan +62, 62, atau 08";
      }
      
      // Kantor validation
      if (!row.kantor) rowErrors.kantor = "Kantor wajib diisi";
      else if (!["Unipdu", "SD Plus", "RS Unipdu Medika"].includes(row.kantor))
        rowErrors.kantor = "Kantor harus salah satu dari: Unipdu, SD Plus, atau RS Unipdu Medika";
      
      // Satuan Kerja validation
      if (row.kantor === "Unipdu" && !row.satuanKerja) 
        rowErrors.satuanKerja = "Satuan Kerja wajib diisi untuk karyawan Unipdu";
      
      // Payment Method validation
      if (!row.metodePembayaran) rowErrors.metodePembayaran = "Metode Pembayaran wajib diisi";
      else if (!["Payroll Deduction", "Yayasan Subsidy", "Transfer"].includes(row.metodePembayaran))
        rowErrors.metodePembayaran = "Metode Pembayaran harus salah satu dari: Payroll Deduction, Yayasan Subsidy, atau Transfer";
      
      if (Object.keys(rowErrors).length > 0) {
        validationErrors.push({
          row: index + 2, // +2 because index starts at 0 and we need to account for header row
          errors: rowErrors
        });
      }
    });
    
    setErrors(validationErrors);
    setStep(validationErrors.length > 0 ? "validation" : "preview");
  };

  const downloadTemplate = () => {
    // Create sample data with NIK as string format (with apostrophe)
    const data = [
      ['nama', 'email', 'nik', 'nomorWhatsapp', 'kantor', 'satuanKerja', 'metodePembayaran'],
      ['John Doe', 'john.doe@example.com', "'1234567890123456", '+6281234567890', 'Unipdu', 'BAA', 'Payroll Deduction']
    ];
    
    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Force text format for NIK column
    if (!ws['!cols']) ws['!cols'] = [];
    ws['!cols'][2] = { t: 's' }; // Set the NIK column (C) to text format
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    
    // Save file
    XLSX.writeFile(wb, "member_import_template.xlsx");
  };

  const handleImport = () => {
    onImport(data);
  };

  // Render different content based on current step
  const renderStepContent = () => {
    switch (step) {
      case "upload":
        return (
          <div className="import-step">
            <div {...getRootProps()} className="dropzone">
              <input {...getInputProps()} />
              {isDragActive ? (
                <p>Lepaskan file di sini...</p>
              ) : (
                <div className="dropzone-content">
                  <p>Seret dan lepaskan file di sini, atau klik untuk memilih</p>
                  <p className="dropzone-formats">Format yang didukung: CSV, XLSX, XLS</p>
                </div>
              )}
            </div>
            <div className="template-section">
              <p>Butuh template? Unduh file contoh dengan format yang benar:</p>
              <button className="template-button" onClick={downloadTemplate}>
                Unduh Template
              </button>
            </div>
          </div>
        );
        
      case "validation":
        return (
          <div className="import-step validation-step">
            <h3>Error Validasi</h3>
            <div className="error-list">
              {errors.map((error, index) => (
                <div key={index} className="error-item">
                  {error.general ? (
                    <p className="general-error">{error.general}</p>
                  ) : (
                    <>
                      <p className="error-row">Baris {error.row}:</p>
                      <ul>
                        {Object.entries(error.errors).map(([field, message]) => (
                          <li key={field}>
                            <strong>{field}:</strong> {message}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="action-buttons">
              <button className="back-button" onClick={() => setStep("upload")}>
                Kembali ke Unggah
              </button>
            </div>
          </div>
        );
        
      case "preview":
        return (
          <div className="import-step preview-step">
            <h3>Pratinjau Anggota ({data.length})</h3>
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>NIK</th>
                    <th>WhatsApp</th>
                    <th>Kantor</th>
                    <th>Satuan Kerja</th>
                    <th>Metode Pembayaran</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr key={index}>
                      <td>{row.nama}</td>
                      <td>{row.email}</td>
                      <td>{row.nik}</td>
                      <td>{row.nomorWhatsapp}</td>
                      <td>{row.kantor}</td>
                      <td>{row.satuanKerja || "-"}</td>
                      <td>{row.metodePembayaran}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="action-buttons">
              <button className="back-button" onClick={() => setStep("upload")}>
                Kembali ke Unggah
              </button>
              <button className="import-button" onClick={handleImport}>
                Import {data.length} Anggota
              </button>
            </div>
          </div>
        );
        
      case "importing":
        return (
          <div className="import-step importing-step">
            <h3>Mengimpor Anggota...</h3>
            <div className="import-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(currentRow / totalRows) * 100}%` }}
                ></div>
              </div>
              <p className="progress-text">
                {currentRow} dari {totalRows} anggota diimpor
              </p>
            </div>
            <p className="import-warning">
              Mohon jangan tutup jendela ini atau navigasi ke halaman lain selama proses impor.
            </p>
          </div>
        );
        
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="import-modal">
        <div className="modal-header">
          <h3>Import Anggota</h3>
          {step !== "importing" && (
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        <div className="modal-content">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
};

export default ImportMembersModal;