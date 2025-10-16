import React from 'react';
import './AnimatedButton.css';

const AnimatedButton = ({ 
  children, 
  variant = "primary", 
  size = "medium",
  className = "", 
  disabled = false,
  loading = false,
  ...props 
}) => {
  const baseClasses = "animated-button";
  const variantClasses = {
    primary: "animated-button--primary",
    secondary: "animated-button--secondary",
    ghost: "animated-button--ghost"
  };
  
  const sizeClasses = {
    small: "animated-button--small",
    medium: "animated-button--medium",
    large: "animated-button--large"
  };
  
  const stateClasses = [
    disabled && "animated-button--disabled",
    loading && "animated-button--loading"
  ].filter(Boolean);
  
  const combinedClasses = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    ...stateClasses,
    className
  ].filter(Boolean).join(" ");

  return (
    <button
      className={combinedClasses}
      disabled={disabled || loading}
      {...props}
    >
      <div className="animated-button__shimmer" />
      <div className="animated-button__content">
        {loading && <div className="animated-button__spinner" />}
        {children}
      </div>
    </button>
  );
};

export { AnimatedButton };
export default AnimatedButton;
