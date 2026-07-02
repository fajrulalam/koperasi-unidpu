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

---

## 📁 Repository Structure
* `/src/components`: UI views (Inventory, Transactions, Modals)
* `/src/services`: Service handlers (Firestore read/write wrappers, Voucher management, Print server logic)
* `/src/utils`: Number/currency formatting utilities
* `/functions`: Firebase Cloud Functions for backend server integrations
* `/print-server`: Print server runtime helper configurations
