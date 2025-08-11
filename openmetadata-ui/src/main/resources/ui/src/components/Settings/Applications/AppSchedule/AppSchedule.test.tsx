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
import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import {
  AppType,
  ScheduleType,
} from '../../../../generated/entity/applications/app';
import { EntityReference } from '../../../../generated/tests/testSuite';
import { mockApplicationData } from '../../../../mocks/rests/applicationAPI.mock';
import { getScheduleOptionsFromSchedules } from '../../../../utils/SchedularUtils';
import AppSchedule from './AppSchedule.component';

const mockGetIngestionPipelineByFqn = jest.fn().mockResolvedValue({
  deployed: false,
});
const mockOnSave = jest.fn();
const mockOnDemandTrigger = jest.fn();
const mockOnDeployTrigger = jest.fn();

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelineByFqn: jest
    .fn()
    .mockImplementation((...args) => mockGetIngestionPipelineByFqn(...args)),
}));

jest.mock('../../Services/AddIngestion/Steps/ScheduleInterval', () =>
  jest.fn().mockImplementation(({ onDeploy, onBack }) => (
    <div>
      ScheduleInterval
      <button onClick={onDeploy}>Submit ScheduleInterval</button>
      <button onClick={onBack}>Cancel ScheduleInterval</button>
    </div>
  ))
);

jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p>Loader</p>);
});

jest.mock('../AppRunsHistory/AppRunsHistory.component', () =>
  jest.fn().mockImplementation(() => <div>AppRunsHistory</div>)
);

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Modal: jest.fn().mockImplementation(({ open, children }) => (
    <div>
      {open ? 'Modal is open' : 'Modal is close'}
      {children}
    </div>
  )),
}));

const mockProps1 = {
  appData: {
    ...mockApplicationData,
    name: 'DataInsightsReportApplication',
  },
  loading: {
    isRunLoading: false,
    isDeployLoading: false,
  },
  jsonSchema: {},
  onSave: mockOnSave,
  onDemandTrigger: mockOnDemandTrigger,
  onDeployTrigger: mockOnDeployTrigger,
};

const mockProps2 = {
  ...mockProps1,
  appData: {
    ...mockProps1.appData,
    appType: AppType.External,
    pipelines: [{}] as EntityReference[],
    appSchedule: null,
    scheduleType: ScheduleType.Scheduled,
    name: 'DataInsightsReportApplication',
  },
};

const mockProps3 = {
  ...mockProps1,
  appData: {
    ...mockProps1.appData,
    deleted: true,
  },
};

jest.mock('../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest.fn().mockReturnValue({
    config: {
      limits: {
        config: {
          featureLimits: [
            { name: 'app', pipelineSchedules: ['daily', 'weekly'] },
          ],
        },
      },
    },
  }),
}));

jest.mock('../../../../utils/SchedularUtils', () => ({
  getCronDefaultValue: jest.fn().mockReturnValue('0 0 * * *'),
  getScheduleOptionsFromSchedules: jest.fn().mockReturnValue([]),
}));

describe('AppSchedule component', () => {
  it('should render necessary elements for mockProps1', () => {
    render(<AppSchedule {...mockProps1} />);

    expect(screen.getByText('label.schedule-type')).toBeInTheDocument();
    expect(screen.getByText('label.schedule-interval')).toBeInTheDocument();
    expect(screen.getByTestId('cron-string')).toBeInTheDocument();
    expect(screen.getByText('Modal is close')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.edit' }));

    expect(screen.getByText('Modal is open')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.run-now' }));

    expect(mockOnDemandTrigger).toHaveBeenCalled();
  });

  it('should render necessary elements based on mockProps2', async () => {
    render(<AppSchedule {...mockProps2} />);

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(screen.queryByText('label.run-now')).not.toBeInTheDocument();

    expect(screen.queryByText('label.schedule-type')).not.toBeInTheDocument();
    expect(
      screen.queryByText('label.schedule-interval')
    ).not.toBeInTheDocument();

    expect(mockGetIngestionPipelineByFqn).toHaveBeenCalledWith('');
    expect(
      screen.getByText('message.no-ingestion-pipeline-found')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.deploy' }));

    expect(mockOnDeployTrigger).toHaveBeenCalled();
  });

  it('check methods in AppSchedule component', () => {
    render(<AppSchedule {...mockProps1} />);

    expect(screen.getByText('Modal is close')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.edit' }));

    expect(screen.getByText('Modal is open')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Submit ScheduleInterval' })
    );

    expect(mockOnSave).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel ScheduleInterval' })
    );

    expect(screen.getByText('Modal is close')).toBeInTheDocument();
  });

  it('should show application disable message if appData.deleted is true', () => {
    render(<AppSchedule {...mockProps3} />);

    expect(
      screen.getByText('message.application-disabled-message')
    ).toBeInTheDocument();
  });

  it('if failed in fetch pipelineDetails, should not show AppRunsHistory', () => {
    mockGetIngestionPipelineByFqn.mockRejectedValueOnce({});
    render(<AppSchedule {...mockProps2} />);

    expect(screen.queryByText('AppRunsHistory')).not.toBeInTheDocument();
  });

  it('should call getScheduleOptionsFromSchedules with application pipelineStatus values', () => {
    mockGetIngestionPipelineByFqn.mockRejectedValueOnce({});
    render(
      <AppSchedule
        {...mockProps1}
        appData={{
          ...mockApplicationData,
          name: 'something',
          appType: AppType.Internal,
        }}
      />
    );

    expect(getScheduleOptionsFromSchedules).toHaveBeenCalledWith([
      'daily',
      'weekly',
    ]);
  });
});
