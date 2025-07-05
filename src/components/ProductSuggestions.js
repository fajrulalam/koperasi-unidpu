// src/components/ProductSuggestions.js
import React from "react";
import "../styles/ProductSuggestions.css";

const ProductSuggestions = ({
  suggestions,
  activeSuggestionIndex,
  products,
  currentQuantity,
  currentSatuanIndex,
  onSuggestionClick,
  onSuggestionHover
}) => {
  if (suggestions.length === 0) {
    return null;
  }

  return (
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
                onSuggestionHover(index);
              }
            }}
            onClick={() => {
              if (!isDisabled) {
                onSuggestionClick(product, index);
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
  );
};

export default ProductSuggestions;