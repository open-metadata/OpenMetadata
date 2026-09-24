import type { FC, HTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { ChevronDown, Share04 } from '@untitledui/icons';
import { Link as AriaLink } from 'react-aria-components';
import { Badge } from '@/components/base/badges/badges';
import { cx, sortCx } from '@/utils/cx';

const styles = sortCx({
  // Resting items are transparent in dark so they don't paint darker boxes on
  // the raised (bg-secondary) sidebar surface; hover/selected still highlight.
  // `no-underline!`: host apps ship unlayered `a:hover`/`a:focus` underline
  // rules that outrank layered utilities; nav items are never underlined.
  root: 'tw:group tw:relative tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:rounded-md tw:bg-primary tw:dark:bg-transparent tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear tw:select-none tw:hover:bg-primary_hover tw:focus-visible:z-10 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:no-underline!',
  // Same treatment as the selected `button-brand` tab, so it holds up in dark mode.
  rootSelected: 'tw:bg-brand-primary_alt tw:hover:bg-brand-primary_alt',
});

export type NavItemSize = 'sm' | 'md';

const sizeStyles = sortCx({
  sm: {
    icon: 'tw:size-4',
    label: 'tw:text-sm tw:font-normal',
    labelCurrent: 'tw:font-semibold',
  },
  md: {
    icon: 'tw:size-5',
    label: 'tw:text-md tw:font-semibold',
    labelCurrent: '',
  },
});

interface NavItemBaseProps {
  /** Text and icon size. `sm` is for dense secondary lists. Defaults to `md`. */
  size?: NavItemSize;
  /** Whether the nav item shows only an icon. */
  iconOnly?: boolean;
  /** Whether the collapsible nav item is open. */
  open?: boolean;
  /** URL to navigate to when the nav item is clicked. */
  href?: string;
  /** Type of the nav item. */
  type: 'link' | 'collapsible' | 'collapsible-child';
  /** Icon component to display. */
  icon?: FC<HTMLAttributes<HTMLOrSVGElement>>;
  /** Badge to display. */
  badge?: ReactNode;
  /** Whether the nav item is currently active. */
  current?: boolean;
  /** Whether to truncate the label text. */
  truncate?: boolean;
  /** Handler for click events. */
  onClick?: MouseEventHandler;
  /** Content to display. */
  children?: ReactNode;
}

export const NavItemBase = ({
  current,
  type,
  badge,
  href,
  icon: Icon,
  children,
  truncate = true,
  size = 'md',
  onClick,
}: NavItemBaseProps) => {
  const iconElement = Icon && (
    <Icon
      aria-hidden="true"
      className={cx(
        'tw:mr-2 tw:shrink-0 tw:text-fg-quaternary tw:transition-inherit-all',
        sizeStyles[size].icon,
        current && 'tw:text-fg-brand-secondary_alt'
      )}
    />
  );

  const badgeElement =
    badge && (typeof badge === 'string' || typeof badge === 'number') ? (
      <Badge className="tw:ml-3" color="gray" size="sm" type="pill-color">
        {badge}
      </Badge>
    ) : (
      badge
    );

  const labelElement = (
    <span
      className={cx(
        'tw:flex-1 tw:text-secondary tw:transition-inherit-all tw:group-hover:text-secondary_hover',
        sizeStyles[size].label,
        current && sizeStyles[size].labelCurrent,
        truncate && 'tw:truncate',
        current && 'tw:text-brand-secondary tw:group-hover:text-brand-secondary'
      )}>
      {children}
    </span>
  );

  const isExternal = href && href.startsWith('http');
  const externalIcon = isExternal && (
    <Share04 className="tw:size-4 tw:stroke-[2.5px] tw:text-fg-quaternary" />
  );

  if (type === 'collapsible') {
    return (
      <summary
        className={cx(
          'tw:px-3 tw:py-2',
          styles.root,
          current && styles.rootSelected
        )}
        onClick={onClick}>
        {iconElement}

        {labelElement}

        {badgeElement}

        <ChevronDown
          aria-hidden="true"
          className="tw:ml-3 tw:size-4 tw:shrink-0 tw:stroke-[2.5px] tw:text-fg-quaternary tw:in-open:-scale-y-100"
        />
      </summary>
    );
  }

  if (type === 'collapsible-child') {
    return (
      <AriaLink
        aria-current={current ? 'page' : undefined}
        className={cx(
          'tw:py-2 tw:pr-3 tw:pl-10',
          styles.root,
          current && styles.rootSelected
        )}
        href={href!}
        rel="noopener noreferrer"
        target={isExternal ? '_blank' : '_self'}
        onClick={onClick}>
        {labelElement}
        {externalIcon}
        {badgeElement}
      </AriaLink>
    );
  }

  return (
    <AriaLink
      aria-current={current ? 'page' : undefined}
      className={cx(
        'tw:px-3 tw:py-2',
        styles.root,
        current && styles.rootSelected
      )}
      href={href!}
      rel="noopener noreferrer"
      target={isExternal ? '_blank' : '_self'}
      onClick={onClick}>
      {iconElement}
      {labelElement}
      {externalIcon}
      {badgeElement}
    </AriaLink>
  );
};
