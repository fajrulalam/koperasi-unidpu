# UI Guide

How screens in Koperasi Unipdu look and behave today, so changes stay consistent.
This guide records what the code already does. Where the code disagrees with
itself, the conflict is listed under [Open decisions](#open-decisions) instead
of being settled here. Items marked **Rule** are decided: they apply to all new
and changed UI, even where older screens don't follow them yet.

_Last reviewed: 2026-10-06._

**Rule of thumb:** when you change an existing screen, match the patterns
already on that screen. When you build a new one, copy from the cashflow
components (`src/components/Finance.js`, `src/components/cashflow/`), which are
the most complete and consistent set.

---

## Styling approach

There are two styling systems in the codebase:

| System | Where | Use it for |
|---|---|---|
| **Tailwind utilities** | Finance, cashflow modals, Stocks, StockModal, WarehouseStock, `LoginTailwind` (the login page in use) | New screens and components |
| **Per-component CSS** in `src/styles/*.css` (51 files) | Most older screens, e.g. `BulkPurchaseModal.css`, `Sidebar.css` | Editing those screens |

- Don't convert a CSS-styled screen to Tailwind as a side effect of an unrelated change.
- Small Tailwind components can be dropped into a CSS-styled screen. `AccountPills` inside the Pembelian Grosir modal is an example.
- Tailwind setup and config are described in [TAILWIND.md](TAILWIND.md).

There is no dark mode, and no CSS variables or design tokens beyond `tailwind.config.js`.

---

## Color

### Brand

The app's brand color is **coral `#e66a6a`**. It is the sidebar background and the primary action color on the Finance page.

| Role | Value | Seen in |
|---|---|---|
| Brand / sidebar | `#e66a6a` | `Sidebar.css`, Finance buttons, selected pills, input focus |
| Brand deep (gradient end, hover start) | `#d35454` | Primary gradients |
| Brand pressed (gradient hover end) | `#c53030` | Primary gradient hover |
| Brand tint (hover background) | `#fff8f8` | Secondary button hover |

Primary actions use a gradient: `bg-gradient-to-r from-[#e66a6a] to-[#d35454] hover:from-[#d35454] hover:to-[#c53030]`.

### Tailwind theme colors

Defined in `tailwind.config.js`:

| Name | Value | Actual use |
|---|---|---|
| `primary` | `#ED3500` | Stock screens (Stocks, StockModal, WarehouseStock): focus rings, checkboxes, some buttons. 67 uses. |
| `unimart-pink` | `#f77b7b` | 1 use |
| `unimart-purple` | `#800080` | Unused |

`primary` is not the same color as the coral brand. See [Open decisions](#open-decisions).

### Neutrals

Use the Tailwind gray scale:

| Role | Class |
|---|---|
| Headings, main text | `text-gray-900` |
| Secondary text, labels | `text-gray-500` / `text-gray-600` |
| Hint / tertiary text | `text-gray-400` |
| Borders | `border-gray-200` (`border-gray-300` on stock-screen inputs) |
| Subtle surfaces, table heads, modal footers | `bg-gray-50` / `bg-gray-100` |

### Status colors

| Meaning | Classes | Example |
|---|---|---|
| Error / destructive | `text-red-600`, `bg-red-600 hover:bg-red-700` | Inline form errors, delete confirm buttons |
| Positive amount | `text-emerald-600` | `DeltaText` in `CashflowModals.js` |
| Negative amount | `text-red-500` | `DeltaText` |
| Warning / pending | `border-amber-200 bg-amber-50 text-amber-800` | Legacy-import banner on Finance |
| Info / note | `bg-yellow-50 border-yellow-200 text-yellow-950` | Unit conversion box in StockModal |
| Testing environment | `#ff9800` (orange) | Sidebar `TESTING` tag when collapsed |

---

## Typography

- **Font:** the system font stack from `src/index.css` (`-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', …`). No web fonts are loaded.
- **Page title:** `text-2xl font-bold text-gray-900 leading-tight tracking-tight` (Finance) or `text-3xl font-bold text-gray-900 tracking-tight` (Stocks).
- **Modal title:** `text-lg font-bold text-gray-900` (`ModalShell`), `text-xl font-bold text-gray-900` (StockModal).
- **Form label:** `block text-sm font-medium text-gray-500 mb-1.5`.
- **Table header cell:** `text-xs font-bold uppercase tracking-wider`.
- **Signed amounts:** `font-mono` so digits line up (`DeltaText`).

---

## Layout

- **Rule: page content fills the full width beside the sidebar.** Don't put a `max-width` or auto side margins (`mx-auto`, `margin: 0 auto`) on a page's root container. Capped, centered pages leave large empty margins on wide screens. The shell in `MainPage.js` already gives each page exactly the space next to the sidebar (it follows the sidebar's collapsed and expanded widths), so a page just needs to fill it. `src/styles/pageWidth.test.js` guards the existing page containers. The member-facing page has no sidebar and is the one exception for now (see [Open decisions](#open-decisions)).
- **Page container (Finance):**
  `bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 sm:p-8`
- **Dialogs are not pages.** Modals keep their own `max-w-*` / `max-width` so they stay readable and centered. The rule above is for page containers only.
- **Cards and panels:** `rounded-2xl` with `border border-gray-200` on cashflow screens, `rounded-lg`/`rounded-xl` on stock screens.
- **Breakpoints:** Tailwind's `sm:` / `md:` in Tailwind code. In CSS files, `@media (max-width: 768px)` is the main breakpoint (36 uses); `600px`, `480px` and `640px` also appear.
- **Side-by-side sections stack below 768px.** Example: the Pembelian Grosir nota section (`.nota-upload-section-split`) puts the upload on the left and the payment account on the right, then stacks them on narrow screens.

---

## Components

### Buttons

Cashflow / Finance style, preferred for new work:

```jsx
// Primary (page header)
"flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#e66a6a] to-[#d35454] hover:from-[#d35454] hover:to-[#c53030] text-white text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40"

// Secondary (page header)
"flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-gray-700 shadow-xs hover:bg-[#fff8f8] hover:text-[#e66a6a] hover:border-[#e66a6a]/30 transition-all duration-200 disabled:opacity-40"

// Modal footer: Cancel (CANCEL_CLASS) and Primary (PRIMARY_CLASS + gradient)
"flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40"
"flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl shadow-xs transition-all duration-200 disabled:opacity-40 bg-gradient-to-r from-[#e66a6a] to-[#d35454] hover:from-[#d35454] hover:to-[#c53030]"

// Destructive confirm: PRIMARY_CLASS + red
"... bg-red-600 hover:bg-red-700"
```

Stock screens use a different set:

```jsx
// Primary on the Stocks page
"px-5 py-2.5 bg-primary hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition text-sm"

// StockModal footer: Batal / Simpan
"px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
"px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
```

- Every `<button>` that isn't a form submit gets `type="button"`.
- Icon-only buttons get an Indonesian `aria-label`, e.g. `aria-label="Tutup"` or `` aria-label={`Hapus ${expense.category}`} ``.
- While saving, disable the button and swap the label: `Simpan` → `Menyimpan...`, `Hapus Permanen` → `Menghapus...`.

### Inputs

```jsx
// Cashflow (INPUT_CLASS in CashflowModals.js)
"w-full px-4 py-3 rounded-xl border border-gray-200 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e66a6a]/25 focus:border-[#e66a6a] transition-all"

// Stock screens
"w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:border-primary outline-none text-sm"
```

- Show field errors directly under the field: `text-xs text-red-600 mt-1` (stock screens) or `text-sm text-red-600` (cashflow modals).

### Money inputs

**Rule: every input that takes a Rupiah amount shows a fixed `Rp` prefix inside the box and groups the digits with a thousands separator (`.`) as the user types.** This applies everywhere, including inputs inside table rows and modals.

```jsx
<div className="relative">
  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">Rp</span>
  <input
    type="text"
    inputMode="numeric"
    value={amount}
    onChange={(e) => setAmount(formatDigitsInput(e.target.value))}
    placeholder="0"
    className="w-full pl-10 ..." // plus the screen's usual input classes
  />
</div>
```

- **Prefix:** a fixed label, not part of the typed value. Keep `text-gray-400 text-sm`, and leave enough left padding (`pl-9`/`pl-10`) so the digits never overlap it. The stock modals already do this with `absolute left-3 top-2` and `pl-9`.
- **On CSS-styled screens** use the same structure with a screen class instead of Tailwind. `BulkPurchaseModal.css` has `.bulk-money-field` (wrapper), `.bulk-money-prefix` (the `Rp`) and a left-padded `.bulk-input` inside it.
- **Separator:** reformat on every change with `formatDigitsInput`, and read the number back with `parseDigits` (both in `src/utils/cashflowUtils.js`). Keep amounts as plain integers in state and in Firestore; only the displayed text carries dots.
- **Input type:** `type="text"` with `inputMode="numeric"` (numeric keypad on phones). Never `type="number"`: it can't show dots.
- **Placeholder:** the bare number (`0`, or `e.g. 100.000`). Never repeat `Rp` in it, since the prefix is already visible.
- **Not covered:** quantities (`Jumlah`), percentages and counts aren't money. They get no prefix.
- **Read-only amounts** (table cells, totals, summaries) are not inputs. Format those with `formatRupiah` (see [Money](#money)).

### Dropdowns

**Rule: never use the browser's native dropdown (`<select>` or `<datalist>`). Always build a custom dropdown that matches the app's theme.** Native dropdown lists are drawn by the browser or OS, so they ignore our colors, radius and fonts and look different on every device.

Use the shared **`Dropdown`** (`src/components/common/Dropdown.js`) instead of hand-rolling a list per screen. It implements everything below.

```jsx
<Dropdown
  ariaLabel="Satuan"
  value={row.unit}
  options={[{ value: "pcs", label: "pcs" }, { value: "pack", label: "pack" }]}
  onChange={(unit) => handleUnitChange(row.id, unit)}
  placeholder="-"                 // default "Pilih..."
  triggerClassName="bulk-input"   // optional: match the screen's own inputs
/>
```

| Prop | Meaning |
|---|---|
| `value`, `options`, `onChange` | `options` are `{ value, label }`; `onChange` receives the option's `value` |
| `placeholder` | Shown while nothing is selected (default `Pilih...`) |
| `disabled` | Also disabled automatically when `options` is empty |
| `ariaLabel` | Accessible name for the trigger and the list |
| `triggerClassName` | Replaces the default (cashflow `INPUT_CLASS`) so the trigger matches the screen's other inputs |
| `className` | Extra classes on the wrapper |

Anatomy, built from the app's existing tokens (what `Dropdown` renders):

```jsx
<div className="relative">
  <button
    type="button"
    aria-haspopup="listbox"
    aria-expanded={open}
    onClick={() => setOpen((isOpen) => !isOpen)}
    className="flex w-full items-center justify-between gap-2 ..." // the screen's usual input classes
  >
    <span className={selected ? "text-gray-900" : "text-gray-400"}>{selected?.label ?? "Pilih..."}</span>
    <FaChevronDown className="w-3 h-3 text-gray-400" />
  </button>
  {open && (
    <ul
      role="listbox"
      className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
    >
      <li
        role="option"
        aria-selected={isSelected}
        className="cursor-pointer px-4 py-2.5 text-sm text-gray-700 hover:bg-[#fff8f8] hover:text-[#e66a6a]"
      >
        {label}
      </li>
    </ul>
  )}
</div>
```

- **Trigger:** looks like the screen's text inputs (same border, radius, height and focus ring), plus a `FaChevronDown`. Placeholder text is gray and in Indonesian (`Pilih...`).
- **Panel:** the same surface as the Stocks row-action menu (`bg-white border border-gray-200 shadow-lg py-1`), with `rounded-xl` on cashflow screens. Cap the height with `max-h-60 overflow-y-auto`.
- **Options:** `px-4 py-2.5 text-sm text-gray-700`. The hovered or keyboard-highlighted option uses the brand tint, `bg-[#fff8f8] text-[#e66a6a]`, the same as secondary-button hover. The selected option is `font-semibold text-[#e66a6a]` with a `FaCheck`.
- **Disabled:** `disabled:opacity-40` on the trigger, and the panel never opens.
- **Keyboard and accessibility** (a native `<select>` gave these for free, so a custom one must too):
  - opens on click, Enter, Space or ArrowDown
  - ArrowUp / ArrowDown move the highlight, Enter selects, Tab closes
  - Escape closes the dropdown only. Inside a modal it must not also close the modal.
  - a click outside closes it
  - the trigger has `aria-haspopup="listbox"` and `aria-expanded`; the list has `role="listbox"`; each option has `role="option"` and `aria-selected`
- **Inside modals, tables and scroll areas:** a list positioned inside an `overflow-hidden` or scrolling parent gets clipped. `Dropdown` always renders its list in a portal with fixed positioning, at `z-[1100]` (above `ModalShell`'s `z-[1000]` / `z-[1010]` and the CSS-overlay modals' `1000`). It flips above the trigger when there is no room below, and closes on scroll or resize because a fixed list can't follow its trigger. Lists you build by hand (see below) must follow the same portal and z-index rules.
- **Long lists** (products, members) are searched by typing: the product-search lists in `BulkPurchaseModal` and `WarehouseExitModal` are the precedent. They are a text input with a results list, not a `Dropdown`. `BulkPurchaseModal`'s follows this section's theme, ARIA roles (`role="combobox"` on the input, `listbox` / `option` on the list), Tab-to-close and Escape-closes-only-the-list. Show the list only when there are matches or a "not found" message, never an empty box.
- **Not covered by this rule:** date and time inputs (`type="date"`), which use the browser's own picker. The account picker (`AccountPills`) is a button group, not a dropdown.

### Account picker

`AccountPills` (`src/components/cashflow/CashflowModals.js`) chooses between the cashflow accounts.

- Selected: `bg-gradient-to-r from-[#e66a6a] to-[#d35454] text-white shadow-xs`
- Unselected: `bg-gray-100 text-gray-600 hover:bg-gray-200`
- Horizontal by default; pass `vertical` to stack the options.
- Pass `accounts={MONEY_ACCOUNTS}` (Cash, QRIS) or `accounts={ACCOUNTS}` (Cash, QRIS, Kredit), depending on whether Kredit makes sense.

### Modals

Three modal styles exist:

| Pattern | Used by | Look |
|---|---|---|
| **`ModalShell`** (`cashflow/CashflowModals.js`) | Finance and cashflow dialogs (10 uses) | `bg-black/30 backdrop-blur-sm` backdrop, `rounded-2xl` panel, title + optional subtitle, close button, `max-w-md` or `wide` (`max-w-2xl`) |
| **Tailwind modal** | StockModal and other stock dialogs | `fixed inset-0 bg-black/50 z-50` backdrop, `rounded-xl` panel, header with `border-b`, footer `bg-gray-50 border-t` with buttons right-aligned |
| **CSS overlay** (`*-overlay` classes) | Older screens, e.g. `bulk-modal-overlay`, `stockmodal-overlay` (39 uses) | Defined per screen in `src/styles/` |

For a new dialog, use `ModalShell`. Every modal should:

- close on the ✕ button and on backdrop click (`ModalShell` does both). StockModal also closes on Escape.
- cap its height and scroll inside: `max-h-[90vh] overflow-y-auto`.
- keep a side margin on phones (`mx-4`, or `p-4` on the overlay).
- when it opens on top of another modal, use `ModalShell`'s `elevated` prop (`z-[1010]` instead of `z-[1000]`).

### Tables

- **Header row:** `bg-gray-50 border-b border-gray-200`; header cells `text-xs font-bold uppercase tracking-wider`.
- **Cell padding:** `px-5`/`px-6` horizontally, `py-3` vertically.
- **Money columns** are right-aligned (`text-right`).
- Wrap wide tables in a rounded, bordered container with `overflow-hidden` (Finance) or horizontal scroll.

### Feedback

| Situation | Pattern |
|---|---|
| Success | Snackbar, bottom-right, auto-hides after 3 s: `fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg z-50 text-sm` (Stocks and WarehouseStock via `showSuccessMessage`; SejarahTransaksi, NotaBelanjaB2B, WarehouseExit and others have their own snackbar). |
| Validation error | Inline red text under the field, or an error line above the modal's buttons. |
| Unexpected error | Currently `alert(...)` (about 100 calls). Prefer an inline message in new code. |
| Destructive confirm | Cashflow: a confirm step inside the modal (`Hapus Pengeluaran?`). Older screens: `window.confirm` (16 calls). |
| Warning / pending work | Amber banner, e.g. the legacy-import banner on Finance. |
| Empty state | Centered gray text with a muted icon, e.g. `Belum ada pengeluaran`. |
| Loading | Short gray text, e.g. `Memuat...`. |

### Icons

Use **Font Awesome via `react-icons/fa`** only. It is the only icon set imported anywhere (24 files). Size icons with Tailwind (`w-3 h-3`, `w-3.5 h-3.5`) or let them inherit the font size.

---

## Copy and formatting

### Language

UI text is in **Bahasa Indonesia**. Common labels:

| Action | Label |
|---|---|
| Save | `Simpan` (`Simpan Perubahan` when editing) |
| Cancel | `Batal` |
| Delete | `Hapus` (`Hapus Permanen` for irreversible deletes) |
| Close | `Tutup` |
| Add | `Tambah …` (e.g. `Tambah Barang`) |
| In progress | `Menyimpan...`, `Menghapus...`, `Memuat...` |

Cashflow account names come from `ACCOUNT_LABELS`: **Cash**, **QRIS**, **Kredit**.

### Money

- Display as `Rp` + space + dot-grouped digits: **`Rp 1.250.000`**, negative **`-Rp 50.000`**.
- Use `formatRupiah` / `fmtAmount` from `src/utils/cashflowUtils.js`. Both use `Intl.NumberFormat("id-ID")`.
- Amounts are whole Rupiah. Round before display.
- For input fields (as opposed to displayed amounts), see [Money inputs](#money-inputs).

### Dates

Use the Indonesian month names and helpers in `cashflowUtils.js` (`formatDayLabel`, `formatMonthLabel`). Dates are keyed in local time as `YYYY-MM-DD`.

---

## Open decisions

These inconsistencies exist today. Settle them before standardizing:

1. **Two brand reds.** Coral `#e66a6a` (sidebar, Finance) and Tailwind `primary` `#ED3500` (stock screens). The coral isn't in `tailwind.config.js`, so it's written as arbitrary values (`from-[#e66a6a]`) throughout.
2. **Save button color.** StockModal saves with blue (`bg-blue-600`), Stocks uses `bg-primary`, and Finance uses the coral gradient.
3. **Unused theme colors.** `unimart-pink` and `unimart-purple` are configured but almost never used.
4. **Three modal styles** (see [Modals](#modals)).
5. **Leftover English copy.** Some stock success messages are English (`Stock updated (Tetapkan)!`). Pembelian Grosir is already Indonesian (`Simpan` / `Batal`).
6. **Duplicate money helpers.** 16 components define their own `formatRupiah`, and they don't all add the `Rp` prefix. Prefer the shared helpers in `cashflowUtils.js`.
7. **Errors via `alert()`.** About 100 calls block the page instead of showing an inline message.
8. **Money inputs missing the `Rp` prefix.** The [Money inputs](#money-inputs) rule is decided, but these known inputs don't follow it yet (they already group digits unless noted):
   - cashflow `MoneyInput` (`CashflowModals.js`, 7 uses across Finance, Catat Pengeluaran and Laporan Harian). The cleanest fix is adding the prefix inside `MoneyInput` itself.
   - `PaymentModal` (QRIS, cash and amount-paid fields)
   - `WarehouseExitModal` (`Harga kulak` and `Harga satuan`; digit grouping not checked)

   Inputs that already show a prefix: `StockModal`, `WarehouseStockModal`, `EditNominalTabunganModal`, `RestrukturisasiModal` and `PinjamanModal`. This list comes from a search for money-like fields, not a full audit.
9. **Native dropdowns still in use.** The [Dropdowns](#dropdowns) rule is decided and the shared `Dropdown` exists, but only the Pembelian Grosir modal uses it so far. The rest of the app still has 51 native `<select>` elements in 19 files (most: `StockModal` 14, `WarehouseStockModal` 7, `EditMemberModal` 6, `AddMemberModal` 4; also the Tetapkan Stok unit picker, the Finance page, Transaksi, Daftar Anggota, Admin Panel and the login and register forms) plus one `<datalist>` (`ExpenseCategoryInput`, the expense category field). The legacy `Stocks Warehouse.js` is fully commented out and not counted. Other hand-built lists (product search in `WarehouseExitModal`, the Stocks row menu) are still styled separately, and `WarehouseExitModal`'s doesn't yet follow the theme or ARIA roles.
10. **Member page is still width-capped.** The [full-width rule](#layout) covers the admin pages beside the sidebar. The member-facing page (`MemberPage`, no sidebar) keeps `.member-content { max-width: 1100px; margin: 0 auto }` in `Member.css`, and `pageWidth.test.js` doesn't cover it. Decide whether it should fill the width too.

---

## Checklist for new UI

- [ ] Tailwind classes, copying patterns from the cashflow components
- [ ] Brand coral for primary actions and selected states; gray scale for everything else
- [ ] Indonesian copy (`Simpan`, `Batal`, `Hapus`, `Menyimpan...`)
- [ ] Displayed money via `formatRupiah` / `fmtAmount`
- [ ] Every money input has a fixed `Rp` prefix and a thousands separator (`formatDigitsInput`)
- [ ] No native `<select>` / `<datalist>`: use the custom dropdown (keyboard, ARIA, portal inside modals)
- [ ] Modals via `ModalShell`: closable, scrollable, margin on phones
- [ ] Icons from `react-icons/fa`; `aria-label` on icon-only buttons
- [ ] Page container fills the width beside the sidebar: no `max-width`, no `mx-auto`
- [ ] Layout checked at 768px and below
