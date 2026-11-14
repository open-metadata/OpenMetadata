import { shouldClientNavigate, useRouter } from '@react-aria/utils';
import type { FC, MouseEvent } from 'react';
import { Button as AriaButton, Pressable } from 'react-aria-components';
import { Tooltip } from '@/components/base/tooltip/tooltip';
import { cx, sortCx } from '@/utils/cx';

// `solid` mirrors NavItemBase's solid variant so a collapsed rail matches the expanded sidebar:
// rest items sit on the sidebar surface (no white tile) with the same mid-gray icon.
const variants = sortCx({
  default: {
    root: 'tw:bg-primary tw:dark:bg-transparent tw:text-fg-quaternary tw:hover:bg-primary_hover tw:hover:text-fg-quaternary_hover',
    // An open flyout keeps its trigger in the hover state after the pointer moves onto the menu.
    open: 'tw:bg-primary_hover tw:text-fg-quaternary_hover',
    current:
      'tw:bg-brand-primary_alt tw:text-fg-brand-secondary_alt tw:hover:bg-brand-primary_alt tw:hover:text-fg-brand-secondary_alt',
  },
  solid: {
    root: 'tw:bg-transparent tw:text-fg-tertiary tw:hover:bg-brand-primary_alt tw:hover:text-fg-brand-secondary_alt',
    open: 'tw:bg-brand-primary_alt tw:text-fg-brand-secondary_alt',
    current:
      'tw:bg-brand-solid tw:text-fg-white tw:hover:bg-brand-solid tw:hover:text-fg-white',
  },
});

const styles = {
  md: {
    root: 'tw:size-10 tw:rounded-md',
    icon: 'tw:size-5',
  },
  lg: {
    root: 'tw:size-12 tw:rounded-md',
    icon: 'tw:size-6',
  },
  // Same box, icon and radius as NavItemBase `lg`, so a collapsed rail keeps the expanded rows' grid.
  xl: {
    root: 'tw:size-14 tw:rounded-xl',
    icon: 'tw:size-7',
  },
};

interface NavItemButtonProps {
  /** Whether the collapsible nav item is open. */
  open?: boolean;
  /** URL to navigate to when the button is clicked. */
  href?: string;
  /** Label text for the button. */
  label: string;
  /** Icon component to display. */
  icon: FC<{ className?: string }>;
  /** Whether the button is currently active. */
  current?: boolean;
  /** Size of the button. */
  size?: keyof typeof styles;
  /** Visual style; `solid` matches NavItemBase's solid variant. */
  variant?: keyof typeof variants;
  /** Fires when the item is activated, whether it renders as a link (`href` set) or a button. */
  onPress?: () => void;
  /** Additional CSS classes to apply to the button. */
  className?: string;
  /** Placement of the tooltip. */
  tooltipPlacement?: 'top' | 'right' | 'bottom' | 'left';
}

export const NavItemButton = ({
  current: current,
  open,
  label,
  href,
  icon: Icon,
  size = 'md',
  className,
  tooltipPlacement = 'right',
  variant = 'default',
  onPress,
}: NavItemButtonProps) => {
  const router = useRouter();

  // A plain anchor would reload the whole app; under a RouterProvider, hand
  // same-tab clicks to the client router the way react-aria's Link does.
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onPress?.();
    if (
      href &&
      !event.defaultPrevented &&
      !router.isNative &&
      shouldClientNavigate(event.currentTarget, event)
    ) {
      event.preventDefault();
      router.open(event.currentTarget, event, href, undefined);
    }
  };

  const buttonClassName = cx(
    'tw:relative tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:justify-center tw:p-2 tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear tw:select-none tw:focus-visible:z-10 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2',
    variants[variant].root,
    open && variants[variant].open,
    // Same current-page treatment as the expanded NavItemBase, so the
    // collapsed rail still shows where the user is.
    current && variants[variant].current,
    styles[size].root,
    className
  );
  const icon = (
    <Icon
      aria-hidden="true"
      className={cx('tw:shrink-0 tw:transition-inherit-all', styles[size].icon)}
    />
  );

  return (
    <Tooltip placement={tooltipPlacement} title={label}>
      {href ? (
        <Pressable>
          <a
            aria-label={label}
            className={buttonClassName}
            href={href}
            onClick={handleClick}>
            {icon}
          </a>
        </Pressable>
      ) : (
        // Without a destination this is an action or a menu trigger, so it is a real button and
        // stays keyboard reachable (an anchor without href is not focusable).
        <AriaButton
          aria-label={label}
          className={buttonClassName}
          onPress={onPress}>
          {icon}
        </AriaButton>
      )}
    </Tooltip>
  );
};
