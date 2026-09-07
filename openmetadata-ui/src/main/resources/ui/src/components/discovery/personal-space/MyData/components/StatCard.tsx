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
import React from 'react';

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
}) => {
  const hasBreakdown = breakdown && breakdown.length > 0;

  return (
    <Box
      className="tw:min-w-0 tw:flex-1 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-3.5 tw:shadow-xs"
      data-testid={testId}
      direction="col"
      gap={2}>
      <Box align="center" gap={2}>
        <FeaturedIcon
          className="tw:bg-utility-gray-blue-50 tw:text-utility-gray-blue-600 tw:[&_svg]:stroke-[2px]"
          color="gray"
          shape="square"
          size="md"
          theme="light">
          {icon}
        </FeaturedIcon>
        <Box direction="col">
          {loading ? (
            <Skeleton height={24} variant="rounded" width={40} />
          ) : (
            <Typography
              className={valueClassName}
              data-testid={testId ? `${testId}-value` : undefined}
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
      </Box>

      <Divider className="tw:h-0 tw:bg-transparent tw:border-t tw:border-dashed tw:border-border-secondary tw:-mx-1" />

      {loading ? (
        <Skeleton height={14} width="70%" />
      ) : (
        <>
          {subtitle && (
            <Typography
              className="tw:block tw:max-w-full tw:truncate tw:text-utility-gray-700"
              size="text-xs">
              {subtitle}
            </Typography>
          )}

          {hasBreakdown && (
            <Box align="center" className="tw:flex-wrap" gap={1}>
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
