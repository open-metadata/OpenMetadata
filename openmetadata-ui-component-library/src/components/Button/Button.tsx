import React from "react";
import { Button as AriaButton } from "react-aria-components";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";
import { useTheme } from "../../theme";

export interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "link";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
  type?: "button" | "submit" | "reset";
  onPress?: () => void;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
  className?: string;
  "data-testid"?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  danger = false,
  type = "button",
  onPress,
  onClick,
  style,
  className,
  "data-testid": dataTestId,
}) => {
  const theme = useTheme();

  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  const variantClasses = {
    primary: danger 
      ? "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
      : "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
    outline: danger
      ? "border border-red-600 text-red-600 hover:bg-red-50 focus:ring-red-500"
      : "border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-blue-500",
    ghost: danger
      ? "text-red-600 hover:bg-red-50 focus:ring-red-500"
      : "text-gray-700 hover:bg-gray-100 focus:ring-gray-500",
    link: danger
      ? "text-red-600 hover:text-red-700 underline hover:no-underline focus:ring-red-500 p-0 h-auto"
      : "text-blue-600 hover:text-blue-700 underline hover:no-underline focus:ring-blue-500 p-0 h-auto"
  };

  const sizeClasses = {
    sm: variant === "link" ? "" : "px-3 py-1.5 text-sm h-8",
    md: variant === "link" ? "" : "px-4 py-2 text-base h-10",
    lg: variant === "link" ? "" : "px-6 py-3 text-lg h-12"
  };

  const buttonClasses = twMerge(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    loading && "cursor-wait",
    className
  );

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(event);
    }
  };

  return (
    <AriaButton
      type={type}
      isDisabled={disabled || loading}
      onPress={handlePress}
      className={buttonClasses}
      style={{ ...theme.button, ...style }}
      data-testid={dataTestId}
      // @ts-ignore - React Aria Button doesn't have onClick but we can add it
      onClick={handleClick}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          Loading...
        </span>
      ) : (
        children
      )}
    </AriaButton>
  );
};
