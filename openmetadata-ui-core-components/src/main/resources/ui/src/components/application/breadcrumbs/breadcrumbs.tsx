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
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { cx, sortCx } from '@/utils/cx';
import { ChevronRight, DotsHorizontal } from '@untitledui/icons';
import type { FC, HTMLAttributes, Key, ReactNode } from 'react';
import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
  Button as AriaButton,
  Link as AriaLink,
} from 'react-aria-components';

export type BreadcrumbsType = 'text' | 'button-white' | 'button-gray';

export type BreadcrumbsDivider = 'chevron' | 'slash';

export type BreadcrumbsSize = 'xs' | 'sm' | 'md';

export interface BreadcrumbItemType {
  /** Unique identifier for the item. */
  id: Key;
  /** The text shown for the crumb. */
  label: ReactNode;
  /** Accessible label for icon-only crumbs. */
  ariaLabel?: string;
  /** Navigation target. Omit on the current (last) page. */
  href?: string;
  /** Optional leading icon, e.g. a home icon on the first crumb. */
  icon?: FC<{ className?: string }>;
}

export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  /** Ordered list of crumbs; the last item is treated as the current page. */
  items: BreadcrumbItemType[];
  /** Visual style of the crumbs. */
  type?: BreadcrumbsType;
  /** Separator rendered between crumbs. */
  divider?: BreadcrumbsDivider;
  /** Size of the crumbs (text, icons and button padding). */
  size?: BreadcrumbsSize;
  /**
   * Maximum number of crumbs to render inline. When the list is longer, the
   * middle crumbs collapse into a `…` menu, keeping the first and last crumbs
   * visible. Omit to always render every crumb. Ignored when `autoCollapse`
   * is enabled.
   */
  maxItems?: number;
  /**
   * Keep the trail on a single line and automatically collapse the middle
   * crumbs into a `…` menu when the container is too narrow to fit them all.
   * Overrides `maxItems`.
   */
  autoCollapse?: boolean;
  /**
   * Called with the item id when a non-current crumb is activated. When
   * provided, native `href` navigation is suppressed so the callback alone
   * drives navigation (client-side routing) — this avoids a double navigation
   * when an item supplies both `href` and `onAction`. Provide `href` without
   * `onAction` for a plain link.
   */
  onAction?: (id: Key) => void;
  /**
   * Maximum width in pixels for each crumb's label text. Labels longer than
   * this truncate with an ellipsis. Omit to never truncate.
   */
  maxItemWidth?: number;
}

const ELLIPSIS_ID = '__breadcrumbs_ellipsis__';

interface EllipsisItem {
  id: typeof ELLIPSIS_ID;
  hidden: BreadcrumbItemType[];
}

type DisplayItem = BreadcrumbItemType | EllipsisItem;

const isEllipsis = (item: DisplayItem): item is EllipsisItem =>
  item.id === ELLIPSIS_ID;

const styles = sortCx({
  text: {
    link: 'tw:text-quaternary tw:hover:text-secondary',
    current: 'tw:text-secondary tw:font-medium',
  },
  'button-white': {
    link: 'tw:rounded-md tw:text-quaternary tw:hover:bg-primary_hover tw:hover:text-secondary',
    current:
      'tw:rounded-md tw:bg-primary tw:font-medium tw:text-secondary tw:shadow-xs tw:ring-1 tw:ring-primary tw:ring-inset',
  },
  'button-gray': {
    link: 'tw:rounded-md tw:text-quaternary tw:hover:bg-secondary tw:hover:text-secondary',
    current: 'tw:rounded-md tw:bg-secondary tw:font-medium tw:text-secondary',
  },
});

const sizes = sortCx({
  xs: {
    gap: 'tw:gap-1',
    text: 'tw:text-xs',
    icon: 'tw:size-3.5',
    dots: 'tw:size-4',
    padding: 'tw:px-1.5 tw:py-0.5',
  },
  sm: {
    gap: 'tw:gap-1.5',
    text: 'tw:text-sm',
    icon: 'tw:size-4',
    dots: 'tw:size-5',
    padding: 'tw:px-2 tw:py-1',
  },
  md: {
    gap: 'tw:gap-2',
    text: 'tw:text-sm',
    icon: 'tw:size-5',
    dots: 'tw:size-5',
    padding: 'tw:px-2.5 tw:py-1.5',
  },
});

const linkClassName =
  'tw:flex tw:cursor-pointer tw:items-center tw:rounded-md tw:outline-brand tw:transition tw:duration-100 tw:ease-linear tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2';

const toText = (label: ReactNode, fallback: string): string =>
  typeof label === 'string' || typeof label === 'number'
    ? String(label)
    : fallback;

const collapseItems = (
  items: BreadcrumbItemType[],
  maxItems?: number
): DisplayItem[] => {
  let result: DisplayItem[] = items;
  if (maxItems && maxItems >= 2 && items.length > maxItems) {
    const trailingCount = maxItems - 1;
    result = [
      items[0],
      { id: ELLIPSIS_ID, hidden: items.slice(1, items.length - trailingCount) },
      ...items.slice(items.length - trailingCount),
    ];
  }

  return result;
};

const Divider = ({
  divider,
  size,
}: {
  divider: BreadcrumbsDivider;
  size: BreadcrumbsSize;
}) =>
  divider === 'slash' ? (
    <span aria-hidden="true" className="tw:px-0.5 tw:text-quaternary">
      /
    </span>
  ) : (
    <ChevronRight
      aria-hidden="true"
      className={cx('tw:shrink-0 tw:text-fg-quaternary', sizes[size].icon)}
    />
  );

