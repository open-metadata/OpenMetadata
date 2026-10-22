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

import {
  Box,
  Divider,
  FeaturedIcon,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowUpRight } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React from 'react';
import { Link, To } from 'react-router-dom';
import { suffixedTestId } from './UserAssets.utils';

export interface StatCardBreakdownItem {
  label: string;
  value: number | string;
  color?: string;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtitle?: React.ReactNode;
  breakdown?: StatCardBreakdownItem[];
  valueClassName?: string;
  loading?: boolean;
  testId?: string;
  isSelected?: boolean;
  // Destination of the whole tile; shown as an arrow in its top-right corner.
  to?: To;
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  subtitle,
  breakdown,
  valueClassName = 'tw:text-primary-900',
  loading = false,
  testId,
  isSelected = false,
  to,
}) => {
  const hasBreakdown = breakdown && breakdown.length > 0;

  return (
    <Box
      className={classNames(
        'tw:relative tw:min-w-0 tw:flex-1 tw:rounded-lg tw:border tw:p-3.5 tw:shadow-xs',
        isSelected
          ? 'tw:border-utility-brand-300 tw:bg-utility-brand-50'
          : 'tw:border-secondary tw:bg-surface',
        to && 'tw:hover:border-utility-brand-200'
      )}
      data-selected={isSelected}
      data-testid={testId}
      direction="col"
      gap={2}>
      <Box align="center" gap={2}>
        <FeaturedIcon
          // Gray-blue tint instead of the gray theme's; the dark: pair outranks the
          // theme's own dark: classes. The utility scale flips per theme.
          className="tw:bg-utility-gray-blue-50 tw:text-utility-gray-blue-600 tw:dark:bg-utility-gray-blue-50 tw:dark:text-utility-gray-blue-600 tw:[&_svg]:stroke-[2px]"
          color="gray"
          shape="square"
          size="md"
          theme="light">
          {icon}
        </FeaturedIcon>
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          {loading ? (
            <Skeleton height={24} variant="rounded" width={40} />
          ) : (
            <Typography
              className={valueClassName}
              data-testid={suffixedTestId(testId, 'value')}
              size="text-xl"
              weight="semibold">
              {value}
            </Typography>
          )}
          <Typography
            className="tw:text-utility-gray-700"
            size="text-sm"
            weight="medium">
            {label}
          </Typography>
        </Box>
        {to && (
          // The arrow's ::after covers the tile, so the whole tile is one link.
          <Link
            aria-label={label}
            className="tw:self-start tw:text-fg-quaternary tw:after:absolute tw:after:inset-0 tw:after:rounded-lg"
            data-testid={suffixedTestId(testId, 'link')}
            to={to}>
            <ArrowUpRight className="tw:size-4" />
          </Link>
        )}
      </Box>

      <Divider className="tw:h-0 tw:bg-transparent tw:border-t tw:border-dashed tw:border-border-secondary tw:-mx-1" />

      {loading ? (
        <Skeleton height={14} width="70%" />
      ) : (
        <>
          {subtitle && (
            <Typography
              className="tw:relative tw:z-10 tw:block tw:max-w-full tw:truncate tw:text-utility-gray-700"
              data-testid={suffixedTestId(testId, 'subtitle')}
              size="text-xs">
              {subtitle}
            </Typography>
          )}

          {hasBreakdown && (
            <Box
              align="center"
              className="tw:flex-wrap"
              data-testid={suffixedTestId(testId, 'breakdown')}
              gap={1}>
              {breakdown.map((item, idx) => (
                <Box align="center" gap={1} key={item.label}>
                  {idx > 0 && (
                    <span className="tw:inline-block tw:h-1 tw:w-1 tw:rounded-full tw:bg-fg-quaternary tw:mx-1" />
                  )}
                  <Typography
                    className="tw:text-primary-900"
                    size="text-xs"
                    weight="semibold">
                    {item.value}
                  </Typography>
                  <Typography
                    className="tw:text-utility-gray-700"
                    size="text-xs">
                    {item.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default StatCard;
