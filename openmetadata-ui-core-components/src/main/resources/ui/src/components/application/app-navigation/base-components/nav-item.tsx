import type { FC, HTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { ChevronDown, Share04 } from '../../../../icons';
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

export type NavItemVariant = 'default' | 'solid';

// `solid` fills the current item with the brand colour and opens a collapsible
// group under a filled header; hover tints rest items brand instead of gray.
const solidStyles = sortCx({
  // Rest items sit on the sidebar surface instead of painting white boxes.
  root: 'tw:bg-transparent tw:hover:bg-brand-primary_alt tw:dark:hover:bg-brand-primary_alt',
  rootSelected:
    'tw:bg-brand-solid tw:hover:bg-brand-solid tw:dark:bg-brand-solid tw:dark:hover:bg-brand-solid',
  groupSelected:
    'tw:bg-brand-solid_hover tw:hover:bg-brand-solid_hover tw:dark:bg-brand-solid_hover tw:dark:hover:bg-brand-solid_hover',
  groupOpen:
    'tw:in-open:rounded-b-none tw:in-open:bg-brand-solid_hover tw:in-open:hover:bg-brand-solid_hover tw:dark:in-open:bg-brand-solid_hover',
  // Rest label and icon share one mid-gray, as in the pre-migration classic sidebar.
  label: 'tw:text-tertiary tw:group-hover:text-brand-secondary',
  labelSelected:
    'tw:text-primary_on-brand tw:group-hover:text-primary_on-brand',
  labelOpen:
    'tw:in-open:text-primary_on-brand tw:in-open:group-hover:text-primary_on-brand',
  icon: 'tw:text-fg-tertiary tw:group-hover:text-fg-brand-secondary_alt',
  iconSelected: 'tw:text-fg-white tw:group-hover:text-fg-white',
  iconOpen: 'tw:in-open:text-fg-white tw:in-open:group-hover:text-fg-white',
});

export type NavItemSize = 'sm' | 'md' | 'lg';

const sizeStyles = sortCx({
  sm: {
    root: 'tw:px-3 tw:py-1',
    // Lines child labels up with the parent label: px-3 + icon + mr-2.
    child: 'tw:py-1 tw:pr-3 tw:pl-9',
    icon: 'tw:mr-2 tw:size-4',
    label: 'tw:text-sm tw:font-normal',
    labelCurrent: 'tw:font-semibold',
    chevron: 'tw:size-4 tw:stroke-[2.5px] tw:text-fg-quaternary',
  },
  md: {
    root: 'tw:px-3 tw:py-2',
    child: 'tw:py-2 tw:pr-3 tw:pl-10',
    icon: 'tw:mr-2 tw:size-5',
    label: 'tw:text-md tw:font-semibold',
    labelCurrent: '',
    chevron: 'tw:size-4 tw:stroke-[2.5px] tw:text-fg-quaternary',
  },
  // Roomy primary navigation: 56px rows with 28px icons. Children keep their
  // icon and sit flush inside the open group.
  lg: {
    root: 'tw:rounded-xl tw:p-3.5',
    child: 'tw:rounded-none tw:px-4 tw:py-2.5',
    icon: 'tw:mr-2.5 tw:size-7',
    label: 'tw:text-sm tw:font-medium',
    labelCurrent: 'tw:font-semibold',
    // A small dark caret, as on the release 2.0 primary navigation.
    chevron: 'tw:size-2.5 tw:stroke-[3.5px] tw:text-fg-primary',
  },
});

interface NavItemBaseProps {
  /** Text and icon size. `sm` is for dense secondary lists, `lg` for roomy primary navigation. Defaults to `md`. */
  size?: NavItemSize;
  /** `solid` fills the current item and an open group's header with the brand colour. Defaults to `default`. */
  variant?: NavItemVariant;
  /** Whether the nav item shows only an icon. */
  iconOnly?: boolean;
  /** Whether the collapsible nav item is open. */
  open?: boolean;
  /** URL to navigate to when the nav item is clicked. */
  href?: string;
  /** Type of the nav item. */
  type: 'link' | 'collapsible' | 'collapsible-child';
  /** Icon component to display. */
  icon?: FC<
    Pick<HTMLAttributes<HTMLOrSVGElement>, 'className' | 'aria-hidden'>
  >;
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
  /** `data-testid` forwarded to the rendered link. */
  dataTestId?: string;
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
  variant = 'default',
  dataTestId,
  onClick,
}: NavItemBaseProps) => {
  const isSolid = variant === 'solid';
  const isGroup = type === 'collapsible';
  // Children only show their icon at `lg`; smaller sizes indent instead.
  const showIcon = type !== 'collapsible-child' || size === 'lg';

  const iconElement = Icon && showIcon && (
    <Icon
      aria-hidden="true"
      className={cx(
        'tw:shrink-0 tw:text-fg-quaternary tw:transition-inherit-all',
        sizeStyles[size].icon,
        current && 'tw:text-fg-brand-secondary_alt',
        isSolid && solidStyles.icon,
        isSolid && current && solidStyles.iconSelected,
        isSolid && isGroup && solidStyles.iconOpen
      )}
    />
  );

  const rootClassName = cx(
    styles.root,
    type === 'collapsible-child'
      ? sizeStyles[size].child
      : sizeStyles[size].root,
    current && styles.rootSelected,
    isSolid && solidStyles.root,
    isSolid &&
      current &&
      (isGroup ? solidStyles.groupSelected : solidStyles.rootSelected),
    isSolid && isGroup && solidStyles.groupOpen
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
        current &&
          'tw:text-brand-secondary tw:group-hover:text-brand-secondary',
        isSolid && solidStyles.label,
        isSolid && current && solidStyles.labelSelected,
        isSolid && isGroup && solidStyles.labelOpen
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
      <summary className={rootClassName} onClick={onClick}>
        {iconElement}

        {labelElement}

        {badgeElement}

        <ChevronDown
          aria-hidden="true"
          className={cx(
            'tw:ml-3 tw:shrink-0 tw:in-open:-scale-y-100',
            sizeStyles[size].chevron,
            isSolid && current && solidStyles.iconSelected,
            isSolid && solidStyles.iconOpen
          )}
        />
      </summary>
    );
  }

  if (type === 'collapsible-child') {
    return (
      <AriaLink
        aria-current={current ? 'page' : undefined}
        className={rootClassName}
        data-testid={dataTestId}
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
  }

  // An item with nowhere to go (e.g. Logout) is an action, so it is a button.
  if (!href) {
    return (
      <button
        className={cx(rootClassName, 'tw:text-left')}
        data-testid={dataTestId}
        type="button"
        onClick={onClick}>
        {iconElement}
        {labelElement}
        {badgeElement}
      </button>
    );
  }

  return (
    <AriaLink
      aria-current={current ? 'page' : undefined}
      className={rootClassName}
      data-testid={dataTestId}
      href={href}
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
