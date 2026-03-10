import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  FC,
  ReactNode,
} from "react";
import React, { isValidElement } from "react";
import type {
  ButtonProps as AriaButtonProps,
  LinkProps as AriaLinkProps,
} from "react-aria-components";
import { Button as AriaButton, Link as AriaLink } from "react-aria-components";
import { cx, sortCx } from "@/utils/cx";
import { isReactComponent } from "@/utils/is-react-component";

export const styles = sortCx({
  common: {
    root: [
      "tw:group tw:relative tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center tw:justify-center tw:whitespace-nowrap tw:outline-brand tw:transition tw:duration-100 tw:ease-linear tw:before:absolute tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2",
      // When button is used within `InputGroup`
      "tw:in-data-input-wrapper:shadow-xs tw:in-data-input-wrapper:focus:!z-50 tw:in-data-input-wrapper:in-data-leading:-mr-px tw:in-data-input-wrapper:in-data-leading:rounded-r-none tw:in-data-input-wrapper:in-data-leading:before:rounded-r-none tw:in-data-input-wrapper:in-data-trailing:-ml-px tw:in-data-input-wrapper:in-data-trailing:rounded-l-none tw:in-data-input-wrapper:in-data-trailing:before:rounded-l-none",
      // Disabled styles
      "tw:disabled:cursor-not-allowed tw:disabled:text-fg-disabled",
      // Icon styles
      "tw:disabled:*:data-icon:text-fg-disabled_subtle",
      // Same as `icon` but for SSR icons that cannot be passed to the client as functions.
      "tw:*:data-icon:pointer-events-none tw:*:data-icon:size-5 tw:*:data-icon:shrink-0 tw:*:data-icon:transition-inherit-all",
    ].join(" "),
    icon: "tw:pointer-events-none tw:size-5 tw:shrink-0 tw:transition-inherit-all",
  },
  sizes: {
    sm: {
      root: [
        "tw:gap-1 tw:rounded-lg tw:px-3 tw:py-2 tw:text-sm tw:font-semibold tw:before:rounded-[7px] tw:data-icon-only:p-2",
        "tw:in-data-input-wrapper:px-3.5 tw:in-data-input-wrapper:py-2.5 tw:in-data-input-wrapper:data-icon-only:p-2.5",
      ].join(" "),
      linkRoot: "tw:gap-1",
    },
    md: {
      root: [
        "tw:gap-1 tw:rounded-lg tw:px-3.5 tw:py-2.5 tw:text-sm tw:font-semibold tw:before:rounded-[7px] tw:data-icon-only:p-2.5",
        "tw:in-data-input-wrapper:gap-1.5 tw:in-data-input-wrapper:px-4 tw:in-data-input-wrapper:text-md tw:in-data-input-wrapper:data-icon-only:p-3",
      ].join(" "),
      linkRoot: "tw:gap-1",
    },
    lg: {
      root: "tw:gap-1.5 tw:rounded-lg tw:px-4 tw:py-2.5 tw:text-md tw:font-semibold tw:before:rounded-[7px] tw:data-icon-only:p-3",
      linkRoot: "tw:gap-1.5",
    },
    xl: {
      root: "tw:gap-1.5 tw:rounded-lg tw:px-4.5 tw:py-3 tw:text-md tw:font-semibold tw:before:rounded-[7px] tw:data-icon-only:p-3.5",
      linkRoot: "tw:gap-1.5",
    },
  },

  colors: {
    primary: {
      root: [
        "tw:bg-brand-solid tw:text-white tw:shadow-xs-skeumorphic tw:ring-1 tw:ring-transparent tw:ring-inset tw:hover:bg-brand-solid_hover tw:data-loading:bg-brand-solid_hover",
        // Inner border gradient
        "tw:before:absolute tw:before:inset-px tw:before:border tw:before:border-white/12 tw:before:mask-b-from-0%",
        // Disabled styles
        "tw:disabled:bg-disabled tw:disabled:shadow-xs tw:disabled:ring-disabled_subtle",
        // Icon styles
        "tw:*:data-icon:text-button-primary-icon tw:hover:*:data-icon:text-button-primary-icon_hover",
      ].join(" "),
    },
    secondary: {
      root: [
        "tw:bg-primary tw:text-secondary tw:shadow-xs-skeumorphic tw:ring-1 tw:ring-primary tw:ring-inset tw:hover:bg-primary_hover tw:hover:text-secondary_hover tw:data-loading:bg-primary_hover",
        // Disabled styles
        "tw:disabled:shadow-xs tw:disabled:ring-disabled_subtle",
        // Icon styles
        "tw:*:data-icon:text-fg-quaternary tw:hover:*:data-icon:text-fg-quaternary_hover",
      ].join(" "),
    },
    tertiary: {
      root: [
        "tw:text-tertiary tw:hover:bg-primary_hover tw:hover:text-tertiary_hover tw:data-loading:bg-primary_hover",
        // Icon styles
        "tw:*:data-icon:text-fg-quaternary tw:hover:*:data-icon:text-fg-quaternary_hover",
      ].join(" "),
    },
    "link-gray": {
      root: [
        "tw:justify-normal tw:rounded tw:p-0! tw:text-tertiary tw:hover:text-tertiary_hover",
        // Inner text underline
        "tw:*:data-text:underline tw:*:data-text:decoration-transparent tw:*:data-text:underline-offset-2 tw:hover:*:data-text:decoration-current",
        // Icon styles
        "tw:*:data-icon:text-fg-quaternary tw:hover:*:data-icon:text-fg-quaternary_hover",
      ].join(" "),
    },
    "link-color": {
      root: [
        "tw:justify-normal tw:rounded tw:p-0! tw:text-brand-secondary tw:hover:text-brand-secondary_hover",
        // Inner text underline
        "tw:*:data-text:underline tw:*:data-text:decoration-transparent tw:*:data-text:underline-offset-2 tw:hover:*:data-text:decoration-current",
        // Icon styles
        "tw:*:data-icon:text-fg-brand-secondary_alt tw:hover:*:data-icon:text-fg-brand-secondary_hover",
      ].join(" "),
    },
    "primary-destructive": {
      root: [
        "tw:bg-error-solid tw:text-white tw:shadow-xs-skeumorphic tw:ring-1 tw:ring-transparent tw:outline-error tw:ring-inset tw:hover:bg-error-solid_hover tw:data-loading:bg-error-solid_hover",
        // Inner border gradient
        "tw:before:absolute tw:before:inset-px tw:before:border tw:before:border-white/12 tw:before:mask-b-from-0%",
        // Disabled styles
        "tw:disabled:bg-disabled tw:disabled:shadow-xs tw:disabled:ring-disabled_subtle",
        // Icon styles
        "tw:*:data-icon:text-button-destructive-primary-icon tw:hover:*:data-icon:text-button-destructive-primary-icon_hover",
      ].join(" "),
    },
    "secondary-destructive": {
      root: [
        "tw:bg-primary tw:text-error-primary tw:shadow-xs-skeumorphic tw:ring-1 tw:ring-error_subtle tw:outline-error tw:ring-inset tw:hover:bg-error-primary tw:hover:text-error-primary_hover tw:data-loading:bg-error-primary",
        // Disabled styles
        "tw:disabled:bg-primary tw:disabled:shadow-xs tw:disabled:ring-disabled_subtle",
        // Icon styles
        "tw:*:data-icon:text-fg-error-secondary tw:hover:*:data-icon:text-fg-error-primary",
      ].join(" "),
    },
    "tertiary-destructive": {
      root: [
        "tw:text-error-primary tw:outline-error tw:hover:bg-error-primary tw:hover:text-error-primary_hover tw:data-loading:bg-error-primary",
        // Icon styles
        "tw:*:data-icon:text-fg-error-secondary tw:hover:*:data-icon:text-fg-error-primary",
      ].join(" "),
    },
    "link-destructive": {
      root: [
        "tw:justify-normal tw:rounded tw:p-0! tw:text-error-primary tw:outline-error tw:hover:text-error-primary_hover",
        // Inner text underline
        "tw:*:data-text:underline tw:*:data-text:decoration-transparent tw:*:data-text:underline-offset-2 tw:hover:*:data-text:decoration-current",
        // Icon styles
        "tw:*:data-icon:text-fg-error-secondary tw:hover:*:data-icon:text-fg-error-primary",
      ].join(" "),
    },
  },
});

