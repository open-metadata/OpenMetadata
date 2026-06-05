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
import { ChevronRight } from '@untitledui/icons';
import type { FC, Key, ReactNode } from 'react';
import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
  Link as AriaLink,
} from 'react-aria-components';
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
  /** Accessible label for the navigation landmark. */
  'aria-label'?: string;
  /** Class name for the root navigation element. */
  className?: string;
  /** Called with the item id when a non-current crumb is activated. */
  onAction?: (id: Key) => void;
}

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

export const Breadcrumbs = ({
  items,
  type = 'text',
  divider = 'chevron',
  className,
  onAction,
  ...props
}: BreadcrumbsProps) => {
  const firstId = items[0]?.id;

  return (
    <AriaBreadcrumbs
      aria-label={props['aria-label'] ?? 'Breadcrumb'}
      className={cx('tw:flex tw:items-center tw:gap-1.5 tw:text-sm', className)}
      items={items}>
      {(item) => (
        <AriaBreadcrumb className="tw:flex tw:items-center tw:gap-1.5">
          {({ isCurrent }) => {
            const Icon = item.icon;
            const content = (
              <span className="tw:flex tw:items-center tw:gap-1.5">
                {Icon && <Icon className="tw:size-4 tw:shrink-0" />}
                {item.label}
              </span>
            );

            return (
              <>
                {item.id !== firstId && <Divider divider={divider} />}
                {!isCurrent && (item.href || onAction) ? (
                  <AriaLink
                    className={cx(
                      'tw:flex tw:cursor-pointer tw:items-center tw:rounded-md tw:outline-brand tw:transition tw:duration-100 tw:ease-linear tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2',
                      styles[type].link
                    )}
                    href={item.href}
                    onPress={() => onAction?.(item.id)}>
                    {content}
                  </AriaLink>
                ) : (
                  <span
                    aria-current={isCurrent ? 'page' : undefined}
                    className={cx(
                      'tw:flex tw:items-center',
                      isCurrent ? styles[type].current : 'tw:text-quaternary'
                    )}>
                    {content}
                  </span>
                )}
              </>
            );
          }}
        </AriaBreadcrumb>
      )}
    </AriaBreadcrumbs>
  );
};
