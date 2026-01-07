/*
 *  Copyright 2024 Collate.
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
import { render, screen } from '@testing-library/react';
import TestSummaryCustomTooltip from './TestSummaryCustomTooltip.component';

const mockProps = {
  active: true,
  payload: [
    {
      stroke: '#7147E8',
      strokeWidth: 1,
      fill: '#fff',
      dataKey: 'minValueLength',
      name: 'minValueLength',
      color: '#7147E8',
      value: 36,
      payload: {
        name: 'Jan 3, 2024, 6:45 PM',
        status: 'Failed',
        minValueLength: 12,
        maxValueLength: 24,
        passedRows: 4,
        failedRows: 2,
        passedRowsPercentage: '60%',
        failedRowsPercentage: '40%',
      },
    },
  ],
};
const mockPropsWithFreshness = {
  active: true,
  payload: [
    {
      stroke: '#7147E8',
      strokeOpacity: 1,
      strokeWidth: 1,
      fill: '#fff',
      dataKey: 'freshness',
      name: 'freshness',
      color: '#7147E8',
      value: 224813364.39,
      payload: {
        name: 1748045364386,
        status: 'Failed',
        freshness: 224813364.39,
      },
    },
  ],
};
jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockReturnValue('Jan 3, 2024, 6:45 PM (UTC+05:30)'),
  formatDateTimeLong: jest
    .fn()
    .mockReturnValue('Jan 3, 2024, 6:45 PM (UTC+05:30)'),
  convertSecondsToHumanReadableFormat: jest
    .fn()
    .mockReturnValue('7Y 2M 22d 9m 24s'),
}));

jest.mock('../../../../utils/TasksUtils', () => ({
  getTaskDetailPath: jest.fn(),
}));

jest.mock('../../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockReturnValue(<div>OwnerLabel</div>),
}));
jest.mock('../../../../utils/CommonUtils', () => ({
  formatTimeFromSeconds: jest.fn().mockReturnValue('1 hour'),
  formatNumberWithComma: jest.fn().mockImplementation((num) => num.toString()),
}));

describe('Test TestSummaryCustomTooltip component', () => {
  it('should render', async () => {
    render(<TestSummaryCustomTooltip {...mockProps} />);

    expect(
      await screen.findByTestId('test-summary-tooltip-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('test-summary-tooltip-container')
    ).toBeInTheDocument();
    expect((await screen.findByTestId('status')).textContent).toBe('Failed');
    expect((await screen.findByTestId('minValueLength')).textContent).toBe(
      '12'
    );
    expect((await screen.findByTestId('maxValueLength')).textContent).toBe(
      '24'
    );
    expect((await screen.findByTestId('rows-passed')).textContent).toBe('4/6');
    expect((await screen.findByTestId('rows-failed')).textContent).toBe('2/6');
    expect(
      (await screen.findByTestId('passedRowsPercentage')).textContent
    ).toBe('60%');
    expect(
      (await screen.findByTestId('failedRowsPercentage')).textContent
    ).toBe('40%');
    expect(screen.queryByText('name')).not.toBeInTheDocument();
  });

  it('should display freshness values in seconds', async () => {
    render(<TestSummaryCustomTooltip {...mockPropsWithFreshness} />);

    expect((await screen.findByTestId('status')).textContent).toBe('Failed');
    expect((await screen.findByTestId('freshness')).textContent).toBe(
      '7Y 2M 22d 9m 24s'
    );
  });
});
