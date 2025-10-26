// src/components/TransaksiRefactored.js
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useFirestore } from "../context/FirestoreContext";
import { useEnvironment } from "../context/EnvironmentContext";
import {
  formatCurrency,
  getInitialQuantity,
  getIncrement,
  getBarcodeIncrement,
  convertToSmallestUnit,
  convertFromSmallestUnit,
  CONVERSION_TABLE,
} from "../utils/transaksiUtils";
import {
  processTransaction,
  setLocalPrintServer,
} from "../services/transactionService";
import PaymentModal from "./PaymentModal";
import SnackbarManager from "./SnackbarManager";
import ProductSuggestions from "./ProductSuggestions";
import ProductTable from "./ProductTable";
import "../styles/TransaksiRefactored.css";

const TransaksiRefactored = () => {
  const { currentUser } = useAuth();
  const {
    getCollection,
    getDocRef,
    createDoc,
    readDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    queryCollection,
  } = useFirestore();
  const { isProduction } = useEnvironment();

  // Product and cart state
  const [products, setProducts] = useState([]);
  const [productData, setProductData] = useState({});
  const [total, setTotal] = useState(0);
  const [quantityInputs, setQuantityInputs] = useState({});

  // Input and search state
  const [productId, setProductId] = useState("");
  const [useScanner, setUseScanner] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [currentSatuanIndex, setCurrentSatuanIndex] = useState(0);
  const [currentQuantity, setCurrentQuantity] = useState(1);

  // Modal and interaction state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [snackbars, setSnackbars] = useState([]);

  // Keyboard interaction state
  const [enterKeyHoldTimer, setEnterKeyHoldTimer] = useState(null);
  const [enterKeyDownTime, setEnterKeyDownTime] = useState(null);

  // Refs
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch products on component mount and environment change
  useEffect(() => {
    const fetchProducts = async () => {
      const stocksData = await queryCollection("stocks");
      const products = {};

      stocksData.forEach((data) => {
        products[data.id] = data;
      });

      console.log(
        `Fetched products from ${
          isProduction ? "production" : "testing"
        } environment:`,
        products
      );
      setProductData(products);
    };
    fetchProducts();
  }, [isProduction]);

  // Handle product search and suggestions
  useEffect(() => {
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
        addProductToCart(
          product.id,
          product.satuan[0],
          getInitialQuantity(product.satuan[0])
        );
        setProductId("");
      }
    } else {
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

  // Update current quantity and unit when active suggestion changes
  useEffect(() => {
    if (activeSuggestionIndex >= 0 && suggestions.length > 0) {
      const product = suggestions[activeSuggestionIndex];
      const satuan = product.satuan[0];
      setCurrentSatuanIndex(0);
      setCurrentQuantity(getInitialQuantity(satuan));
    }
  }, [activeSuggestionIndex, suggestions]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (enterKeyHoldTimer) {
        clearTimeout(enterKeyHoldTimer);
      }
    };
  }, [enterKeyHoldTimer]);

  const addProductToCart = (id, satuan, quantity) => {
    const product = productData[id];
    if (!product) {
      setSnackbars((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: "Product not found!",
          severity: "error",
        },
      ]);
      return;
    }

    const existingProduct = products.find((p) => p.id === id);

    if (existingProduct) {
      if (useScanner) {
        if (existingProduct.satuan !== satuan) {
          setSnackbars((prev) => [
            ...prev,
            {
              id: Date.now(),
              message: `Beda satuan (${existingProduct.satuan} dan ${satuan})`,
              severity: "error",
            },
          ]);
          return;
        }

        const increment = getBarcodeIncrement(satuan);
        const displayedQuantity =
          quantityInputs[existingProduct.id] !== undefined
            ? parseFloat(quantityInputs[existingProduct.id].replace(",", "."))
            : existingProduct.quantity;

        const newQuantity = displayedQuantity + increment;

        updateQuantity(existingProduct.id, newQuantity);
        setQuantityInputs((prev) => ({
          ...prev,
          [existingProduct.id]: newQuantity.toString(),
        }));
      } else {
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
    setProductId("");
  };

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

    setQuantityInputs((prev) => {
      const updatedInputs = { ...prev };
      if (!updatedProducts.some((p) => p.id === id)) {
        delete updatedInputs[id];
      } else {
        updatedInputs[id] = quantity.toString();
      }
      return updatedInputs;
    });

    recalculateTotal(updatedProducts);
  };

  const updateSatuan = (id, newSatuan) => {
    const updatedProducts = products.map((p) => {
      if (p.id === id) {
        const stockProduct = productData[p.id];
        const oldSatuan = p.satuan;
        const inSmallest = convertToSmallestUnit(p.quantity, oldSatuan, {
          smallestUnit: stockProduct.smallestUnit,
          piecesPerBox: stockProduct.piecesPerBox,
        });

        let newQuantity;
        if (newSatuan === "box") {
          newQuantity = inSmallest / stockProduct.piecesPerBox;
        } else {
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

    const changedProduct = updatedProducts.find((p) => p.id === id);
    if (changedProduct) {
      setQuantityInputs((prev) => ({
        ...prev,
        [id]: changedProduct.quantity.toString(),
      }));
    }
  };

  const removeProduct = (id) => {
    const updatedProducts = products.filter((p) => p.id !== id);
    setProducts(updatedProducts);
    recalculateTotal(updatedProducts);
  };

  const recalculateTotal = (updatedProducts) => {
    const newTotal = updatedProducts.reduce(
      (acc, curr) => acc + curr.subtotal,
      0
    );
    setTotal(newTotal);
  };

  const handleUnitChange = (newIndex, product) => {
    setCurrentSatuanIndex(newIndex);
    const newSatuan = product.satuan[newIndex];
    setCurrentQuantity(getInitialQuantity(newSatuan));
  };

  const addProduct = () => {
    const product = productData[productId];
    if (!product) {
      setSnackbars((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: "Product not found!",
          severity: "error",
        },
      ]);
      setProductId("");
      return;
    }
    addProductToCart(
      productId,
      product.satuan[0],
      getInitialQuantity(product.satuan[0])
    );
  };

  const handleEnterKeyDown = (e) => {
    if (e.key === "Enter") {
      setEnterKeyDownTime(Date.now());
      setEnterKeyHoldTimer(
        setTimeout(() => {
          openPaymentModal();
        }, 1000)
      );
    }
  };

  const handleEnterKeyUp = (e) => {
    if (e.key === "Enter") {
      if (Date.now() - enterKeyDownTime < 1000) {
        clearTimeout(enterKeyHoldTimer);
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

  const openPaymentModal = () => {
    if (products.length === 0) {
      setSnackbars((prev) => [
        ...prev,
        {
          id: Date.now(),
          message: "No products in the cart!",
          severity: "warning",
        },
      ]);
      return;
    }
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
  };

  const handlePaymentComplete = async (paymentData) => {
    setIsProcessing(true);

    try {
      const result = await processTransaction(
        products,
        total,
        paymentData.amountPaid,
        paymentData.change,
        {
          createDoc,
          readDoc,
          updateDoc,
          serverTimestamp,
          currentUser,
          setSnackbars,
        }
      );

      // Reset state
      setProducts([]);
      setTotal(0);
      setQuantityInputs({});

      // Close modal after a short delay
      setTimeout(() => {
        setIsProcessing(false);
        closePaymentModal();
      }, 1000);
    } catch (error) {
      setIsProcessing(false);
    }
  };

  const handleSuggestionClick = (product, index) => {
    addProductToCart(
      product.id,
      product.satuan[currentSatuanIndex],
      currentQuantity
    );
    setProductId("");
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleSuggestionHover = (index) => {
    setActiveSuggestionIndex(index);
  };

  return (
    <div className="transaksi-container">
      <h1>Transaksi - Unimart</h1>

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

        <div className="input-section">
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
              handleKeyDown(e);
              handleEnterKeyDown(e);
            }}
            onKeyUp={handleEnterKeyUp}
          />
          <button onClick={addProduct} className="add-button">
            Add Product
          </button>
        </div>

        <ProductSuggestions
          suggestions={suggestions}
          activeSuggestionIndex={activeSuggestionIndex}
          products={products}
          currentQuantity={currentQuantity}
          currentSatuanIndex={currentSatuanIndex}
          onSuggestionClick={handleSuggestionClick}
          onSuggestionHover={handleSuggestionHover}
        />
      </div>

      <ProductTable
        products={products}
        productData={productData}
        quantityInputs={quantityInputs}
        setQuantityInputs={setQuantityInputs}
        updateQuantity={updateQuantity}
        updateSatuan={updateSatuan}
        removeProduct={removeProduct}
      />

      <div className="footer">
        <h2>Total: {formatCurrency(total)}</h2>
        <button onClick={openPaymentModal} className="pay-button">
          Bayar
        </button>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={closePaymentModal}
        total={total}
        onPaymentComplete={handlePaymentComplete}
        isProcessing={isProcessing}
      />

      <SnackbarManager snackbars={snackbars} setSnackbars={setSnackbars} />
    </div>
  );
};

// Export the utility function for external use
export { setLocalPrintServer };

export default TransaksiRefactored;
