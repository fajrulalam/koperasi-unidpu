import React from "react";

const PinjamanModal = ({
  showPinjamanModal,
  onClose,
  error,
  handlePinjamanSubmit,
  pinjamanForm,
  setPinjamanForm,
  formatCurrency,
  handlePinjamanChange,
  isSubmitting,
}) => {
  if (!showPinjamanModal) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Ajukan Pinjaman</h3>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

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
                  placeholder="1.000.000 - 10.000.000"
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
              >
                <option value="3">3 bulan</option>
                <option value="6">6 bulan</option>
                <option value="12">12 bulan</option>
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
                placeholder="Contoh: Pendidikan, Kesehatan, dll."
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="catatan">
                Catatan Tambahan (opsional, maks 500 karakter)
              </label>
              <textarea
                id="catatan"
                name="catatan"
                value={pinjamanForm.catatan}
                onChange={handlePinjamanChange}
                className="form-input"
                rows="3"
                placeholder="Tambahkan catatan jika diperlukan"
                maxLength="500"
                disabled={isSubmitting}
              />
              <div className="character-count">
                {pinjamanForm.catatan.length}/500 karakter
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="brutal-button secondary-button"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                type="submit"
                className="brutal-button primary-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Mengajukan..." : "Ajukan Pinjaman"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PinjamanModal;