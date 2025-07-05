// src/components/Transaksi.js
import React, { useState, useEffect, useRef } from "react";
import "../styles/Transaksi.css";
import { useAuth } from "../context/AuthContext";
import { useFirestore } from "../context/FirestoreContext";
import { useEnvironment } from "../context/EnvironmentContext";
import { printReceipt as printerServicePrint } from '../services/PrinterService';
import PaymentModal from './PaymentModal';
import { 
  convertToSmallestUnit, 
  convertFromSmallestUnit, 
  formatCurrency, 
  formatNumber, 
  getInitialQuantity, 
  getIncrement, 
  getBarcodeIncrement, 
  validateVoucher,
  CONVERSION_TABLE 
} from '../utils/transaksiUtils';

// Utility function to set local print server URL (can be called from settings)
export const setLocalPrintServer = (url = 'http://localhost:9001') => {
  localStorage.setItem('localPrintServerUrl', url);
  console.log(`Local print server URL saved: ${url}`);
};



// Import the necessary escpos modules at the top of the file
// import escpos from 'escpos';
// import USB from 'escpos-usb';
// escpos.USB = USB;

// Function to print receipt - note that setSnackbar is passed as a parameter
// The printer service is imported at the top of the file

const printReceipt = async (transactionId, items, total, amountPaid, change, setSnackbarFn) => {
  try {
    // Get current date and time
    const now = new Date();
    const dateTimeStr = now.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' ' + now.toLocaleTimeString('id-ID');

    // Create receipt data model
    const receiptData = {
      header: {
        storeName: "UniMart • Unipdu Mart",
        storeAddress: "Kompleks Pondok Pesantren Darul Ulum",
        storeCity: "Jombang, Jawa Timur",
        title: "Struk Pembelian"
      },
      info: {
        transactionId: transactionId,
        dateTime: dateTimeStr
      },
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.satuan,
        price: item.price,
        subtotal: item.subtotal
      })),
      summary: {
        total: total,
        amountPaid: parseInt(amountPaid.replace(/\D/g, ""), 10) || 0,
        change: change
      }
    };

    // Use the PrinterService to handle printing logic
    // It will attempt direct local printing first, then fall back to browser printing
    console.log("Attempting to print receipt...");

    const success = await printerServicePrint(receiptData);

    if (!success) {
      console.warn("All printing methods failed");
      if (typeof setSnackbarFn === 'function') {
        setSnackbarFn({
          open: true,
          message: "Gagal mencetak struk. Periksa koneksi printer.",
          severity: "warning"
        });
      }
    }
  } catch (error) {
    console.error("Error printing receipt:", error);
    // Use the passed snackbar function if available
    if (typeof setSnackbarFn === 'function') {
      setSnackbarFn({
        open: true,
        message: `Error mencetak struk: ${error.message}`,
        severity: "error"
      });
    }
  }
};

// Enhanced receipt printing function with voucher support
const printReceiptWithVoucher = async (receiptData, setSnackbarFn) => {
  try {
    const { transactionId, items, total, amountPaid, change, appliedVoucher } = receiptData;
    
    // Get current date and time
    const now = new Date();
    const dateTimeStr = now.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' ' + now.toLocaleTimeString('id-ID');

    // Create receipt data model with voucher support
    const receiptItems = items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.satuan,
      price: item.price,
      subtotal: item.subtotal
    }));

    // Add voucher as an item if applied
    if (appliedVoucher) {
      receiptItems.push({
        name: appliedVoucher.name,
        quantity: 1,
        unit: "",
        price: -appliedVoucher.value,
        subtotal: -appliedVoucher.value
      });
    }

    const receiptDataModel = {
      header: {
        storeName: "UniMart • Unipdu Mart",
        storeAddress: "Kompleks Pondok Pesantren Darul Ulum",
        storeCity: "Jombang, Jawa Timur",
        title: "Struk Pembelian"
      },
      info: {
        transactionId: transactionId,
        dateTime: dateTimeStr
      },
      items: receiptItems,
      summary: {
        total: appliedVoucher ? Math.max(0, total - appliedVoucher.value) : total,
        amountPaid: parseInt(amountPaid.replace(/\D/g, ""), 10) || 0,
        change: change
      }
    };

    // Use the PrinterService to handle printing logic
    console.log("Attempting to print receipt with voucher...");

    const success = await printerServicePrint(receiptDataModel);

    if (!success) {
      console.warn("All printing methods failed");
      if (typeof setSnackbarFn === 'function') {
        setSnackbarFn({
          open: true,
          message: "Gagal mencetak struk. Periksa koneksi printer.",
          severity: "warning"
        });
      }
    }
  } catch (error) {
    console.error("Error printing receipt:", error);
    if (typeof setSnackbarFn === 'function') {
      setSnackbarFn({
        open: true,
        message: `Error mencetak struk: ${error.message}`,
        severity: "error"
      });
    }
  }
};


