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
import { HeaderShellProps } from './HeaderShell.interface';

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
  actions,
  footer,
  variant = 'flat',
  className,
  'data-testid': dataTestId = 'header-shell',
}: HeaderShellProps) => {
  return (
    <Card
      className={classNames(
        'tw:mb-5 tw:p-4',
        // Fixed light-blue gradient by design — intentionally NOT the dynamic
        // brand-* tokens (those follow the deployment's primary color, which
        // would tint this header pink on Collate). Tailwind gradient stops also
        // can't take semantic tokens, so the stops are hardcoded; dark mode
        // drops the gradient for the semantic bg-primary surface.
        variant === 'gradient' &&
          'tw:bg-gradient-to-r tw:from-[#EFF6FF] tw:to-[#D3EFFF] tw:dark:bg-primary tw:dark:bg-none',
        className
      )}
      data-testid={dataTestId}
      variant="elevated">
      <Box direction="col" gap={2}>
        {breadcrumb}
        <Box align="center" direction="row" gap={4}>
          {leading}
          <Box className="tw:min-w-0" direction="col" gap={1}>
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
              className="tw:ml-auto tw:shrink-0"
              direction="row"
              gap={3}>
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
