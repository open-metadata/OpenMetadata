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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';

interface SearchHeaderRowProps {
  title: string;
  subtitle?: string;
  search: ReactNode;
  actions?: ReactNode;
  /** Beta badge / learning icon, which `usePageHeader` renders beside the title. */
  badge?: ReactNode;
}

/**
 * Page-header title row with a search between the title and the actions.
 * The search centres in the space the title leaves; 35vw matches Explore.
 */
export const SearchHeaderRow = ({
  title,
  subtitle,
  search,
  actions,
  badge,
}: SearchHeaderRowProps) => (
  <Box
    align="center"
    className="tw:w-full"
    data-testid="search-header-row"
    direction="row"
    gap={4}>
    <div className="tw:shrink-0" data-testid="search-header-title">
      <Box align="center" direction="row" gap={2}>
        <Typography as="h3" size="text-xl" weight="semibold">
          {title}
        </Typography>
        {badge}
      </Box>
      {subtitle && (
        <Typography
          className="tw:whitespace-nowrap"
          color="secondary"
          size="text-sm">
          {subtitle}
        </Typography>
      )}
    </div>
    <div className="tw:min-w-0 tw:flex-1">
      <div
        className="tw:mx-auto tw:w-full tw:max-w-[35vw] tw:min-w-0"
        data-testid="search-header-search">
        {search}
      </div>
    </div>
    <div className="tw:shrink-0" data-testid="search-header-actions">
      {actions}
    </div>
  </Box>
);

export default SearchHeaderRow;
