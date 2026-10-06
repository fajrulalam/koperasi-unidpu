// src/components/common/Dropdown.js
//
// The app's dropdown. Never use a native <select> or <datalist>: see
// "Dropdowns" in UI_GUIDE.md. The list is rendered in a portal with fixed
// positioning so modals, tables and scroll areas can't clip it.
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { FaCheck, FaChevronDown } from "react-icons/fa";

const PANEL_MAX_HEIGHT = 240; // max-h-60
const PANEL_MIN_WIDTH = 112;
const GAP = 4;
const VIEWPORT_MARGIN = 8;
const OPTION_HEIGHT = 40;

// Mirrors INPUT_CLASS in cashflow/CashflowModals.js. Screens with their own
// input styling pass triggerClassName so the trigger matches their inputs.
const DEFAULT_TRIGGER_CLASS =
  "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e66a6a]/25 focus:border-[#e66a6a] transition-all";

const Dropdown = ({
  value,
  options,
  onChange,
  placeholder = "Pilih...",
  disabled = false,
  ariaLabel,
  className = "",
  triggerClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const listId = useId();

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  const canOpen = !disabled && options.length > 0;

  const computePosition = useCallback(() => {
    const rect = triggerRef.current.getBoundingClientRect();
    const wanted = Math.min(PANEL_MAX_HEIGHT, options.length * OPTION_HEIGHT + 8);
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    // Flip above the trigger when there's no room below and more room above.
    const placeAbove = spaceBelow < wanted && spaceAbove > spaceBelow;
    const available = Math.max(80, placeAbove ? spaceAbove : spaceBelow) - GAP;
    return {
      left: rect.left,
      width: Math.max(rect.width, PANEL_MIN_WIDTH),
      maxHeight: Math.min(PANEL_MAX_HEIGHT, available),
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    };
  }, [options.length]);

  const openPanel = () => {
    if (!canOpen) return;
    setPosition(computePosition());
    setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const closePanel = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const selectIndex = (index) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    closePanel(true);
  };

  // Close on outside click, resize, and scrolling anything but the list itself.
  useEffect(() => {
    if (!open) return undefined;
    const handleMouseDown = (event) => {
      if (
        !triggerRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const handleScroll = (event) => {
      const { target } = event;
      if (!(target instanceof Node) || !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleResize = () => setOpen(false);

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  // Keep the highlighted option visible when arrowing through a long list.
  useEffect(() => {
    if (!open || highlighted < 0) return;
    panelRef.current
      ?.querySelector(`[data-index="${highlighted}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, highlighted]);

  const handleKeyDown = (event) => {
    if (!canOpen) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openPanel();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlighted((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlighted((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setHighlighted(0);
        break;
      case "End":
        event.preventDefault();
        setHighlighted(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectIndex(highlighted);
        break;
      case "Escape":
        // Close the list only, never the modal around it.
        event.preventDefault();
        event.stopPropagation();
        closePanel(true);
        break;
      case "Tab":
        closePanel();
        break;
      default:
        break;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={!canOpen}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={handleKeyDown}
        // Space is handled on keydown; stop the browser's keyup click.
        onKeyUp={(event) => event.key === " " && event.preventDefault()}
        className={`flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
          triggerClassName || DEFAULT_TRIGGER_CLASS
        }`}
      >
        <span className={`truncate ${selected || value ? "text-gray-900" : "text-gray-400"}`}>
          {selected ? selected.label : value || placeholder}
        </span>
        <FaChevronDown
          className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        position &&
        ReactDOM.createPortal(
          <ul
            ref={panelRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed z-[1100] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            style={{
              left: position.left,
              top: position.top,
              bottom: position.bottom,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
          >
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              const isHighlighted = index === highlighted;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  data-index={index}
                  // Keep focus on the trigger so keyboard handling continues.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectIndex(index)}
                  onMouseEnter={() => setHighlighted(index)}
                  className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm ${
                    isHighlighted ? "bg-[#fff8f8]" : ""
                  } ${
                    isSelected || isHighlighted ? "text-[#e66a6a]" : "text-gray-700"
                  } ${isSelected ? "font-semibold" : ""}`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <FaCheck className="h-3 w-3 shrink-0" />}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </div>
  );
};

export default Dropdown;
