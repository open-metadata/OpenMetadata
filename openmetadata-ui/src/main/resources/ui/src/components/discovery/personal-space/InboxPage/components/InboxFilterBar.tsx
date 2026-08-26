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

import { Box } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { DateRangeObject } from 'Models';
import React, { ReactNode } from 'react';
import InboxDateFilter from './InboxDateFilter';
import { InboxDateRange } from '../inbox.utils';

export interface InboxFilterBarProps {
  // Tab-specific control rendered on the left (e.g. the Tasks status segmented
  // control). Activity has none for now.
  left?: ReactNode;
  // Adds the bottom divider (Tasks only — Activity keeps a borderless row).
  bordered?: boolean;
  dateRange?: InboxDateRange;
  defaultDateRange: DateRangeObject;
  onDateRangeChange: (value: DateRangeObject) => void;
}

/**
 * Filter row shared by the Inbox Activity / Tasks tabs: an optional left control
 * and the date range text + picker on the right, matching the figma.
 */
const InboxFilterBar: React.FC<InboxFilterBarProps> = ({
  left,
  bordered = false,
  dateRange,
  defaultDateRange,
  onDateRangeChange,
}) => {
  return (
    <Box
      align="center"
      className={classNames(
        'tw:shrink-0 tw:justify-between tw:gap-3 tw:px-3 tw:py-4',
        bordered && 'tw:border-b tw:border-utility-gray-blue-100'
      )}
      data-testid="inbox-filter-bar"
      direction="row">
      <Box align="center" className="tw:shrink-0">
        {left}
      </Box>
      <InboxDateFilter
        dateRange={dateRange}
        defaultDateRange={defaultDateRange}
        onDateRangeChange={onDateRangeChange}
      />
    </Box>
  );
};

export default InboxFilterBar;