/**
 * Common props shared between button and anchor variants
 */
export interface CommonProps {
  /** Disables the button and shows a disabled state */
  isDisabled?: boolean;
  /** Shows a loading spinner and disables the button */
  isLoading?: boolean;
  /** The size variant of the button */
  size?: keyof typeof styles.sizes;
  /** The color variant of the button */
  color?: keyof typeof styles.colors;
  /** Icon component or element to show before the text */
  iconLeading?: FC<{ className?: string }> | ReactNode;
  /** Icon component or element to show after the text */
  iconTrailing?: FC<{ className?: string }> | ReactNode;
  /** Removes horizontal padding from the text content */
  noTextPadding?: boolean;
  /** When true, keeps the text visible during loading state */
  showTextWhileLoading?: boolean;
}

/**
 * Props for the button variant (non-link)
 */
export interface ButtonProps
  extends
    CommonProps,
    DetailedHTMLProps<
      Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "slot">,
      HTMLButtonElement
    > {
  /** Slot name for react-aria component */
  slot?: AriaButtonProps["slot"];
  /** Handler called when the button is pressed */
  onPress?: AriaButtonProps["onPress"];
  /** Handler called when a press interaction starts */
  onPressStart?: AriaButtonProps["onPressStart"];
  /** Handler called when a press interaction ends */
  onPressEnd?: AriaButtonProps["onPressEnd"];
  /** Handler called when the press state changes */
  onPressChange?: AriaButtonProps["onPressChange"];
  /** Handler called when a press is released over the target */
  onPressUp?: AriaButtonProps["onPressUp"];
}

