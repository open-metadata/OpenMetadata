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

import { render } from '@testing-library/react';
import { DateRangeObject } from 'Models';
import React, { ReactNode } from 'react';

interface CapturedDatePickerProps {
  defaultDateRange?: unknown;
  allowCustomRange?: boolean;
  options?: unknown;
}

let datePickerProps: CapturedDatePickerProps;

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('components/common/DatePickerMenu/DatePickerMenu.component', () => ({
  __esModule: true,
  default: (props: CapturedDatePickerProps) => {
    datePickerProps = props;

    return <div data-testid="date-picker-menu" />;
  },
}));

jest.mock('utils/date-time/DateTimeUtils', () => ({
  formatDate: (ts: number) => `d${ts}`,
  getEpochMillisForPastDays: (days: number) => days,
  getStartOfDayInMillis: (ts: number) => ts,
  getEndOfDayInMillis: (ts: number) => ts,
  getCurrentMillis: () => 0,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import InboxDateFilter from './InboxDateFilter';

const defaultRange = {
  startTs: 0,
  endTs: 30,
  key: 'last30days',
} as unknown as DateRangeObject;

describe('InboxDateFilter', () => {
  it('seeds the picker with the live custom range so its label survives remounts', () => {
    render(
      <InboxDateFilter
        dateRange={{
          startTs: 1,
          endTs: 2,
          key: 'customRange',
          title: 'Custom Range',
        }}
        defaultDateRange={defaultRange}
        onDateRangeChange={jest.fn()}
      />
    );

    expect(datePickerProps.defaultDateRange).toEqual(
      expect.objectContaining({ key: 'customRange', title: 'Custom Range' })
    );
  });

  it('falls back to the default range when none is selected', () => {
    render(
      <InboxDateFilter
        defaultDateRange={defaultRange}
        onDateRangeChange={jest.fn()}
      />
    );

    expect(datePickerProps.defaultDateRange).toEqual(defaultRange);
  });

  it('offers only presets within the 30-day activity window and disables custom range', () => {
    render(
      <InboxDateFilter
        defaultDateRange={defaultRange}
        onDateRangeChange={jest.fn()}
      />
    );

    expect(datePickerProps.allowCustomRange).toBe(false);

    const optionDays = Object.values(
      datePickerProps.options as Record<string, { days: number }>
    ).map((option) => option.days);

    expect(optionDays.length).toBeGreaterThan(0);
    expect(Math.max(...optionDays)).toBeLessThanOrEqual(30);
  });
});
