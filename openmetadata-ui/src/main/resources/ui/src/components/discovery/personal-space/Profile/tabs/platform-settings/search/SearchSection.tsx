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

import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import type { ReactNode } from 'react';

export const SearchSectionTitle = ({ children }: { children: ReactNode }) => (
  <Typography
    className="tw:px-1 tw:text-primary-900 tw:uppercase"
    size="text-xs"
    weight="medium">
    {children}
  </Typography>
);

interface SearchSectionProps {
  title: string;
  count: number;
  testId: string;
  actions: ReactNode;
  children: ReactNode;
}

/** Caption with a count and actions, above the boost content. */
const SearchSection = ({
  title,
  count,
  testId,
  actions,
  children,
}: SearchSectionProps) => (
  <Box data-testid={testId} direction="col" gap={3}>
    <Box align="center" direction="row" justify="between">
      <Box align="center" direction="row" gap={2}>
        <SearchSectionTitle>{title}</SearchSectionTitle>
        <Badge color="brand" size="sm" type="pill-color">
          {count}
        </Badge>
      </Box>
      <Box direction="row" gap={2}>
        {actions}
      </Box>
    </Box>
    {children}
  </Box>
);

export default SearchSection;
