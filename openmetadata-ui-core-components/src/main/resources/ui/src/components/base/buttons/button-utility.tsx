import { Tooltip } from '@/components/base/tooltip/tooltip';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import { borderAfter } from '@/utils/tailwindClasses';
import { styles as buttonStyles } from './button';
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  DetailedHTMLProps,
  FC,
  ReactNode,
} from 'react';
import { isValidElement } from 'react';
import type { Placement } from 'react-aria';
import type {
  ButtonProps as AriaButtonProps,
  LinkProps as AriaLinkProps,
} from 'react-aria-components';
import { Button as AriaButton, Link as AriaLink } from 'react-aria-components';

const neutralIcon =
  'tw:text-utility-gray-500 tw:hover:text-utility-gray-600 tw:*:data-icon:text-current';

export const styles = {
  primary: buttonStyles.colors.primary.root,
  secondary: [
    'tw:bg-surface tw:shadow-xs-skeuomorphic',
    'tw:hover:bg-primary_hover tw:dark:hover:bg-raised tw:disabled:shadow-xs',
    borderAfter,
    'tw:after:outline-primary tw:disabled:after:outline-disabled_subtle',
    neutralIcon,
  ].join(' '),
  tertiary: `tw:hover:bg-primary_hover ${neutralIcon}`,
  'secondary-destructive': buttonStyles.colors['secondary-destructive'].root,
  'tertiary-destructive': buttonStyles.colors['tertiary-destructive'].root,
};

// A toggle that is on (the panel it opens is showing) reads in brand, over
// whichever colour it rests in, hovered too: secondary's dark hover is its
// own variant, so it is overridden by name.
const selectedStyles =
  'tw:bg-brand-primary tw:hover:bg-brand-primary tw:dark:hover:bg-brand-primary tw:text-brand-secondary tw:hover:text-brand-secondary tw:*:data-icon:text-current';

// Icon-only sizes from the Figma "Icons in buttons" spec: box size, icon frame,
// padding, radius. The svg padding keeps the glyph at frame − 4px (see the note
// in button.tsx); `before:` matches the primary variant's inner border to the radius.
const sizes = {
  xs: 'tw:rounded-sm tw:before:rounded-[3px] tw:p-0.5 tw:*:data-icon:size-4 tw:*:data-icon:p-[0.5px]', // 20 · 16 frame · 2px · r4
  sm: 'tw:rounded-md tw:before:rounded-[5px] tw:p-0.75 tw:*:data-icon:size-4.5 tw:*:data-icon:p-[0.25px]', // 24 · 18 frame · 3px · r6
  md: 'tw:rounded-md tw:before:rounded-[5px] tw:p-1.25 tw:*:data-icon:size-4.5 tw:*:data-icon:p-[0.25px]', // 28 · 18 frame · 5px · r6
  lg: 'tw:rounded-lg tw:before:rounded-[7px] tw:p-1.5 tw:*:data-icon:size-5', // 32 · 20 frame · 6px · r8
  xl: 'tw:rounded-lg tw:before:rounded-[7px] tw:p-2 tw:*:data-icon:size-5', // 36 · 20 frame · 8px · r8
};

// The 20px size is for tight inline actions (removing a chip, clearing an
// input, row actions inside text), so it never draws a border.
const borderless: Partial<Record<keyof typeof styles, keyof typeof styles>> = {
  secondary: 'tertiary',
  'secondary-destructive': 'tertiary-destructive',
};

/**
 * Common props shared between button and anchor variants
 */
export interface CommonProps extends Pick<AriaButtonProps, 'onPress'> {
  /** Disables the button and shows a disabled state */
  isDisabled?: boolean;
  /** The size variant of the button */
  size?: keyof typeof sizes;
  /** The color variant of the button */
  color?: keyof typeof styles;
  /** The icon to display in the button */
  icon?: FC<{ className?: string }> | ReactNode;
  /** The tooltip to display when hovering over the button */
  tooltip?: string;
  /** The placement of the tooltip */
  tooltipPlacement?: Placement;
  /**
   * Makes the button a toggle and shows whether it is on, e.g. while the
   * panel it opens is showing. Sets `aria-pressed`; leave it unset for a
   * plain action.
   */
  isSelected?: boolean;
}

/**
 * Props for the button variant (non-link)
 */
export interface ButtonProps
  extends CommonProps,
    DetailedHTMLProps<
      Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'slot'>,
      HTMLButtonElement
    > {
  /** Slot name for react-aria component */
  slot?: AriaButtonProps['slot'];
}

/**
 * Props for the link variant (anchor tag)
 */
interface LinkProps
  extends CommonProps,
    DetailedHTMLProps<
      Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'color'>,
      HTMLAnchorElement
    > {
  /** Options for the configured client side router. */
  routerOptions?: AriaLinkProps['routerOptions'];
}

/** Union type of button and link props */
export type Props = ButtonProps | LinkProps;

export const ButtonUtility = ({
  tooltip,
  className,
  isDisabled,
  icon: Icon,
  size = 'sm',
  color = 'secondary',
  tooltipPlacement = 'top',
  isSelected,
  ...otherProps
}: Props) => {
  const href = 'href' in otherProps ? otherProps.href : undefined;
  const Component = href ? AriaLink : AriaButton;

  let props = {};

  if (href) {
    props = {
      ...otherProps,

      href: isDisabled ? undefined : href,

      // Since anchor elements do not support the `disabled` attribute and state,
      // we need to specify `data-rac` and `data-disabled` in order to be able
      // to use the `disabled:` selector in classes.
      ...(isDisabled ? { 'data-rac': true, 'data-disabled': true } : {}),
    };
  } else {
    props = {
      ...otherProps,

      type: otherProps.type || 'button',
      isDisabled,
      ...(isSelected === undefined ? {} : { 'aria-pressed': isSelected }),
    };
  }

  const content = (
    <Component
      aria-label={tooltip}
      {...props}
      className={cx(
        'tw:group tw:relative tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center tw:justify-center tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:disabled:cursor-not-allowed tw:disabled:text-fg-disabled_subtle tw:disabled:*:data-icon:text-fg-disabled_subtle',
        sizes[size],
        styles[(size === 'xs' && borderless[color]) || color],
        isSelected && selectedStyles,

        // Icon styles
        'tw:*:data-icon:pointer-events-none tw:*:data-icon:shrink-0 tw:*:data-icon:transition-inherit-all',

        className
      )}>
      {isReactComponent(Icon) && <Icon data-icon />}
      {isValidElement(Icon) && Icon}
    </Component>
  );

  if (tooltip) {
    return (
      <Tooltip
        isDisabled={isDisabled}
        offset={size === 'xs' || size === 'sm' ? 4 : 6}
        placement={tooltipPlacement}
        title={tooltip}>
        {content}
      </Tooltip>
    );
  }

  return content;
};
