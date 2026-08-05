# UniMart POS & Stock Management System

A modern Point of Sale (POS) and Inventory/Stock management application designed for **UniMart (Koperasi Unipdu)**. Built with React, Vanilla CSS/Tailwind, and integrated with Firebase.

---

## 🚀 Features

### 🛒 Point of Sale (POS)
* **Smooth Checkout Flow**: Process purchases with support for cash payments, discount vouchers, and membership identification.
* **Smart Voucher Management**: Support for both single-use campaign vouchers and **multi-use balance vouchers** (tracking starting balances, applied discounts, and remaining balances).
* **Thermal Receipt Printing**: Custom-styled receipt formatting (`11px` monospace layout) optimized for 80mm thermal printers with automatic browser print triggers and electron printing server support.

### 📦 Inventory & Stock Control
* **Flexible Multi-Unit Relationships**: Supports base units (e.g., `pcs`, `rim`) and bulk conversion relationships (e.g., `dus`, `pack`, `rim`) with automatic pro-rated pricing logic.
* **Interactive stock adjustments**: Modern compact modals for increasing, resetting, or editing warehouse stock values.
* **Row-Level Highlights (Tandai)**: Highlight problematic or low-stock items with a soft yellow warning background directly from the stock action menu.
* **Pro-rated bulk pricing calculator**: Instantly calculates and displays unit prices when creating or modifying bulk conversions (e.g. showing `PACK (Rp 100/pcs)` dynamically).

### 💳 Payroll-linked Simpan Pinjam
* Internal-BAK previews every eligible active loan while a payroll draft is
  saved. The sealed loan plan must equal the employee's Koperasi loan deduction.
* **Verifikasi & Kunci** advances all loans in that employee's sealed plan in
  one Firestore transaction. Deterministic period/loan markers make retries and
  concurrent manual actions safe from duplicate installments.
* A final installment records both `Pembayaran Cicilan` and `Lunas`, sets the
  balance to zero, and records the completion time automatically.
* Manual **Cicil** uses the same secured transition and requires an explicit
  payroll month. Its default is the previous month through Jakarta day 5 and
  the current month from day 6.

---

## 🛠️ Tech Stack
* **Frontend**: React (Create React App), Context API
* **Styling**: Tailwind CSS & Vanilla CSS (Icons via React Icons)
* **Backend Database**: Firebase Firestore (Environment-aware collections)
* **Deployment**: Firebase Hosting & Cloud Functions

---

## 💻 Available Scripts

In the project directory, you can run:

### `npm run dev` / `npm start`
Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm run build`
Builds the app for production in the `build/` directory, optimizing files for performance.

### `./deploy.sh`
Deploys the production build to Firebase hosting and redeploys the receipt-printing Firebase Cloud Functions.

### Payroll bridge deployment

The server bridge requires Node 20 and a shared HMAC secret of at least 32
characters. Store the same value in Internal-BAK's server-only App Hosting
secret; never place it in a `REACT_APP_*` variable.

```bash
firebase functions:secrets:set INTERNAL_PAYROLL_HMAC_SECRET
firebase deploy --only functions:payrollLoanBridge,functions:recordManualLoanInstallment
npm run build
firebase deploy --only hosting
```

Deploy the bridge functions before Internal-BAK. During rollout, preview and
resave all open-period payroll drafts and resolve ambiguous borrower matches or
deduction mismatches before closing the period.

---

## 📁 Repository Structure
* `/src/components`: UI views (Inventory, Transactions, Modals)
* `/src/services`: Service handlers (Firestore read/write wrappers, Voucher management, Print server logic)
* `/src/utils`: Number/currency formatting utilities
* `/functions`: Firebase Cloud Functions for backend server integrations
* `/print-server`: Print server runtime helper configurations
