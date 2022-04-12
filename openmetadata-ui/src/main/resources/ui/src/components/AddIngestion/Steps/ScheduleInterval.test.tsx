/*
 *  Copyright 2021 Collate
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

import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { ScheduleIntervalProps } from '../addIngestion.interface';
import ScheduleInterval from './ScheduleInterval';

jest.mock('../../common/CronEditor/CronEditor', () => {
  return jest.fn().mockImplementation(() => <div>CronEditor.component</div>);
});

jest.mock('../../common/toggle-switch/ToggleSwitchV1', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>ToggleSwitchV1.component</div>);
});

const mockScheduleIntervalProps: ScheduleIntervalProps = {
  repeatFrequency: '',
  handleRepeatFrequencyChange: jest.fn(),
  startDate: '',
  handleStartDateChange: jest.fn(),
  endDate: '',
  handleEndDateChange: jest.fn(),
  onBack: jest.fn(),
  onDeloy: jest.fn(),
};

describe('Test ScheduleInterval component', () => {
  it('ScheduleInterval component should render', async () => {
    const { container } = render(
      <ScheduleInterval {...mockScheduleIntervalProps} />
    );

    const scheduleIntervelContainer = await findByTestId(
      container,
      'schedule-intervel-container'
    );
    const startDate = await findByTestId(container, 'start-date');
    const endDate = await findByTestId(container, 'end-date');
    const backButton = await findByTestId(container, 'back-button');
    const deployButton = await findByTestId(container, 'deploy-button');
    const cronEditor = await findByText(container, 'CronEditor.component');

    expect(scheduleIntervelContainer).toBeInTheDocument();
    expect(cronEditor).toBeInTheDocument();
    expect(startDate).toBeInTheDocument();
    expect(endDate).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();
    expect(deployButton).toBeInTheDocument();
  });
});
