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
  Card,
  Divider,
  Dot,
  FeaturedIcon,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowUpRight } from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { Link, To } from 'react-router-dom';
import { suffixedTestId } from './UserAssets.utils';

export interface StatCardBreakdownItem {
  label: string;
  value: number | string;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtitle?: React.ReactNode;
  breakdown?: StatCardBreakdownItem[];
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
  loading = false,
  testId,
  isSelected = false,
  to,
}) => {
  const hasBreakdown = breakdown && breakdown.length > 0;

  return (
    <Card
      className="tw:h-full"
      data-selected={isSelected}
      data-testid={testId}
      isClickable={Boolean(to)}
      isSelected={isSelected}
      size="sm"
      variant="muted">
      <Card.Content>
        <Box direction="col" gap={2}>
          <Box align="center" gap={2}>
            <FeaturedIcon color="gray" shape="square" size="md" theme="light">
              {icon}
            </FeaturedIcon>
            <Box className="tw:min-w-0 tw:flex-1" direction="col">
              {loading ? (
                <Skeleton height={24} variant="rounded" width={40} />
              ) : (
                <Typography
                  data-testid={suffixedTestId(testId, 'value')}
                  size="text-xl"
                  weight="semibold">
                  {value}
                </Typography>
              )}
              <Typography color="secondary" size="text-sm" weight="medium">
                {label}
              </Typography>
            </Box>
            {to && (
              // The arrow's ::after covers the tile, so the whole tile is one link.
              <Link
                aria-label={label}
                className="tw:self-start tw:text-fg-quaternary tw:after:absolute tw:after:inset-0"
                data-testid={suffixedTestId(testId, 'link')}
                to={to}>
                <ArrowUpRight className="tw:size-4" />
              </Link>
            )}
          </Box>

          <Divider dashed />

          {loading ? (
            <Skeleton height={14} width="70%" />
          ) : (
            <>
              {subtitle && (
                <Typography
                  className="tw:relative tw:z-10 tw:block tw:max-w-full tw:truncate"
                  color="secondary"
                  data-testid={suffixedTestId(testId, 'subtitle')}
                  size="text-xs">
                  {subtitle}
                </Typography>
              )}

              {hasBreakdown && (
                <Box
                  align="center"
                  data-testid={suffixedTestId(testId, 'breakdown')}
                  gap={1}
                  wrap="wrap">
                  {breakdown.map((item, idx) => (
                    <Box align="center" gap={1} key={item.label}>
                      {idx > 0 && (
                        <Dot
                          aria-hidden
                          className="tw:mx-1 tw:shrink-0 tw:text-fg-quaternary"
                          size="tiny"
                        />
                      )}
                      <Typography size="text-xs" weight="semibold">
                        {item.value}
                      </Typography>
                      <Typography color="secondary" size="text-xs">
                        {item.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
};

export default StatCard;
