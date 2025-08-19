import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { ThemeProvider } from "../../theme";

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe("Button Component", () => {
  const user = userEvent.setup();

  it("renders button with text", () => {
    renderWithTheme(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick handler when clicked", async () => {
    const handleClick = jest.fn();
    renderWithTheme(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByText("Click me");
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders with different variants", () => {
    const { rerender } = renderWithTheme(<Button variant="primary">Primary</Button>);
    expect(screen.getByText("Primary")).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <Button variant="secondary">Secondary</Button>
      </ThemeProvider>
    );
    expect(screen.getByText("Secondary")).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <Button variant="outline">Outline</Button>
      </ThemeProvider>
    );
    expect(screen.getByText("Outline")).toBeInTheDocument();
  });

  it("renders with different sizes", () => {
    const { rerender } = renderWithTheme(<Button size="sm">Small</Button>);
    expect(screen.getByText("Small")).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <Button size="md">Medium</Button>
      </ThemeProvider>
    );
    expect(screen.getByText("Medium")).toBeInTheDocument();

    rerender(
      <ThemeProvider>
        <Button size="lg">Large</Button>
      </ThemeProvider>
    );
    expect(screen.getByText("Large")).toBeInTheDocument();
  });

  it("disables button when disabled prop is true", () => {
    renderWithTheme(<Button disabled>Disabled</Button>);
    const button = screen.getByText("Disabled");
    expect(button).toBeDisabled();
  });

  it("shows loading state", () => {
    renderWithTheme(<Button loading>Original Text</Button>);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Original Text")).not.toBeInTheDocument();
  });

  it("disables button when loading", () => {
    renderWithTheme(<Button loading>Loading Button</Button>);
    const button = screen.getByText("Loading...");
    expect(button).toBeDisabled();
  });

  it("renders with danger variant", () => {
    renderWithTheme(<Button danger>Delete</Button>);
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    renderWithTheme(<Button className="custom-class">Custom</Button>);
    const button = screen.getByText("Custom");
    expect(button).toHaveClass("custom-class");
  });

  it("applies custom styles", () => {
    const customStyle = { backgroundColor: "red", color: "white" };
    renderWithTheme(<Button style={customStyle}>Styled</Button>);
    const button = screen.getByText("Styled");
    expect(button).toHaveStyle("color: white");
  });

  it("renders with correct html type", () => {
    renderWithTheme(<Button type="submit">Submit</Button>);
    const button = screen.getByText("Submit");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("includes data-testid when provided", () => {
    renderWithTheme(<Button data-testid="test-button">Test</Button>);
    expect(screen.getByTestId("test-button")).toBeInTheDocument();
  });

  it("does not call onClick when disabled", async () => {
    const handleClick = jest.fn();
    renderWithTheme(
      <Button onClick={handleClick} disabled>
        Disabled Button
      </Button>
    );
    
    const button = screen.getByText("Disabled Button");
    await user.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not call onClick when loading", async () => {
    const handleClick = jest.fn();
    renderWithTheme(
      <Button onClick={handleClick} loading>
        Loading Button
      </Button>
    );
    
    const button = screen.getByText("Loading...");
    await user.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders ghost variant", () => {
    renderWithTheme(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByText("Ghost")).toBeInTheDocument();
  });

  it("renders link variant", () => {
    renderWithTheme(<Button variant="link">Link</Button>);
    expect(screen.getByText("Link")).toBeInTheDocument();
  });
});
