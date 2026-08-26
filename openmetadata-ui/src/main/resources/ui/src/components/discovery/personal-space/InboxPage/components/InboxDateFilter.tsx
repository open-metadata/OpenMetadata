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
import { DateRangeObject } from 'Models';
import DatePickerMenu from '../../../../../components/common/DatePickerMenu/DatePickerMenu.component';
import { formatDate } from '../../../../../utils/date-time/DateTimeUtils';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { INBOX_DATE_RANGE_OPTIONS, InboxDateRange } from '../inbox.utils';

export interface InboxDateFilterProps {
  dateRange?: InboxDateRange;
  defaultDateRange: DateRangeObject;
  onDateRangeChange: (value: DateRangeObject) => void;
}

/**
 * The date-range label + picker, shared by the Activity header and Tasks bar.
 * Presets are capped to the activity API's 30-day window (custom range disabled).
 */
const InboxDateFilter: React.FC<InboxDateFilterProps> = ({
  dateRange,
  defaultDateRange,
  onDateRangeChange,
}) => {
  const { t } = useTranslation();

  const dateOptions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(INBOX_DATE_RANGE_OPTIONS).map(([key, value]) => [
          key,
          { ...value, title: t(value.title, value.titleData) },
        ])
      ),
    [t]
  );

  return (
    <Box align="center" className="tw:shrink-0" gap={3}>
      {dateRange?.startTs && dateRange?.endTs && (
        <Typography
          className="tw:whitespace-nowrap tw:text-secondary"
          size="text-xs">
          {`${formatDate(dateRange.startTs, true)} - ${formatDate(
            dateRange.endTs,
            true
          )}`}
        </Typography>
      )}
      <DatePickerMenu
        allowCustomRange={false}
        defaultDateRange={dateRange ?? defaultDateRange}
        handleDateRangeChange={onDateRangeChange}
        options={dateOptions}
        showSelectedCustomRange={false}
      />
    </Box>
  );
};

export default InboxDateFilter;
