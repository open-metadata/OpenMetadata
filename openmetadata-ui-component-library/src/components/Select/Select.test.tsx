import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";
import type { SelectOption } from "./Select";

const mockOptions: SelectOption[] = [
  { id: "1", name: "apple", label: "Apple", value: "apple" },
  { id: "2", name: "banana", label: "Banana", value: "banana" },
  { id: "3", name: "cherry", label: "Cherry", value: "cherry" },
  { id: "4", name: "date", label: "Date", value: "date", disabled: true },
];

// Mock UntitledUI icons
jest.mock("@untitled-ui/icons-react", () => ({
  ChevronDown: ({ className }: { className?: string }) => 
    <div data-testid="chevron-down" className={className}>⌄</div>,
  X: ({ className }: { className?: string }) => 
    <div data-testid="x-mark" className={className}>×</div>,
}));

describe("Select Component", () => {
  const user = userEvent.setup();

  it("renders correctly with options", () => {
    render(
      <Select
        options={mockOptions}
        placeholder="Select a fruit"
        data-testid="fruit-select"
      />
    );

    expect(screen.getByTestId("fruit-select")).toBeInTheDocument();
    expect(screen.getByText("Select a fruit")).toBeInTheDocument();
    expect(screen.getByTestId("chevron-down")).toBeInTheDocument();
  });

  it("renders with default value", () => {
    render(
      <Select
        options={mockOptions}
        defaultValue="banana"
        data-testid="fruit-select"
      />
    );

    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("handles onChange callback", async () => {
    const handleChange = jest.fn();

    render(
      <Select
        options={mockOptions}
        onChange={handleChange}
        data-testid="fruit-select"
      />
    );

    // Basic test that component renders with change handler
    expect(screen.getByTestId("fruit-select")).toBeInTheDocument();
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("renders in multiple mode", () => {
    render(
      <Select
        options={mockOptions}
        multiple
        data-testid="fruit-select"
      />
    );

    expect(screen.getByTestId("fruit-select")).toBeInTheDocument();
  });

  it("shows disabled state", () => {
    render(
      <Select
        options={mockOptions}
        disabled
        data-testid="fruit-select"
      />
    );

    expect(screen.getByTestId("fruit-select")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <Select
        options={[]}
        loading
        data-testid="fruit-select"
      />
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays label when provided", () => {
    render(
      <Select
        options={mockOptions}
        label="Choose a fruit"
        data-testid="fruit-select"
      />
    );

    expect(screen.getByText("Choose a fruit")).toBeInTheDocument();
  });

  it("shows clear button when allowClear is true and has value", () => {
    render(
      <Select
        options={mockOptions}
        allowClear
        defaultValue="apple"
        data-testid="fruit-select"
      />
    );

    expect(screen.getByLabelText("Clear selection")).toBeInTheDocument();
  });

  it("handles clear button click", async () => {
    const handleClear = jest.fn();

    render(
      <Select
        options={mockOptions}
        allowClear
        defaultValue="apple"
        onClear={handleClear}
        data-testid="fruit-select"
      />
    );

    const clearButton = screen.getByLabelText("Clear selection");
    await user.click(clearButton);

    expect(handleClear).toHaveBeenCalled();
  });

  it("renders different sizes", () => {
    const { rerender } = render(
      <Select
        options={mockOptions}
        size="sm"
        data-testid="fruit-select"
      />
    );

    expect(screen.getByTestId("fruit-select")).toBeInTheDocument();

    rerender(
      <Select
        options={mockOptions}
        size="lg"
        data-testid="fruit-select"
      />
    );

    expect(screen.getByTestId("fruit-select")).toBeInTheDocument();
  });
});