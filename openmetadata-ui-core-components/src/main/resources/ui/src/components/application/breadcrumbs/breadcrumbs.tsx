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
import { ChevronRight, DotsHorizontal } from '@untitledui/icons';
import type { FC, Key, ReactNode } from 'react';
import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
  Button as AriaButton,
  Link as AriaLink,
} from 'react-aria-components';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { cx, sortCx } from '@/utils/cx';

export type BreadcrumbsType = 'text' | 'button-white' | 'button-gray';

export type BreadcrumbsDivider = 'chevron' | 'slash';

export interface BreadcrumbItemType {
  /** Unique identifier for the item. */
  id: Key;
  /** The text shown for the crumb. */
  label: ReactNode;
  /** Navigation target. Omit on the current (last) page. */
  href?: string;
  /** Optional leading icon, e.g. a home icon on the first crumb. */
  icon?: FC<{ className?: string }>;
}

export interface BreadcrumbsProps {
  /** Ordered list of crumbs; the last item is treated as the current page. */
  items: BreadcrumbItemType[];
  /** Visual style of the crumbs. */
  type?: BreadcrumbsType;
  /** Separator rendered between crumbs. */
  divider?: BreadcrumbsDivider;
  /**
   * Maximum number of crumbs to render inline. When the list is longer, the
   * middle crumbs collapse into a `…` menu, keeping the first and last crumbs
   * visible. Omit to always render every crumb.
   */
  maxItems?: number;
  /** Accessible label for the navigation landmark. */
  'aria-label'?: string;
  /** Class name for the root navigation element. */
  className?: string;
  /** Called with the item id when a non-current crumb is activated. */
  onAction?: (id: Key) => void;
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
    link: 'tw:rounded-md tw:px-2 tw:py-1 tw:text-quaternary tw:hover:bg-primary_hover tw:hover:text-secondary',
    current:
      'tw:rounded-md tw:bg-primary tw:px-2 tw:py-1 tw:font-medium tw:text-secondary tw:shadow-xs tw:ring-1 tw:ring-primary tw:ring-inset',
  },
  'button-gray': {
    link: 'tw:rounded-md tw:px-2 tw:py-1 tw:text-quaternary tw:hover:bg-secondary tw:hover:text-secondary',
    current:
      'tw:rounded-md tw:bg-secondary tw:px-2 tw:py-1 tw:font-medium tw:text-secondary',
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

const Divider = ({ divider }: { divider: BreadcrumbsDivider }) =>
  divider === 'slash' ? (
    <span aria-hidden="true" className="tw:px-0.5 tw:text-quaternary">
      /
    </span>
  ) : (
    <ChevronRight
      aria-hidden="true"
      className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
    />
  );

const CrumbLabel = ({ item }: { item: BreadcrumbItemType }) => {
  const Icon = item.icon;

  return (
    <span className="tw:flex tw:items-center tw:gap-1.5">
      {Icon && <Icon className="tw:size-4 tw:shrink-0" />}
      {item.label}
    </span>
  );
};

interface EllipsisMenuProps {
  hidden: BreadcrumbItemType[];
  type: BreadcrumbsType;
  onAction?: (id: Key) => void;
}

const EllipsisMenu = ({ hidden, type, onAction }: EllipsisMenuProps) => (
  <Dropdown.Root>
    <AriaButton
      aria-label="Show hidden breadcrumbs"
      className={cx(linkClassName, styles[type].link)}>
      <DotsHorizontal className="tw:size-5 tw:shrink-0" />
    </AriaButton>
    <Dropdown.Popover>
      <Dropdown.Menu aria-label="Hidden breadcrumbs">
        {hidden.map((item, index) => (
          <Dropdown.Item
            href={item.href}
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
  maxItems,
  className,
  onAction,
  ...props
}: BreadcrumbsProps) => {
  const displayItems = collapseItems(items, maxItems);
  const firstId = displayItems[0]?.id;

  return (
    <AriaBreadcrumbs
      aria-label={props['aria-label'] ?? 'Breadcrumb'}
      className={cx('tw:flex tw:items-center tw:gap-1.5 tw:text-sm', className)}
      items={displayItems}>
      {(item) => (
        <AriaBreadcrumb className="tw:flex tw:items-center tw:gap-1.5">
          {({ isCurrent }) => (
            <>
              {item.id !== firstId && <Divider divider={divider} />}
              {isEllipsis(item) ? (
                <EllipsisMenu
                  hidden={item.hidden}
                  type={type}
                  onAction={onAction}
                />
              ) : !isCurrent && (item.href || onAction) ? (
                <AriaLink
                  className={cx(linkClassName, styles[type].link)}
                  href={item.href}
                  onPress={() => onAction?.(item.id)}>
                  <CrumbLabel item={item} />
                </AriaLink>
              ) : (
                <span
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cx(
                    'tw:flex tw:items-center',
                    isCurrent ? styles[type].current : 'tw:text-quaternary'
                  )}>
                  <CrumbLabel item={item} />
                </span>
              )}
            </>
          )}
        </AriaBreadcrumb>
      )}
    </AriaBreadcrumbs>
  );
};
