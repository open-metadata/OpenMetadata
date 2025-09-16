/*
 *  Copyright 2022 Collate.
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

import { act, render, screen } from '@testing-library/react';
import ScheduleInterval from './ScheduleInterval';
import { ScheduleIntervalProps } from './ScheduleInterval.interface';

const mockScheduleIntervalProps: ScheduleIntervalProps<{ cron: string }> = {
  status: 'initial',
  initialData: { cron: '' },
  onBack: jest.fn(),
  onDeploy: jest.fn(),
  buttonProps: {
    okText: 'Add',
  },
};

jest.mock('../../../../../utils/i18next/i18nextUtil', () => ({
  getCurrentLocaleForConstrue: jest.fn().mockReturnValue('en-US'),
}));

describe('Test ScheduleInterval component', () => {
  it('ScheduleInterval component should render', async () => {
    await act(async () => {
      render(<ScheduleInterval {...mockScheduleIntervalProps} />);
    });

    const scheduleIntervelContainer = screen.getByTestId(
      'schedule-intervel-container'
    );
    const backButton = screen.getByTestId('back-button');
    const deployButton = screen.getByTestId('deploy-button');
    const scheduleCardContainer = screen.getByTestId(
      'schedular-card-container'
    );

    expect(scheduleIntervelContainer).toBeInTheDocument();
    expect(scheduleCardContainer).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();
    expect(deployButton).toBeInTheDocument();
  });

  it('should not render debug log switch when allowEnableDebugLog is false', async () => {
    await act(async () => {
      render(<ScheduleInterval {...mockScheduleIntervalProps} />);
    });

    expect(screen.queryByTestId('enable-debug-log')).toBeNull();
  });

  it('should render enable debug log switch when allowEnableDebugLog is true', async () => {
    await act(async () => {
      render(
        <ScheduleInterval
          {...mockScheduleIntervalProps}
          debugLog={{ allow: true }}
        />
      );
    });

    expect(screen.getByTestId('enable-debug-log')).toBeInTheDocument();
  });

  it('debug log switch should be initially checked when debugLogInitialValue is true', async () => {
    await act(async () => {
      render(
        <ScheduleInterval
          {...mockScheduleIntervalProps}
          debugLog={{ allow: true, initialValue: true }}
        />
      );
    });

    expect(screen.getByTestId('enable-debug-log')).toHaveClass(
      'ant-switch-checked'
    );
  });

  it('debug log switch should not be initially checked when debugLogInitialValue is false', async () => {
    await act(async () => {
      render(
        <ScheduleInterval
          {...mockScheduleIntervalProps}
          debugLog={{ allow: true }}
        />
      );
    });

    expect(screen.getByTestId('enable-debug-log')).not.toHaveClass(
      'ant-switch-checked'
    );
  });
});
