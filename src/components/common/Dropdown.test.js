import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Dropdown from "./Dropdown";

const OPTIONS = [
  { value: "pcs", label: "pcs" },
  { value: "pack", label: "pack" },
  { value: "dus", label: "dus" },
];

const Harness = ({ initial = "", onParentKeyDown = jest.fn(), ...props }) => {
  const [value, setValue] = useState(initial);
  return (
    <div onKeyDown={onParentKeyDown}>
      <Dropdown
        ariaLabel="Satuan"
        value={value}
        options={OPTIONS}
        onChange={setValue}
        {...props}
      />
      <button type="button">elsewhere</button>
    </div>
  );
};

const trigger = () => screen.getByRole("button", { name: "Satuan" });

describe("Dropdown", () => {
  test("never renders a native select", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector("select")).toBeNull();
  });

  test("shows the placeholder when nothing is selected", () => {
    render(<Harness placeholder="Pilih satuan" />);
    expect(trigger()).toHaveTextContent("Pilih satuan");
    expect(trigger().querySelector("span")).toHaveClass("text-gray-400");
  });

  test("shows the selected label", () => {
    render(<Harness initial="pack" placeholder="Pilih satuan" />);
    expect(trigger()).toHaveTextContent("pack");
    expect(trigger().querySelector("span")).toHaveClass("text-gray-900");
  });

  test("opens on click and lists every option with listbox semantics", () => {
    render(<Harness initial="pack" />);

    expect(trigger()).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger());

    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("listbox");
    const options = within(list).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["pcs", "pack", "dus"]);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
  });

  test("renders the list in a portal so modals and tables cannot clip it", () => {
    const { container } = render(<Harness />);
    fireEvent.click(trigger());

    const list = screen.getByRole("listbox");
    expect(container).not.toContainElement(list);
    expect(document.body).toContainElement(list);
    expect(list).toHaveClass("fixed", "rounded-xl", "border-gray-200", "shadow-lg");
  });

  test("selects with a click and closes", () => {
    render(<Harness />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("option", { name: "dus" }));

    expect(trigger()).toHaveTextContent("dus");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("uses the brand tint for the highlighted option and coral for the selected one", () => {
    render(<Harness initial="pack" />);
    fireEvent.click(trigger());

    const [pcs, pack] = screen.getAllByRole("option");
    expect(pack).toHaveClass("font-semibold", "text-[#e66a6a]");
    expect(pack.querySelector("svg")).not.toBeNull();

    fireEvent.mouseEnter(pcs);
    expect(pcs).toHaveClass("bg-[#fff8f8]", "text-[#e66a6a]");
  });

  test("opens with the keyboard and picks with arrows and Enter", () => {
    render(<Harness />);

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: "ArrowUp" });
    fireEvent.keyDown(trigger(), { key: "Enter" });

    expect(trigger()).toHaveTextContent("pack");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("Space opens and selects, Home and End jump to the ends", () => {
    render(<Harness />);

    fireEvent.keyDown(trigger(), { key: " " });
    fireEvent.keyDown(trigger(), { key: "End" });
    fireEvent.keyDown(trigger(), { key: " " });

    expect(trigger()).toHaveTextContent("dus");
  });

  test("starts the highlight on the current value", () => {
    render(<Harness initial="dus" />);
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });

    expect(trigger()).toHaveAttribute("aria-activedescendant", expect.stringMatching(/-2$/));
  });

  test("Escape closes only the dropdown and never reaches a surrounding modal", () => {
    const onParentKeyDown = jest.fn();
    render(<Harness onParentKeyDown={onParentKeyDown} />);

    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onParentKeyDown).not.toHaveBeenCalled();
  });

  test("Tab closes the list", () => {
    render(<Harness />);
    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: "Tab" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("closes on an outside click but not when clicking inside the list", () => {
    render(<Harness />);
    fireEvent.click(trigger());

    fireEvent.mouseDown(screen.getByRole("listbox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText("elsewhere"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("closes when something else scrolls, but not when the list itself scrolls", () => {
    render(<Harness />);
    fireEvent.click(trigger());

    fireEvent.scroll(screen.getByRole("listbox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.scroll(document);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("does not crash when the scroll target is not a DOM node", () => {
    render(<Harness />);
    fireEvent.click(trigger());

    expect(() => fireEvent.scroll(window)).not.toThrow();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("does not open when disabled or when there are no options", () => {
    const { unmount } = render(<Harness disabled />);
    fireEvent.click(trigger());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger()).toBeDisabled();
    unmount();

    render(
      <Dropdown ariaLabel="Satuan" value="pcs" options={[]} onChange={jest.fn()} placeholder="-" />
    );
    expect(screen.getByRole("button", { name: "Satuan" })).toBeDisabled();
    // A value that is not in the options is still shown rather than hidden.
    expect(screen.getByRole("button", { name: "Satuan" })).toHaveTextContent("pcs");
  });

  test("uses the screen's own input classes when given, the cashflow ones otherwise", () => {
    const { unmount } = render(<Harness />);
    expect(trigger()).toHaveClass("rounded-xl", "border-gray-200");
    unmount();

    render(<Harness triggerClassName="bulk-input" />);
    expect(trigger()).toHaveClass("bulk-input");
    expect(trigger()).not.toHaveClass("rounded-xl");
  });
});