const CrumbLabel = ({
  item,
  size,
  maxItemWidth,
}: {
  item: BreadcrumbItemType;
  size: BreadcrumbsSize;
  maxItemWidth?: number;
}) => {
  const Icon = item.icon;

  return (
    <span className={cx('tw:flex tw:min-w-0 tw:items-center', sizes[size].gap)}>
      {Icon && <Icon className={cx('tw:shrink-0', sizes[size].icon)} />}
      <span
        className="tw:truncate"
        style={maxItemWidth ? { maxWidth: maxItemWidth } : undefined}>
        {item.label}
      </span>
    </span>
  );
};

interface EllipsisMenuProps {
  hidden: BreadcrumbItemType[];
  type: BreadcrumbsType;
  size: BreadcrumbsSize;
  padding: string;
  onAction?: (id: Key) => void;
}

const EllipsisMenu = ({
  hidden,
  type,
  size,
  padding,
  onAction,
}: EllipsisMenuProps) => (
  <Dropdown.Root>
    <AriaButton
      aria-label="Show hidden breadcrumbs"
      className={cx(linkClassName, styles[type].link, padding)}>
      <DotsHorizontal className={cx('tw:shrink-0', sizes[size].dots)} />
    </AriaButton>
    <Dropdown.Popover>
      <Dropdown.Menu aria-label="Hidden breadcrumbs">
        {hidden.map((item, index) => (
          <Dropdown.Item
            href={onAction ? undefined : item.href}
            icon={item.icon}
            key={item.id}
            label={toText(item.label, `Item ${index + 1}`)}
            onAction={() => onAction?.(item.id)}
          />
        ))}
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown.Root>
);

export const Breadcrumbs = ({
  items,
  type = 'text',
  divider = 'chevron',
  size = 'sm',
  maxItems,
  autoCollapse = false,
  className,
  onAction,
  maxItemWidth,
  'aria-label': ariaLabel = 'Breadcrumb',
  ...props
}: BreadcrumbsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fittedCount, setFittedCount] = useState(items.length);
  const [measureKey, requestMeasure] = useReducer((key: number) => key + 1, 0);

  const padding = type === 'text' ? '' : sizes[size].padding;
  const displayItems = collapseItems(
    items,
    autoCollapse ? fittedCount : maxItems
  );

  // While the trail overflows its container, drop one more crumb into the `…`
  // menu. Re-runs as `fittedCount` decreases (the convergence loop) and whenever
  // a re-measure is requested, so it settles once the trail fits (or only the
  // first + last remain). The `ol` is the measured element — react-aria renders
  // a 0-width <template> as the wrapper's first child, so the list must be
  // queried, not read positionally.
  useLayoutEffect(() => {
    const list = containerRef.current?.querySelector('ol');
    if (
      autoCollapse &&
      list &&
      list.scrollWidth > list.clientWidth + 1 &&
      fittedCount > 2
    ) {
      setFittedCount(fittedCount - 1);
    }
  }, [autoCollapse, fittedCount, items, measureKey]);

  // Reset to the full trail and re-measure on mount, on a container resize, and
  // once web fonts load (label widths can change after the first layout, which
  // would otherwise leave a stale measurement). The reset lets the trail
  // re-expand when there is more room.
  useEffect(() => {
    const el = containerRef.current;
    if (!autoCollapse || !el) {
      return undefined;
    }

    const remeasure = () => {
      setFittedCount(items.length);
      requestMeasure();
    };
    const observer = new ResizeObserver(remeasure);
    observer.observe(el);
    document.fonts?.ready.then(remeasure).catch(() => undefined);

    return () => observer.disconnect();
  }, [autoCollapse, items.length]);

  const list = (
    <AriaBreadcrumbs
      aria-label={ariaLabel}
      className={cx(
        'tw:flex tw:flex-nowrap tw:items-center',
        autoCollapse && 'tw:w-full tw:min-w-0 tw:overflow-hidden',
        sizes[size].gap,
        sizes[size].text,
        className
      )}
      items={displayItems}
      {...props}>
      {(item) => (
        <AriaBreadcrumb
          className={cx(
            'tw:flex tw:shrink-0 tw:items-center',
            sizes[size].gap
          )}>
          {({ isCurrent }) => (
            <>
              {isEllipsis(item) ? (
                <EllipsisMenu
                  hidden={item.hidden}
                  padding={padding}
                  size={size}
                  type={type}
                  onAction={onAction}
                />
              ) : !isCurrent && (item.href || onAction) ? (
                <AriaLink
                  aria-label={item.ariaLabel}
                  className={cx(linkClassName, styles[type].link, padding)}
                  href={onAction ? undefined : item.href}
                  onPress={() => onAction?.(item.id)}>
                  <CrumbLabel
                    item={item}
                    maxItemWidth={maxItemWidth}
                    size={size}
                  />
                </AriaLink>
              ) : (
                <span
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cx(
                    'tw:flex tw:min-w-0 tw:items-center',
                    padding,
                    isCurrent ? styles[type].current : 'tw:text-quaternary'
                  )}>
                  <CrumbLabel
                    item={item}
                    maxItemWidth={maxItemWidth}
                    size={size}
                  />
                </span>
              )}
              {!isCurrent && <Divider divider={divider} size={size} />}
            </>
          )}
        </AriaBreadcrumb>
      )}
    </AriaBreadcrumbs>
  );

  return autoCollapse ? (
    <div className="tw:w-full tw:min-w-0 tw:overflow-hidden" ref={containerRef}>
      {list}
    </div>
  ) : (
    list
  );
};
