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
import type { ReactNode } from 'react';
import { Box } from '@/components/base/box/box';
import { Typography } from '@/components/foundations/typography';
import { cx } from '@/utils/cx';
import type {
  EmptyPlaceholderIcon,
  EmptyPlaceholderShellProps,
} from './empty-placeholder-shell';
import {
  EMPTY_PLACEHOLDER_ICON_BOX,
  EmptyPlaceholderShell,
  renderEmptyPlaceholderIcon,
} from './empty-placeholder-shell';

const DEFAULT_BLANK_WIDTH = 300;

export interface BlankEmptyPlaceholderProps
  extends Omit<EmptyPlaceholderShellProps, 'children'> {
  icon?: EmptyPlaceholderIcon;
  /** Extra classes for the icon container (e.g. to override its size) */
  iconClassName?: string;
  title?: ReactNode;
  description?: ReactNode;
  /** Extra classes for the title/description column (e.g. to override its max-width) */
  contentClassName?: string;
}

export const BlankEmptyPlaceholder = ({
  icon,
  iconClassName,
  title,
  description,
  contentClassName,
  width,
  ...rest
}: BlankEmptyPlaceholderProps) => (
  <EmptyPlaceholderShell width={width ?? DEFAULT_BLANK_WIDTH} {...rest}>
    {icon && (
      <div className={cx(EMPTY_PLACEHOLDER_ICON_BOX, iconClassName)}>
        {renderEmptyPlaceholderIcon(icon, 'tw:size-7')}
      </div>
    )}
    {(title || description) && (
      <Box
        align="center"
        className={cx(
          'tw:gap-1.5 tw:text-center',
          contentClassName ?? 'tw:max-w-lg'
        )}
        direction="col">
        {title && (
          <Typography size="text-sm" weight="semibold">
            {title}
          </Typography>
        )}
        {description && (
          <Typography
            className="tw:text-secondary"
            size="text-xs"
            weight="regular">
            {description}
          </Typography>
        )}
      </Box>
    )}
  </EmptyPlaceholderShell>
);
