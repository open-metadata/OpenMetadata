import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Select as AriaSelect,
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
  Label,
} from "react-aria-components";
import { ChevronDown, X } from "@untitled-ui/icons-react";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";
import { noop } from "lodash";

export interface SelectOption {
  id: string;
  name: string;
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string | string[];
  defaultValue?: string | string[];
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  multiple?: boolean;
  allowClear?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
  onSelectionChange?: (value: string | string[] | null) => void;
  onChange?: (value: string | string[], options: SelectOption | SelectOption[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
  "data-testid"?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  defaultValue,
  options = [],
  placeholder = "Select option(s)",
  disabled = false,
  loading = false,
  multiple = false,
  allowClear = true,
  label,
  size = "md",
  className,
  style,
  onSelectionChange = noop,
  onChange = noop,
  onFocus = noop,
  onBlur = noop,
  onClear = noop,
  "data-testid": dataTestId,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const sizeClasses = {
    sm: "h-8 text-sm px-3",
    md: "h-10 text-base px-3",
    lg: "h-12 text-lg px-4",
  };

  const handleSelectionChange = useCallback(
    (selection: any) => {
      // Handle React Aria's selection change
      let keySet: Set<string>;
      
      if (selection === "all") {
        keySet = new Set(options.map(opt => opt.value));
      } else if (selection instanceof Set) {
        keySet = selection;
      } else {
        keySet = new Set(selection ? [selection] : []);
      }
      
      setSelectedKeys(keySet);
      
      const selectedValues = Array.from(keySet);
      const selectedOptions = options.filter(opt => keySet.has(opt.value));
      
      if (multiple) {
        onSelectionChange(selectedValues);
        onChange(selectedValues, selectedOptions);
      } else {
        const singleValue = selectedValues[0] || null;
        const singleOption = selectedOptions[0] || null;
        onSelectionChange(singleValue);
        onChange(singleValue as string, singleOption as SelectOption);
      }
    },
    [multiple, onChange, onSelectionChange, options]
  );

  const handleClear = useCallback(() => {
    setSelectedKeys(new Set());
    onClear();
    onSelectionChange(multiple ? [] : null);
    onChange(multiple ? [] : "", multiple ? [] : null);
  }, [multiple, onChange, onClear, onSelectionChange]);

  const selectedOptions = useMemo(() => {
    return options.filter(opt => selectedKeys.has(opt.value));
  }, [options, selectedKeys]);

  const displayValue = useMemo(() => {
    if (selectedKeys.size === 0) return placeholder;
    
    if (multiple) {
      return selectedOptions.map(opt => opt.label).join(", ");
    } else {
      return selectedOptions[0]?.label || placeholder;
    }
  }, [selectedKeys, selectedOptions, multiple, placeholder]);

  // Initialize selected keys from value/defaultValue
  useEffect(() => {
    if (value !== undefined) {
      const keys = Array.isArray(value) ? value : [value].filter(Boolean);
      setSelectedKeys(new Set(keys));
    } else if (defaultValue !== undefined) {
      const keys = Array.isArray(defaultValue) ? defaultValue : [defaultValue].filter(Boolean);
      setSelectedKeys(new Set(keys));
    }
  }, [value, defaultValue]);

  const selectClasses = twMerge(
    "relative w-full border border-gray-300 rounded-md bg-white shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed",
    sizeClasses[size],
    className
  );

  const buttonClasses = twMerge(
    "w-full flex items-center justify-between text-left outline-none",
    disabled && "cursor-not-allowed text-gray-400"
  );

  if (loading) {
    return (
      <div className={selectClasses} style={style} data-testid={dataTestId}>
        <div className={buttonClasses}>
          <span className="text-gray-500">Loading...</span>
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div style={style} data-testid={dataTestId}>
      {label && (
        <Label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </Label>
      )}
      <AriaSelect
        isDisabled={disabled}
        // @ts-ignore - React Aria Select has different prop structure
        selectionMode={multiple ? "multiple" : "single"}
        selectedKeys={selectedKeys}
        onSelectionChange={handleSelectionChange}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <Button className={selectClasses}>
          <SelectValue className={buttonClasses}>
            <span className={clsx(
              "block truncate",
              selectedKeys.size === 0 && "text-gray-500"
            )}>
              {displayValue}
            </span>
            <span className="flex items-center gap-1">
              {allowClear && selectedKeys.size > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                  aria-label="Clear selection"
                >
                  <X className="h-3 w-3 text-gray-400" />
                </button>
              )}
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </span>
          </SelectValue>
        </Button>
        
        <Popover className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto z-50">
          <ListBox className="outline-none">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No options found
              </div>
            ) : (
              options.map((option) => (
                <ListBoxItem
                  key={option.value}
                  id={option.value}
                  textValue={option.label}
                  isDisabled={option.disabled}
                  className={({ isSelected, isHovered, isDisabled }) =>
                    clsx(
                      "px-3 py-2 text-sm cursor-pointer outline-none select-none",
                      isSelected && "bg-blue-500 text-white",
                      isHovered && !isSelected && "bg-gray-100",
                      isDisabled && "text-gray-400 cursor-not-allowed"
                    )
                  }
                >
                  {option.label}
                </ListBoxItem>
              ))
            )}
          </ListBox>
        </Popover>
      </AriaSelect>
    </div>
  );
};