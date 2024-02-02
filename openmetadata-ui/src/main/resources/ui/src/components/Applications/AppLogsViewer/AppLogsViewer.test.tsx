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
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  RunType,
  ScheduleTimeline,
  Status,
} from '../../../generated/entity/applications/appRunRecord';
import AppLogsViewer from './AppLogsViewer.component';

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTimeWithTimezone: jest
    .fn()
    .mockReturnValue('formatDateTimeWithTimezone'),
}));

jest.mock('../../../utils/StringsUtils', () => ({
  formatJsonString: jest.fn().mockReturnValue('logs'),
}));

jest.mock('../../CopyToClipboardButton/CopyToClipboardButton', () =>
  jest.fn().mockReturnValue(<>CopyToClipboardButton</>)
);

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Badge: jest.fn().mockReturnValue(<div>Badge</div>),
}));

const mockProps1 = {
  data: {
    appId: '6e4d3dcf-238d-4874-b4e4-dd863ede6544',
    status: Status.Success,
    runType: RunType.OnDemand,
    startTime: 1706871884587,
    endTime: 1706871891251,
    timestamp: 1706871884587,
    successContext: {
      stats: {
        jobStats: {
          totalRecords: 274,
          failedRecords: 0,
          successRecords: 274,
        },
        entityStats: {},
      },
    },
    scheduleInfo: {
      scheduleType: ScheduleTimeline.Custom,
      cronExpression: '0 0 0 1/1 * ? *',
    },
    id: '6e4d3dcf-238d-4874-b4e4-dd863ede6544-OnDemand-1706871884587',
  },
};

const mockProps2 = {
  data: {
    ...mockProps1.data,
    timestamp: undefined,
    successContext: undefined,
    failureContext: {
      stats: {
        jobStats: {
          totalRecords: 274,
          failedRecords: 0,
          successRecords: 274,
        },
        entityStats: {},
      },
    },
  },
};

describe('AppLogsViewer component', () => {
  it('should contain all necessary elements', () => {
    render(<AppLogsViewer {...mockProps1} />);

    expect(screen.getByText('label.status:')).toBeInTheDocument();
    expect(screen.getByText('label.success')).toBeInTheDocument();
    expect(screen.getByText('label.index-states:')).toBeInTheDocument();
    expect(screen.getAllByText('Badge')).toHaveLength(3);
    expect(screen.getByText('label.last-updated:')).toBeInTheDocument();
    expect(screen.getByText('formatDateTimeWithTimezone')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'label.jump-to-end' }));

    expect(screen.getByText('CopyToClipboardButton')).toBeInTheDocument();
  });

  it('should render necessary element based on mockProps2', () => {
    render(<AppLogsViewer {...mockProps2} />);

    expect(screen.getByText('--')).toBeInTheDocument();
    // Note: not asserting other elements as for failure also same elements will render
  });
});
