/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import React from "react";
import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cx } from "@/utils/cx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Untitled UI type scale variants (display-2xl = largest, text-xs = smallest) */
export type TypographyVariant =
  | "display-2xl"
  | "display-xl"
  | "display-lg"
  | "display-md"
  | "display-sm"
  | "display-xs"
  | "text-xl"
  | "text-lg"
  | "text-md"
  | "text-sm"
  | "text-xs";

export type TypographyWeight = "regular" | "medium" | "semibold" | "bold";

export type TypographyColor =
  | "primary"
  | "secondary"
  | "tertiary"
  | "quaternary"
  | "disabled"
  | "error"
  | "success"
  | "warning"
  | "white"
  | "brand"
  | "inherit";

export type TypographyQuoteVariant =
  | "default"
  | "centered-quote"
  | "minimal-quote";

export interface TypographyProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  /**
   * Untitled UI type scale. Controls font-size and line-height, and determines
   * the default rendered HTML element.
   *
   * **Default element mapping:**
   * - `display-2xl` → `<h1>` · `display-xl` → `<h2>` · `display-lg` → `<h3>`
   * - `display-md` → `<h4>` · `display-sm` → `<h5>` · `display-xs` → `<h6>`
   * - `text-xl`, `text-lg`, `text-md`, `text-sm` → `<p>`
   * - `text-xs` → `<span>`
   *
   * @default "text-sm" (14px)
   */
  variant?: TypographyVariant;
  /** Font weight. @default "regular" */
  weight?: TypographyWeight;
  /**
   * Semantic text color backed by `--color-text-*` design tokens from theme.css.
   * @default "primary"
   */
  color?: TypographyColor;
  /**
   * Override the rendered HTML element. By default it is inferred from the variant.
   *
   * **Breaking change note:** The previous `Typography` implementation always rendered a `<div>`.
   * Pass `as="div"` or `as="span"` to preserve that behaviour for existing consumers.
   */
  as?: ElementType;
  /** Prose quote style for rich-text containers. @default "default" */
  quoteVariant?: TypographyQuoteVariant;
  className?: string;
}

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

/**
 * Tailwind text-size utility classes per variant.
 * Tokens are defined in theme.css (@theme static).
 * These classes are intentionally applied after the `prose` class in cx() so
 * that in CSS cascade they can override the prose base font-size.
 */
const variantClasses: Record<TypographyVariant, string> = {
  "display-2xl": "tw:text-display-2xl",
  "display-xl": "tw:text-display-xl",
  "display-lg": "tw:text-display-lg",
  "display-md": "tw:text-display-md",
  "display-sm": "tw:text-display-sm",
  "display-xs": "tw:text-display-xs",
  "text-xl": "tw:text-xl",
  "text-lg": "tw:text-lg",
  "text-md": "tw:text-md",
  "text-sm": "tw:text-sm",
  "text-xs": "tw:text-xs",
};

/**
 * Default semantic HTML tag per variant.
 *
 * - `display-*` variants → heading elements (`h1`–`h6`), one per display step,
 *   so no two display variants produce the same heading level by default.
 * - `text-*` variants → `<p>` / `<span>` (body text — not headings).
 *
 * Use the `as` prop to override when you need a different semantic element.
 */
const variantTags: Record<TypographyVariant, ElementType> = {
  "display-2xl": "h1",
  "display-xl": "h2",
  "display-lg": "h3",
  "display-md": "h4",
  "display-sm": "h5",
  "display-xs": "h6",
  "text-xl": "p",
  "text-lg": "p",
  "text-md": "p",
  "text-sm": "p",
  "text-xs": "span",
};

const weightClasses: Record<TypographyWeight, string> = {
  regular: "tw:font-normal",
  medium: "tw:font-medium",
  semibold: "tw:font-semibold",
  bold: "tw:font-bold",
};

/**
 * Semantic color classes backed by `--color-text-*` tokens in theme.css.
 */
const colorClasses: Record<TypographyColor, string> = {
  primary: "tw:text-primary",
  secondary: "tw:text-secondary",
  tertiary: "tw:text-tertiary",
  quaternary: "tw:text-quaternary",
  disabled: "tw:text-disabled",
  error: "tw:text-error-primary",
  success: "tw:text-success-primary",
  warning: "tw:text-warning-primary",
  white: "tw:text-white",
  brand: "tw:text-brand-primary",
  inherit: "tw:text-inherit",
};

const quoteStyles: Record<TypographyQuoteVariant, string> = {
  default: "",
  "centered-quote": "prose-centered-quote",
  "minimal-quote": "prose-minimal-quote",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `Typography` — A MUI-like text primitive built on Untitled UI's design system.
 *
 * - Applies the `prose` class (Untitled UI convention) for rich-text child styles
 *   (links, code, blockquotes, lists).
 * - `variant` controls size (Untitled UI type scale) and the default HTML tag.
 * - `weight` and `color` map to design tokens from `theme.css`.
 * - Use `as` to override the rendered HTML element.
 * - Supports `ref` forwarding for imperative DOM access.
 *
 * @example
 * <Typography variant="display-sm" weight="semibold">Page Title</Typography>
 * <Typography variant="text-sm" color="secondary">Body text</Typography>
 * <Typography variant="text-xs" as="span" color="tertiary">Label</Typography>
 * <Typography quoteVariant="centered-quote"><blockquote>…</blockquote></Typography>
 */
export const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  (props, ref) => {
    const {
      as,
      variant = "text-sm",
      weight = "regular",
      color = "primary",
      quoteVariant = "default",
      className,
      children,
      ...otherProps
    } = props;

    const Component = as ?? variantTags[variant];

    return (
      <Component
        ref={ref}
        {...otherProps}
        className={cx(
          // `prose` provides Untitled UI rich-text styles for child elements
          // (links, code, blockquotes, lists). The variant class is placed
          // after prose so it overrides prose's root font-size in the cascade.
          "prose",
          quoteStyles[quoteVariant],
          variantClasses[variant],
          weightClasses[weight],
          colorClasses[color],
          className,
        )}
      >
        {children}
      </Component>
    );
  },
);

Typography.displayName = "Typography";
