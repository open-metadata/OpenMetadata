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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import CronEditor from './CronEditor';

describe('Test CronEditor component', () => {
  it('CronEditor component should render', async () => {
    render(<CronEditor />);

    expect(await screen.findByTestId('cron-container')).toBeInTheDocument();
    expect(
      await screen.findByTestId('time-dropdown-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('ingestion-type')).toBeInTheDocument();
  });

  it('Hour option should render corrosponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    const ingestionType = await screen.findByTestId('ingestion-type');
    userEvent.selectOptions(ingestionType, 'hour');

    expect(
      await screen.findByTestId('hour-segment-container')
    ).toBeInTheDocument();

    const minutOptions = await screen.findByTestId('minute-options');

    expect(minutOptions).toBeInTheDocument();

    userEvent.selectOptions(minutOptions, '10');

    expect(await screen.findByText('10')).toBeInTheDocument();
  });

  it('Minute option should render corrosponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    const ingestionType = await screen.findByTestId('ingestion-type');
    userEvent.selectOptions(ingestionType, 'minute');

    expect(
      await screen.findByTestId('minute-segment-container')
    ).toBeInTheDocument();

    const minutOptions = await screen.findByTestId('minute-segment-options');

    expect(minutOptions).toBeInTheDocument();

    userEvent.selectOptions(minutOptions, '10');

    expect(await screen.findByText('10')).toBeInTheDocument();
  });

  it('Day option should render corrosponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    const ingestionType = await screen.findByTestId('ingestion-type');
    userEvent.selectOptions(ingestionType, 'day');

    expect(
      await screen.findByTestId('day-segment-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('time-option-container')
    ).toBeInTheDocument();

    const minutOptions = await screen.findByTestId('minute-options');
    const hourOptions = await screen.findByTestId('hour-options');

    expect(minutOptions).toBeInTheDocument();
    expect(hourOptions).toBeInTheDocument();

    userEvent.selectOptions(minutOptions, '10');
    userEvent.selectOptions(hourOptions, '2');

    expect((await screen.findAllByText('10')).length).toBe(2);
    expect((await screen.findAllByText('02')).length).toBe(2);
  });

  it('week option should render corrosponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    const ingestionType = await screen.findByTestId('ingestion-type');
    userEvent.selectOptions(ingestionType, 'week');

    expect(
      await screen.findByTestId('week-segment-time-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('week-segment-time-options-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('week-segment-day-option-container')
    ).toBeInTheDocument();

    const minutOptions = await screen.findByTestId('minute-options');
    const hourOptions = await screen.findByTestId('hour-options');

    expect(minutOptions).toBeInTheDocument();
    expect(hourOptions).toBeInTheDocument();

    userEvent.selectOptions(minutOptions, '10');
    userEvent.selectOptions(hourOptions, '2');

    expect((await screen.findAllByText('10')).length).toBe(2);
    expect((await screen.findAllByText('02')).length).toBe(2);
  });
});
