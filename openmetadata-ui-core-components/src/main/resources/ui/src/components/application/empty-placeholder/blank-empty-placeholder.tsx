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
import type {
  EmptyPlaceholderIcon,
  EmptyPlaceholderShellProps,
} from './empty-placeholder-shell';
import {
  EmptyPlaceholderShell,
  renderEmptyPlaceholderIcon,
} from './empty-placeholder-shell';

const DEFAULT_BLANK_WIDTH = 300;

export interface BlankEmptyPlaceholderProps
  extends Omit<EmptyPlaceholderShellProps, 'children'> {
  icon?: EmptyPlaceholderIcon;
  title?: ReactNode;
  description?: ReactNode;
}

export const BlankEmptyPlaceholder = ({
  icon,
  title,
  description,
  width,
  ...rest
}: BlankEmptyPlaceholderProps) => (
  <EmptyPlaceholderShell width={width ?? DEFAULT_BLANK_WIDTH} {...rest}>
    {icon && (
      <div className="tw:flex tw:size-16 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-2xl tw:border tw:border-secondary tw:bg-primary tw:shadow-[0_2px_10px_0_rgba(223,227,245,0.60)] tw:*:data-icon:size-7">
        {renderEmptyPlaceholderIcon(icon, 'tw:size-7')}
      </div>
    )}
    {(title || description) && (
      <Box
        align="center"
        className="tw:max-w-lg tw:gap-1.5 tw:text-center"
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
