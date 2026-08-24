/*
 *  Copyright 2026 Collate.
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
import { SearchLg } from '@untitledui/icons';
import { isValidElement } from 'react';
import { cx } from '@/utils/cx';
import { Box } from '../../base/box/box';
import { Card } from '../../base/card/card';
import { Input } from '../../base/input/input';
import { FeaturedIcon } from '../../foundations/featured-icon/featured-icon';
import { Typography } from '../../foundations/typography';
import { Breadcrumbs } from '../breadcrumbs/breadcrumbs';
import type { BreadcrumbItemType } from '../breadcrumbs/breadcrumbs';
import { Tabs } from '../tabs/tabs';
import type { PageHeaderProps, PageHeaderTab } from './page-header.types';

export type {
  PageHeaderProps,
  PageHeaderTab,
  PageHeaderVariant,
} from './page-header.types';

// Distinguishes a breadcrumb items array from a ReactNode (which can itself be
// an array of elements) by shape — items are plain objects carrying `id`+`label`.
const isBreadcrumbItems = (
  value: PageHeaderProps['breadcrumb']
): value is BreadcrumbItemType[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  typeof value[0] === 'object' &&
  value[0] !== null &&
  !isValidElement(value[0]) &&
  'id' in value[0] &&
  'label' in value[0];

const renderBreadcrumb = (breadcrumb: PageHeaderProps['breadcrumb']) =>
  isBreadcrumbItems(breadcrumb) ? (
    <Breadcrumbs items={breadcrumb} size="sm" />
  ) : (
    breadcrumb
  );

// A footer tabs array carries plain `{ id, label }` objects (unlike a ReactNode,
// which — if an array — holds React elements).
const isTabItems = (
  value: PageHeaderProps['footer']
): value is PageHeaderTab[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  typeof value[0] === 'object' &&
  value[0] !== null &&
  !isValidElement(value[0]) &&
  'id' in value[0] &&
  'label' in value[0];

const renderFooter = (footer: PageHeaderProps['footer']) =>
  isTabItems(footer) ? (
    <Tabs defaultSelectedKey={footer[0].id}>
      <Tabs.List
        items={footer.map(({ id, label, count }) => ({
          id,
          label,
          badge: count,
        }))}
        type="underline"
      />
    </Tabs>
  ) : (
    footer
  );

const renderTitle = (title: PageHeaderProps['title']) =>
  isValidElement(title) ? (
    title
  ) : (
    <Typography
      ellipsis
      as="h3"
      className="tw:min-w-0"
      size="text-xl"
      weight="semibold">
      {title}
    </Typography>
  );

const renderSubtitle = (subtitle: PageHeaderProps['subtitle']) =>
  isValidElement(subtitle) ? (
    subtitle
  ) : (
    <Typography className="tw:text-secondary" size="text-sm">
      {subtitle}
    </Typography>
  );

/**
 * Rich page header: an optional breadcrumb row over a
 * leading / title-block / actions row, with an optional full-width footer
 * (typically a tab strip). Every region is a slot, so the header stays a pure
 * presentational component — bring your own `Breadcrumbs`, search `Input`, and
 * `Button`s from the library.
 *
 * Use it standalone, inside `PageLayout.Header`, or via the `PageLayout.PageHeader`
 * convenience compound.
 */
export const PageHeader = ({
  icon,
  breadcrumb,
  title,
  subtitle,
  badge,
  meta,
  hasStats = false,
  search,
  actions,
  footer,
  variant = 'flat',
  className,
  'data-testid': dataTestId = 'page-header',
  ...rest
}: PageHeaderProps) => {
  // When the header renders a footer (the tab strip), the tabs sit flush at the
  // bottom edge of the card — drop the card's bottom padding but keep the top.
  const paddingClass = footer ? 'tw:pt-4 tw:pb-0' : 'tw:py-4';

  const leadingNode =
    typeof icon === 'function' ? (
      <FeaturedIcon color="brand" icon={icon} size="md" theme="light" />
    ) : (
      icon
    );

  return (
    <Card
      {...rest}
      className={cx(
        'tw:px-5',
        paddingClass,
        // Fixed light-blue header treatment per Figma — intentionally NOT the
        // dynamic brand-* tokens (those follow the deployment's primary color and
        // would tint this header pink on Collate). The gradient stops and the
        // #EFF8FF border are hardcoded because Tailwind arbitrary values can't
        // take semantic tokens. The border is marked important so it wins over
        // the Card `default` variant's border-secondary. Dark mode drops the
        // gradient and restores the neutral border on the bg-primary surface.
        variant === 'gradient' &&
          'tw:border-brand-50! tw:bg-[linear-gradient(89deg,rgba(239,246,255,0.32)_-2.31%,rgba(239,248,255,0.80)_102.64%)] tw:dark:border-secondary! tw:dark:bg-none tw:dark:bg-primary',
        className
      )}
      data-testid={dataTestId}
      variant="default">
      <Box direction="col" gap={2}>
        {renderBreadcrumb(breadcrumb)}
        <Box align="center" direction="row" gap={4}>
          {leadingNode}
          <Box
            className={cx(
              'tw:min-w-0 tw:flex-1',
              hasStats ? 'tw:gap-2' : 'tw:gap-0.5'
            )}
            direction="col">
            <Box align="center" className="tw:min-w-0" direction="row" gap={2}>
              {renderTitle(title)}
              {badge != null && (
                <Box className="tw:shrink-0 tw:empty:hidden">{badge}</Box>
              )}
            </Box>
            {subtitle ? renderSubtitle(subtitle) : null}
            {meta}
          </Box>
          {search || actions ? (
            <Box
              align="center"
              className="tw:ml-auto tw:shrink-0"
              direction="row"
              gap={4}>
              {search ? <Input icon={SearchLg} size="sm" {...search} /> : null}
              {actions}
            </Box>
          ) : null}
        </Box>
        {renderFooter(footer)}
      </Box>
    </Card>
  );
};

PageHeader.displayName = 'PageHeader';
