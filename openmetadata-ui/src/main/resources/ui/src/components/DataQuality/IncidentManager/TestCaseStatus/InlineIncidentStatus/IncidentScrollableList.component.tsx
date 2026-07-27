/*
 *  Copyright 2023 Collate.
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

import { Box } from '@openmetadata/ui-core-components';
import { type ReactNode } from 'react';

type IncidentScrollableListProps = {
  children: ReactNode;
  maxHeight?: number;
};

/**
 * Outer clip + inner vertical scroll; constrains width to the parent column.
 */
export const IncidentScrollableList = ({
  children,
  maxHeight = 300,
}: IncidentScrollableListProps) => (
  <Box
    className="tw:min-w-0 tw:overflow-hidden tw:w-full tw:max-h-[var(--list-max-h)]"
    direction="col"
    style={{ maxHeight }}>
    <Box
      className="tw:min-w-0 tw:overflow-x-hidden tw:overflow-y-auto tw:w-full"
      direction="col"
      style={{ maxHeight }}>
      {children}
    </Box>
  </Box>
);