/**
 * Props for the link variant (anchor tag)
 */
interface LinkProps
  extends
    CommonProps,
    DetailedHTMLProps<
      Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "color">,
      HTMLAnchorElement
    > {
  /** Options for the configured client side router. */
  routerOptions?: AriaLinkProps["routerOptions"];
}

/** Union type of button and link props */
export type Props = ButtonProps | LinkProps;

export const Button = ({
  size = "sm",
  color = "primary",
  children,
  className,
  noTextPadding,
  iconLeading: IconLeading,
  iconTrailing: IconTrailing,
  isDisabled: disabled,
  isLoading: loading,
  showTextWhileLoading,
  ...otherProps
}: Props) => {
  const href = "href" in otherProps ? otherProps.href : undefined;
  const Component = href ? AriaLink : AriaButton;

  const isIcon = (IconLeading || IconTrailing) && !children;
  const isLinkType = ["link-gray", "link-color", "link-destructive"].includes(
    color,
  );

  noTextPadding = isLinkType || noTextPadding;

  let props = {};

  if (href) {
    props = {
      ...otherProps,

      href: disabled ? undefined : href,
    };
  } else {
    props = {
      ...otherProps,

      type: otherProps.type || "button",
      isPending: loading,
    };
  }

  return (
    <Component
      data-loading={loading ? true : undefined}
      data-icon-only={isIcon ? true : undefined}
      {...props}
      isDisabled={disabled}
      className={cx(
        styles.common.root,
        styles.sizes[size].root,
        styles.colors[color].root,
        isLinkType && styles.sizes[size].linkRoot,
        (loading || (href && (disabled || loading))) &&
          "tw:pointer-events-none",
        // If in `loading` state, hide everything except the loading icon (and text if `showTextWhileLoading` is true).
        loading &&
          (showTextWhileLoading
            ? "tw:[&>*:not([data-icon=loading]):not([data-text])]:hidden"
            : "tw:[&>*:not([data-icon=loading])]:invisible"),
        className,
      )}
    >
      {/* Leading icon */}
      {isValidElement(IconLeading) && IconLeading}
      {isReactComponent(IconLeading) && (
        <IconLeading data-icon="leading" className={styles.common.icon} />
      )}

      {loading && (
        <svg
          fill="none"
          data-icon="loading"
          viewBox="0 0 20 20"
          className={cx(
            styles.common.icon,
            !showTextWhileLoading &&
              "tw:absolute tw:top-1/2 tw:left-1/2 tw:-translate-x-1/2 tw:-translate-y-1/2",
          )}
        >
          {/* Background circle */}
          <circle
            className="tw:stroke-current tw:opacity-30"
            cx="10"
            cy="10"
            r="8"
            fill="none"
            strokeWidth="2"
          />
          {/* Spinning circle */}
          <circle
            className="tw:origin-center tw:animate-spin tw:stroke-current"
            cx="10"
            cy="10"
            r="8"
            fill="none"
            strokeWidth="2"
            strokeDasharray="12.5 50"
            strokeLinecap="round"
          />
        </svg>
      )}

      {children && (
        <span
          data-text
          className={cx(
            "tw:transition-inherit-all",
            !noTextPadding && "tw:px-0.5",
          )}
        >
          {children}
        </span>
      )}

      {/* Trailing icon */}
      {isValidElement(IconTrailing) && IconTrailing}
      {isReactComponent(IconTrailing) && (
        <IconTrailing data-icon="trailing" className={styles.common.icon} />
      )}
    </Component>
  );
};
