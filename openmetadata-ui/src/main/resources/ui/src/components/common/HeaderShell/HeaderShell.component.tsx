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

import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isValidElement } from 'react';
import { HeaderShellPadding, HeaderShellProps } from './HeaderShell.interface';

const PADDING_CLASS: Record<HeaderShellPadding, string> = {
  default: 'tw:py-3',
  comfortable: 'tw:py-4',
};

const renderTitle = (title: HeaderShellProps['title']) =>
  isValidElement(title) ? (
    title
  ) : (
    <Typography as="h3" size="text-xl" weight="semibold">
      {title}
    </Typography>
  );

const renderSubtitle = (subtitle: HeaderShellProps['subtitle']) =>
  isValidElement(subtitle) ? (
    subtitle
  ) : (
    <Typography className="tw:text-secondary" size="text-sm">
      {subtitle}
    </Typography>
  );

const HeaderShell = ({
  leading,
  breadcrumb,
  title,
  subtitle,
  badge,
  meta,
  hasStats = false,
  actions,
  actionsClassName,
  footer,
  variant = 'flat',
  padding = 'default',
  className,
  'data-testid': dataTestId = 'header-shell',
}: HeaderShellProps) => {
  // When the header renders a footer (the tab strip), the tabs sit flush at the
  // bottom edge of the card — drop the card's bottom padding but keep the top.
  const paddingClass = footer
    ? padding === 'comfortable'
      ? 'tw:pt-4 tw:pb-0'
      : 'tw:pt-3 tw:pb-0'
    : PADDING_CLASS[padding];

  return (
    <Card
      className={classNames(
        'tw:px-5',
        paddingClass,
        // Fixed light-blue header treatment per Figma — intentionally NOT the
        // dynamic brand-* tokens (those follow the deployment's primary color and
        // would tint this header pink on Collate). The gradient stops and the
        // #EFF8FF border are hardcoded because Tailwind arbitrary values can't
        // take semantic tokens. The border is marked important so it wins over
        // the Card `default` variant's border-secondary (cx/tailwind-merge isn't
        // configured for our tw: prefix, so it won't reliably dedupe the two).
        // Dark mode drops the gradient and restores the neutral border on the
        // semantic bg-primary surface.
        variant === 'gradient' &&
          'tw:border-[#EFF8FF]! tw:bg-[linear-gradient(89deg,rgba(239,246,255,0.32)_-2.31%,rgba(239,248,255,0.80)_102.64%)] tw:dark:border-secondary! tw:dark:bg-none tw:dark:bg-primary',
        className
      )}
      data-testid={dataTestId}
      variant="default">
      <Box direction="col" gap={2}>
        {breadcrumb}
        <Box align="center" direction="row" gap={4}>
          {leading}
          <Box
            className={classNames(
              'tw:min-w-0',
              hasStats ? 'tw:gap-2' : 'tw:gap-0.5'
            )}
            direction="col">
            <Box align="center" direction="row" gap={2}>
              {renderTitle(title)}
              {badge}
            </Box>
            {subtitle && renderSubtitle(subtitle)}
            {meta}
          </Box>
          {actions && (
            <Box
              align="center"
              className={classNames('tw:ml-auto tw:shrink-0', actionsClassName)}
              direction="row"
              gap={4}>
              {actions}
            </Box>
          )}
        </Box>
        {footer}
      </Box>
    </Card>
  );
};

export default HeaderShell;
