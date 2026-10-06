# UniMart POS & Stock Management System

A modern Point of Sale (POS) and Inventory/Stock management application designed for **UniMart (Koperasi Unipdu)**. Built with React, Vanilla CSS/Tailwind, and integrated with Firebase.

---

## 🚀 Features

### 🛒 Point of Sale (POS)
* **Smooth Checkout Flow**: Process purchases with support for cash payments, discount vouchers, and membership identification.
* **Smart Voucher Management**: Support for both single-use campaign vouchers and **multi-use balance vouchers** (tracking starting balances, applied discounts, and remaining balances).
* **Thermal Receipt Printing**: Custom-styled receipt formatting (`11px` monospace layout) optimized for 80mm thermal printers with automatic browser print triggers and electron printing server support.

### 💰 Arus Kas (Cashflow)
Replicated from the 375 POS cashflow statement. Unimart money is tracked in three accounts:
* **Cash** – physical money received at the counter.
* **QRIS** – online / e-money payments.
* **Kredit** – voucher redemptions; the sale is made now but the money arrives later.

The checkout dialog records how each sale splits across the accounts (`cashAmount`, `qrisAmount`, `kreditAmount` on `transactionDetail`). At the end of the day the cashier opens **Laporan Harian** on the POS page and enters the Cash and QRIS received; the system compares them with that day's sales minus drawer expenses (**Catat Pengeluaran**) and stores the result in `dailyFinancialReports`.

The **Finance** page shows the monthly ledger per account (opening balance, sales, discrepancy, expenses, transfers, anchor adjustments, closing balance) with PDF export. Directors, Wakil Rektor 2 and Admins can edit the opening balance, confirm or correct discrepancies, anchor balances, edit expenses and record transfers such as settling Kredit into Cash. Legacy *Tutup Buku* closings can be imported once from the Finance page.

**Pembelian Grosir** (Unimart stock page) has a *Dibayar dari* picker: Cash, QRIS or Kredit. Each submitted purchase is recorded as one expense for the purchase total (`addedFrom: "bulkPurchase"`, linked by `bulkPurchaseId`) and appears in the Finance ledger under the chosen account. These expenses are back-office spending, so they are not part of the cashier's end-of-day drawer count in **Laporan Harian**. Warehouse (B2B) purchases do not create expenses.

Collections: `dailyFinancialReports`, `expenses`, `cashflowTransfers`, `cashflowSettings` (each with a `_testing` twin).

### 📦 Inventory & Stock Control
* **Flexible Multi-Unit Relationships**: Supports base units (e.g., `pcs`, `rim`) and bulk conversion relationships (e.g., `dus`, `pack`, `rim`) with automatic pro-rated pricing logic.
* **Interactive stock adjustments**: Modern compact modals for increasing, resetting, or editing warehouse stock values.
* **Row-Level Highlights (Tandai)**: Highlight problematic or low-stock items with a soft yellow warning background directly from the stock action menu.
* **Pro-rated bulk pricing calculator**: Instantly calculates and displays unit prices when creating or modifying bulk conversions (e.g. showing `PACK (Rp 100/pcs)` dynamically).

### 💳 Payroll-linked Simpan Pinjam
* Internal-BAK previews every eligible payable loan while a payroll draft is
  saved. The original loan remains payable while its restructuring request is
  pending; the proposed replacement stays excluded until approval. The sealed
  loan plan must equal the employee's Koperasi loan deduction.
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