const Transaksi = () => {
  const { currentUser } = useAuth();
  const { getCollection, getDocRef, createDoc, readDoc, updateDoc, deleteDoc, serverTimestamp, queryCollection } = useFirestore();
  const { isProduction } = useEnvironment();
  const [quantityInputs, setQuantityInputs] = useState({});
  const [productId, setProductId] = useState("");
  const [enterKeyHoldTimer, setEnterKeyHoldTimer] = useState(null);
  const [enterKeyDownTime, setEnterKeyDownTime] = useState(null);

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [useScanner, setUseScanner] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [currentSatuanIndex, setCurrentSatuanIndex] = useState(0);
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const [productData, setProductData] = useState({});
  const [snackbars, setSnackbars] = useState([]);

  // Modal state
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEnterKeyDown = (e) => {
    if (e.key === "Enter") {
      setEnterKeyDownTime(Date.now());
      setEnterKeyHoldTimer(
          setTimeout(() => {
            openModal();
          }, 1000)
      );
    }
  };

  const getBarcodeIncrement = (unit) => {
    // Use the unit in lowercase for consistency.
    switch (unit.toLowerCase()) {
      case "gram":
        return 100;
        // For kg, ons, kwintal, tons, box, and pcs, simply increment by 1.
      case "kg":
      case "ons":
      case "kwintal":
      case "tons":
      case "box":
      case "pcs":
      default:
        return 1;
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      // Use environment-aware queryCollection function
      const stocksData = await queryCollection("stocks");
      const products = {};

      stocksData.forEach((data) => {
        // Data already has id from queryCollection
        products[data.id] = data;
      });

      console.log(`Fetched products from ${isProduction ? 'production' : 'testing'} environment:`, products);
      setProductData(products);
    };
    fetchProducts();
  }, [isProduction]);

  useEffect(() => {
    // If nothing typed, clear suggestions
    if (!productId.trim()) {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      return;
    }

    if (useScanner) {
      const trimmed = productId.trim();
      const found = Object.values(productData).filter(
          (p) => p.itemId === trimmed
      );
      setSuggestions(found);
      setActiveSuggestionIndex(found.length > 0 ? 0 : -1);

      if (found.length === 1) {
        const product = found[0];
        // Use the first unit from the product’s units array and the initial quantity.
        addProductToCart(
            product.id,
            product.satuan[0],
            getInitialQuantity(product.satuan[0])
        );
        setProductId("");
      }
    } else {
      // PARTIAL match on product.name if not using the scanner
      const input = productId.toLowerCase().trim();
      const words = input.split(/\s+/);
      const newSuggestions = Object.values(productData).filter((p) => {
        const name = (p.name || "").toLowerCase();
        return words.every((w) => name.includes(w));
      });
      setSuggestions(newSuggestions);
      setActiveSuggestionIndex(newSuggestions.length > 0 ? 0 : -1);
    }
  }, [productId, useScanner, productData]);

  useEffect(() => {
    if (activeSuggestionIndex >= 0 && suggestions.length > 0) {
      const product = suggestions[activeSuggestionIndex];
      const satuan = product.satuan[0];
      setCurrentSatuanIndex(0);
      setCurrentQuantity(getInitialQuantity(satuan));
    }
  }, [activeSuggestionIndex, suggestions]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (enterKeyHoldTimer) {
        clearTimeout(enterKeyHoldTimer);
      }
    };
  }, [enterKeyHoldTimer]);

  const handleKeyDown = (e) => {
    if (useScanner) {
      if (e.key === "Enter") addProduct();
      return;
    }

    if (suggestions.length > 0) {
      const activeProduct = suggestions[activeSuggestionIndex];
      const isActiveDisabled =
          activeProduct && products.some((p) => p.id === activeProduct.id);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveSuggestionIndex((prev) =>
              Math.min(prev + 1, suggestions.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Shift":
        case "]":
          if (e.key === "Shift" && e.location !== 2) break;
          e.preventDefault();
          if (activeProduct && !isActiveDisabled) {
            const newIndex =
                (currentSatuanIndex + 1) % activeProduct.satuan.length;
            handleUnitChange(newIndex, activeProduct);
          }
          break;
        case "[":
          e.preventDefault();
          if (activeProduct && !isActiveDisabled) {
            const newIndex =
                (currentSatuanIndex - 1 + activeProduct.satuan.length) %
                activeProduct.satuan.length;
            handleUnitChange(newIndex, activeProduct);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (activeProduct && !isActiveDisabled) {
            const increment = getIncrement(
                activeProduct.satuan[currentSatuanIndex]
            );
            setCurrentQuantity((prev) => prev + increment);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (activeProduct && !isActiveDisabled) {
            const decrement = getIncrement(
                activeProduct.satuan[currentSatuanIndex]
            );
            setCurrentQuantity((prev) => Math.max(prev - decrement, 0));
          }
          break;
        case "Enter":
          e.preventDefault();
          if (activeProduct && !isActiveDisabled) {
            addProductToCart(
                activeProduct.id,
                activeProduct.satuan[currentSatuanIndex],
                currentQuantity
            );
            setProductId("");
            setSuggestions([]);
            inputRef.current?.focus();
          }
          break;
        case "Escape":
          e.preventDefault();
          setProductId("");
          setSuggestions([]);
          break;
        default:
          break;
      }
    } else if (e.key === "Enter") {
      addProduct();
    }
  };

  const addProductToCart = (id, satuan, quantity) => {
    const product = productData[id];
    if (!product) {
      setSnackbars(prev => [...prev, {
        id: Date.now(),
        message: "Product not found!",
        severity: "error"
      }]);
      return;
    }

    // Check if the product is already in the cart.
    const existingProduct = products.find((p) => p.id === id);

    if (existingProduct) {
      // Barcode scanner mode: use special logic.
      if (useScanner) {
        // Check if the unit (satuan) from the cart matches the new unit.
        if (existingProduct.satuan !== satuan) {
          // If they differ, show the error message.
          setSnackbars(prev => [...prev, {
            id: Date.now(),
            message: `Beda satuan (${existingProduct.satuan} dan ${satuan})`,
            severity: "error"
          }]);
          return;
        }
        // If the unit is the same, determine the proper increment.
        const increment = getBarcodeIncrement(satuan);

        // Check if there's a manually entered quantity in quantityInputs
        const displayedQuantity = quantityInputs[existingProduct.id] !== undefined
            ? parseFloat(quantityInputs[existingProduct.id].replace(',', '.'))
            : existingProduct.quantity;

        // Use the displayed quantity for increment
        const newQuantity = displayedQuantity + increment;

        // Update both the product and the quantityInputs
        updateQuantity(existingProduct.id, newQuantity);
        setQuantityInputs(prev => ({
          ...prev,
          [existingProduct.id]: newQuantity.toString()
        }));
      } else {
        // Normal (non-scanner) mode: use the existing conversion logic.
        const convertedQty = convertToSmallestUnit(quantity, satuan, {
          smallestUnit: product.smallestUnit,
          piecesPerBox: product.piecesPerBox,
        });
        const existingConverted = convertToSmallestUnit(
            existingProduct.quantity,
            existingProduct.satuan,
            product
        );
        const totalConverted = existingConverted + convertedQty;

        updateQuantity(
            id,
            convertFromSmallestUnit(totalConverted, satuan, product)
        );
      }
    } else {
      // If the product is not already in the cart, add it as a new entry.
      const newProduct = {
        no: products.length + 1,
        id,
        name: product.name,
        quantity,
        satuan,
        price: product.pricePerUnit[satuan],
        subtotal: product.pricePerUnit[satuan] * quantity,
        satuanOptions: product.satuan,
        pricePerUnit: product.pricePerUnit,
        smallestUnit: product.smallestUnit,
        piecesPerBox: product.piecesPerBox,
      };
      setProducts([...products, newProduct]);
      setTotal(total + newProduct.subtotal);
    }
    // Clear the input field.
    setProductId("");
  };

  const handleUnitChange = (newIndex, product) => {
    setCurrentSatuanIndex(newIndex);
    const newSatuan = product.satuan[newIndex];
    setCurrentQuantity(getInitialQuantity(newSatuan));
  };

  const addProduct = () => {
    const product = productData[productId];
    if (!product) {
      alert("Product not found!");
      setProductId("");
      return;
    }
    addProductToCart(
        productId,
        product.satuan[0],
        getInitialQuantity(product.satuan[0])
    );
  };

  // ... (keep existing updateQuantity, updateSatuan, recalculateTotal,
  // removeProduct, and payment functions)

  const updateQuantity = (id, quantity) => {
    const updatedProducts = products
        .map((p) => {
          if (p.id === id) {
            const newSubtotal = p.price * quantity;
            return { ...p, quantity, subtotal: newSubtotal };
          }
          return p;
        })
        .filter((p) => p.quantity > 0);

    setProducts(updatedProducts);

    // Also update the displayed quantity input to match the actual quantity
    setQuantityInputs(prev => {
      const updatedInputs = { ...prev };
      // If the product was removed (quantity <= 0), remove it from inputs too
      if (!updatedProducts.some(p => p.id === id)) {
        delete updatedInputs[id];
      } else {
        updatedInputs[id] = quantity.toString();
      }
      return updatedInputs;
    });

    recalculateTotal(updatedProducts);
  };

  const handlePaymentComplete = async (paymentData) => {
    // Prevent double submission
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);

    const { amountPaid, change, numericAmountPaid, totalNumeric, appliedVoucher, originalTotal } = paymentData;

    // Define which mass units need conversion to kg.
    const massUnits = ["gram", "ons", "kg", "kwintal", "ton"];

    try {
      // --- 1. Check for stock discrepancies and track them ---
      let hasStockDiscrepancy = false;
      const stockDiscrepancies = [];

      for (const product of products) {
        // Use environment-aware document reference
        const stockData = await readDoc("stocks", product.id);

        if (!stockData) {
          throw new Error(`Product ${product.id} not found in stock`);
        }

        // Handle invalid stock values
        const currentStock = (stockData.stock === null || stockData.stock === undefined) ? 0 : stockData.stock;

        // Convert transaction quantity to the smallest unit
        let convertedQty = convertToSmallestUnit(
            product.quantity,
            product.satuan,
            {
              smallestUnit: stockData.smallestUnit,
              piecesPerBox: stockData.piecesPerBox,
            }
        );

        // Check if there's a stock discrepancy
        if (currentStock < convertedQty) {
          hasStockDiscrepancy = true;
          stockDiscrepancies.push({
            id: product.id,
            name: product.name,
            requestedQty: convertedQty,
            availableStock: currentStock
          });
        }
      }

      // --- 2. Save the transaction detail ---
      // For each product item, if its unit is a mass unit, convert its quantity to kg.
      const transactionItems = products.map((p) => {
        let savedQuantity = p.quantity;
        let savedUnit = p.satuan;
        if (massUnits.includes(p.satuan.toLowerCase())) {
          // Multiply by the conversion factor (which gives grams) then divide by 1000 to get kg.
          savedQuantity =
              (p.quantity * CONVERSION_TABLE[p.satuan.toLowerCase()]) /
              CONVERSION_TABLE["kg"];
          savedUnit = "kg";
        }
        return {
          itemId: p.id,
          itemName: p.name,
          quantity: savedQuantity,
          unit: savedUnit,
          price: p.price,
          subtotal: p.subtotal,
        };
      });

      // Create a unique transaction ID
      const transactionId = Date.now().toString() + Math.random().toString(36).substr(2, 5);

      // Create transaction with environment awareness and voucher support
      const transactionData = {
        id: transactionId,
        items: transactionItems,
        total: originalTotal || total,
        isMember: false,
        createdBy: currentUser ? currentUser.email : "unknown"
      };

      // Add voucher information if applied
      if (appliedVoucher) {
        transactionData.voucherId = appliedVoucher.id;
        transactionData.voucherName = appliedVoucher.name;
        transactionData.voucherDiscount = appliedVoucher.value;
        transactionData.discountedTotal = totalNumeric;
      }

      await createDoc("transactionDetail", transactionData, transactionId);

      // Claim voucher if applied
      if (appliedVoucher) {
        try {
          await updateDoc("vouchers", appliedVoucher.id, {
            isClaimed: true,
            claimDate: serverTimestamp()
          });
        } catch (voucherError) {
          console.error("Error claiming voucher:", voucherError);
          // Continue with transaction even if voucher claiming fails
        }
      }

      // --- 2. Process stock updates and stockTransactions ---
      for (const product of products) {
        // Use environment-aware document reference
        const stockData = await readDoc("stocks", product.id);

        if (!stockData) {
          throw new Error(`Product ${product.id} not found in stock`);
        }

        const currentStock = stockData.stock;
        const stockValue = stockData.stockValue;

        // Convert transaction quantity to the smallest unit using your helper.
        // Our updated function now correctly handles all unit conversions
        let convertedQty = convertToSmallestUnit(
            product.quantity,
            product.satuan,
            {
              smallestUnit: stockData.smallestUnit, // Now properly handles all conversions
              piecesPerBox: stockData.piecesPerBox,
            }
        );

        // No additional mass unit conversion needed - our updated convertToSmallestUnit function
        // (Assuming that stockData.smallestUnit is “gram” for mass items.)

        // Stock has already been verified in the first step, so we can proceed

        const stockWorthPerUnit = stockValue / currentStock;
        const transactionStockWorth = stockWorthPerUnit * convertedQty;

        // Check if this item has a stock discrepancy
        const isDiscrepant = stockDiscrepancies.some(item => item.id === product.id);

        // Calculate the actual stock reduction amount (limited by available stock)
        const actualStockReduction = isDiscrepant ?
            Math.min(convertedQty, currentStock) : convertedQty;

        // Create a stock transaction with environment awareness and discrepancy flag
        await createDoc("stockTransactions", {
          itemId: product.id,
          itemName: product.name,
          kategori: stockData.kategori,
          subKategori: stockData.subKategori,
          price: product.price,
          quantity: convertedQty, // The requested quantity remains the same
          unit: stockData.smallestUnit, // Use the actual smallest unit from the stock
          originalQuantity: product.quantity,
          originalUnit: product.satuan,
          isDeleted: false,
          timestampInMillisEpoch: serverTimestamp(),
          transactionType: "penjualan",
          transactionVia: "pointOfSales",
          stockWorth: isDiscrepant ?
              (stockWorthPerUnit * actualStockReduction) : // Only count worth of actual stock used
              transactionStockWorth,
          isStockDiscrepant: isDiscrepant, // Flag to indicate stock discrepancy
          createdBy: currentUser ? currentUser.email : "unknown"
        });

        // Update stock, ensuring it doesn't go negative
        const newStock = isDiscrepant ? 0 : (currentStock - convertedQty);
        const stockReduction = isDiscrepant ? currentStock : convertedQty;
        const newStockValue = Math.max(0, stockValue - (stockWorthPerUnit * stockReduction));

        await updateDoc("stocks", product.id, {
          stock: newStock,
          stockValue: newStockValue,
        });
      }

      // Create detailed message if there are stock discrepancies
      let message = "";
      if (hasStockDiscrepancy) {
        const discrepantItemNames = stockDiscrepancies.map(item => item.name).join(", ");
        message = `Transaksi Berhasil, namun perlu mengecek jumlah stock: ${discrepantItemNames}`;
      } else {
        message = "Transaction completed successfully!";
      }

      // Show success message with detailed information if needed
      const newSnackbar = {
        id: Date.now(),
        message: message,
        severity: hasStockDiscrepancy ? "warning" : "success"
      };

      setSnackbars(prev => [...prev, newSnackbar]);

      // Print receipt with voucher information
      const receiptTotal = originalTotal || total;
      const receiptData = {
        transactionId,
        items: products,
        total: receiptTotal,
        amountPaid,
        change,
        appliedVoucher
      };

      await printReceiptWithVoucher(receiptData, (snackbarInfo) => {
        const newSnackbar = {
          id: Date.now() + 1, // Ensure unique ID
          message: snackbarInfo.message,
          severity: snackbarInfo.severity || "info"
        };
        setSnackbars(prev => [...prev, newSnackbar]);
      });

      // If there were stock discrepancies, log them for reference
      if (hasStockDiscrepancy) {
        console.warn("Stock discrepancies detected:", stockDiscrepancies);
      }

      // Reset state
      setProducts([]);
      setTotal(0);

      // Close modal after a short delay to show success state
      setTimeout(() => {
        setIsProcessing(false);
        closeModal();
      }, 1000);

    } catch (error) {
      console.error("Payment error:", error);
      setSnackbars(prev => [...prev, {
        id: Date.now(),
        message: `Error: ${error.message}`,
        severity: "error"
      }]);
      setIsProcessing(false);
    }
  };



  const removeProduct = (id) => {
    const updatedProducts = products.filter((p) => p.id !== id);
    setProducts(updatedProducts);
    recalculateTotal(updatedProducts);
  };

  const updateSatuan = (id, newSatuan) => {
    const updatedProducts = products.map((p) => {
      if (p.id === id) {
        const stockProduct = productData[p.id];
        const oldSatuan = p.satuan;
        // Convert current quantity to the smallest unit
        const inSmallest = convertToSmallestUnit(p.quantity, oldSatuan, {
          smallestUnit: stockProduct.smallestUnit,
          piecesPerBox: stockProduct.piecesPerBox,
        });

        let newQuantity;
        if (newSatuan === "box") {
          newQuantity = inSmallest / stockProduct.piecesPerBox;
        } else {
          // We use the conversion table to recalc the quantity.
          newQuantity =
              (inSmallest / CONVERSION_TABLE[newSatuan]) *
              CONVERSION_TABLE[stockProduct.smallestUnit];
        }

        const newPrice = p.pricePerUnit[newSatuan];
        return {
          ...p,
          satuan: newSatuan,
          quantity: newQuantity,
          price: newPrice,
          subtotal: newPrice * newQuantity,
        };
      }
      return p;
    });

    setProducts(updatedProducts);
    recalculateTotal(updatedProducts);

    // Update the local input so that the text field autopopulates
    const changedProduct = updatedProducts.find((p) => p.id === id);
    if (changedProduct) {
      setQuantityInputs((prev) => ({
        ...prev,
        [id]: changedProduct.quantity.toString(),
      }));
    }
  };

  const recalculateTotal = (updatedProducts) => {
    const newTotal = updatedProducts.reduce(
        (acc, curr) => acc + curr.subtotal,
        0
    );
    setTotal(newTotal);
  };

  // Handle payment
  const openModal = () => {
    if (products.length === 0) {
      alert("No products in the cart!");
      return;
    }
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
  };

  const handleEnterKeyUp = (e) => {
    if (e.key === "Enter") {
      if (Date.now() - enterKeyDownTime < 1000) {
        clearTimeout(enterKeyHoldTimer);
        // Handle normal Enter key press
        if (suggestions.length > 0) {
          const product = suggestions[activeSuggestionIndex];
          if (product) {
            addProductToCart(
                product.id,
                product.satuan[currentSatuanIndex],
                currentQuantity
            );
            setProductId("");
            setSuggestions([]);
            inputRef.current?.focus();
          }
        } else {
          addProduct();
        }
      }
      setEnterKeyDownTime(null);
    }
  };

  return (
      <div className="transaksi-container">
        <h1>Transaksi - Point of Sales</h1>

        <div className="product-input" ref={containerRef}>
          <div className="scanner-toggle">
            <label>
              <input
                  type="checkbox"
                  checked={useScanner}
                  onChange={(e) => setUseScanner(e.target.checked)}
              />
              Use Barcode Scanner
            </label>
          </div>
          <input
              ref={inputRef}
              type="text"
              placeholder="Enter Product ID or Name"
              value={productId}
              onChange={(e) =>
                  setProductId(
                      useScanner ? e.target.value.replace(/\D/g, "") : e.target.value
                  )
              }
              onKeyDown={(e) => {
                handleKeyDown(e); // Your existing keydown handler
                handleEnterKeyDown(e); // New handler for Enter key hold
              }}
              onKeyUp={handleEnterKeyUp} // New handler for Enter key release
          />
          <button onClick={addProduct}>Add Product</button>

          {suggestions.length > 0 && (
              <div className="autocomplete-dropdown">
                {suggestions.map((product, index) => {
                  // Check if the product is already in the cart
                  const isDisabled = products.some((p) => p.id === product.id);
                  return (
                      <div
                          key={product.id}
                          className={`suggestion-item ${
                              index === activeSuggestionIndex ? "active" : ""
                          } ${isDisabled ? "disabled" : ""}`}
                          onMouseEnter={() => {
                            if (!isDisabled) {
                              setActiveSuggestionIndex(index);
                            }
                          }}
                          onClick={() => {
                            if (!isDisabled) {
                              addProductToCart(
                                  product.id,
                                  product.satuan[currentSatuanIndex],
                                  currentQuantity
                              );
                              setProductId("");
                              setSuggestions([]);
                              inputRef.current?.focus();
                            }
                          }}
                      >
                        <div className="suggestion-content">
                    <span className="product-name">
                      {product.name}
                      {isDisabled && (
                          <span className="already-selected">
                          (sudah dipilih)
                        </span>
                      )}
                    </span>
                          {index === activeSuggestionIndex && (
                              <div className="quantity-unit-display">
                                <div className="quantity-card">
                                  {currentQuantity.toFixed(
                                      currentQuantity % 1 === 0 ? 0 : 1
                                  )}
                                </div>
                                <span className="unit">
                          × {product.satuan[currentSatuanIndex]}
                        </span>
                              </div>
                          )}
                        </div>
                      </div>
                  );
                })}
              </div>
          )}
        </div>

        {/* ... (keep existing table and modal code) */}
        <table className="product-table">
          <thead>
          <tr>
            <th>No.</th>
            {/* <th>ID Product</th> */}
            <th>Nama Produk</th>
            <th>Jumlah</th>
            <th>Stock</th>
            {/* <th>Satuan</th> */}
            <th>Harga</th>
            <th>Subtotal</th>
            <th>Hapus</th>
          </tr>
          </thead>
          <tbody>
          {products.map((product, index) => (
              <tr key={product.id}>
                <td>{index + 1}</td>
                <td>{product.name}</td>
                <td>
                  <div className="quantity-container">
                    <button
                        className="quantity-btn"
                        onClick={() => {
                          // Get the displayed quantity from input or actual product quantity
                          const currentQuantity = quantityInputs[product.id] !== undefined
                              ? parseFloat(quantityInputs[product.id].replace(',', '.'))
                              : product.quantity;

                          const newQuantity = Math.max(0, currentQuantity - 1);
                          updateQuantity(product.id, newQuantity);
                          setQuantityInputs((prev) => ({
                            ...prev,
                            [product.id]: newQuantity.toString(),
                          }));
                        }}
                    >
                      &minus;
                    </button>
                    <input
                        type="text"
                        className="quantity-input"
                        inputMode="decimal"
                        value={
                          quantityInputs[product.id] !== undefined
                              ? quantityInputs[product.id]
                              : product.quantity
                        }
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          // Allow empty input or valid decimal numbers (dot or comma)
                          if (
                              rawValue === "" ||
                              /^(\d+([.,]\d*)?)?$/.test(rawValue)
                          ) {
                            setQuantityInputs((prev) => ({
                              ...prev,
                              [product.id]: rawValue,
                            }));
                          }
                        }}
                        onBlur={(e) => {
                          const rawValue = e.target.value.trim();
                          // Replace comma with dot to parse correctly
                          const numericValue = parseFloat(
                              rawValue.replace(",", ".")
                          );
                          if (
                              rawValue === "" ||
                              isNaN(numericValue) ||
                              numericValue === 0
                          ) {
                            // Remove product if input is empty or 0
                            removeProduct(product.id);
                          } else {
                            updateQuantity(product.id, numericValue);
                            // Normalize the displayed value
                            setQuantityInputs((prev) => ({
                              ...prev,
                              [product.id]: numericValue.toString(),
                            }));
                          }
                        }}
                    />
                    <button
                        className="quantity-btn"
                        onClick={() => {
                          // Get the displayed quantity from input or actual product quantity
                          const currentQuantity = quantityInputs[product.id] !== undefined
                              ? parseFloat(quantityInputs[product.id].replace(',', '.'))
                              : product.quantity;

                          const newQuantity = currentQuantity + 1;
                          updateQuantity(product.id, newQuantity);
                          setQuantityInputs((prev) => ({
                            ...prev,
                            [product.id]: newQuantity.toString(),
                          }));
                        }}
                    >
                      &#43;
                    </button>
                  </div>
                </td>
                <td>
                  {productData[product.id] ? (
                      (() => {
                        // Convert current product quantity to the smallest unit
                        const productStockData = productData[product.id];
                        const currentStock = productStockData.stock || 0;

                        // Convert requested quantity to the smallest unit
                        const requestedQty = convertToSmallestUnit(
                            product.quantity,
                            product.satuan,
                            {
                              smallestUnit: productStockData.smallestUnit,
                              piecesPerBox: productStockData.piecesPerBox,
                            }
                        );

                        // Convert stock back to the display unit and round to nearest integer
                        const stockInDisplayUnit = Math.round(
                            convertFromSmallestUnit(
                                currentStock,
                                product.satuan,
                                {
                                  smallestUnit: productStockData.smallestUnit,
                                  piecesPerBox: productStockData.piecesPerBox,
                                }
                            )
                        );

                        // Check if quantity exceeds stock
                        const isLowStock = requestedQty > currentStock;

                        return (
                            <span className={isLowStock ? "low-stock" : ""}>
                        {stockInDisplayUnit} {product.satuan}
                      </span>
                        );
                      })()
                  ) : (
                      "Loading..."
                  )}
                </td>
                <td>
                  {formatCurrency(product.price)} /{" "}
                  <select
                      value={product.satuan}
                      onChange={(e) => updateSatuan(product.id, e.target.value)}
                  >
                    {product.satuanOptions.map((satuan) => (
                        <option key={satuan} value={satuan}>
                          {satuan}
                        </option>
                    ))}
                  </select>
                </td>
                <td>{formatCurrency(product.subtotal)}</td>
                <td>
                  <button
                      className="delete-btn"
                      onClick={() => removeProduct(product.id)}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
          ))}
          </tbody>
        </table>

        {/* Sticky Footer */}
        <div className="footer">
          <h2>Total: {formatCurrency(total)}</h2>
          <button onClick={openModal}>Bayar</button>
        </div>

        {/* Payment Modal with Voucher Support */}
        <PaymentModal
          isOpen={modalIsOpen}
          onClose={closeModal}
          total={total}
          onPaymentComplete={handlePaymentComplete}
          isProcessing={isProcessing}
          firestore={{ readDoc, updateDoc, serverTimestamp }}
        />

        {/* Render multiple stacked snackbars */}
        <div className="snackbar-container">
          {snackbars.map((snackbar) => (
              <div
                  key={snackbar.id}
                  className={`snackbar ${
                      snackbar.severity === "warning"
                          ? "snackbar-warning"
                          : snackbar.severity === "error"
                              ? "snackbar-error"
                              : ""
                  }`}
              >
                {snackbar.message}
                <button onClick={() => setSnackbars(prev => prev.filter(sb => sb.id !== snackbar.id))}>
                  ×
                </button>
              </div>
          ))}
        </div>
      </div>
  );
};

export default Transaksi;