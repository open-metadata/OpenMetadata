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
import userEvent from '@testing-library/user-event';
import React from 'react';
import CronEditor from './CronEditor';
import { CronEditorProp } from './CronEditor.interface';

const mockProps: CronEditorProp = {
  onChange: jest.fn,
};

describe('Test CronEditor component', () => {
  it('CronEditor component should render', async () => {
    render(<CronEditor {...mockProps} />);

    expect(await screen.findByTestId('cron-container')).toBeInTheDocument();
    expect(
      await screen.findByTestId('time-dropdown-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('cron-type')).toBeInTheDocument();
  });

  it('Hour option should render corresponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    const cronType = await screen.findByTestId('cron-type');
    userEvent.selectOptions(cronType, 'hour');

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

    const cronType = await screen.findByTestId('cron-type');
    userEvent.selectOptions(cronType, 'minute');

    expect(
      await screen.findByTestId('minute-segment-container')
    ).toBeInTheDocument();

    const minutOptions = await screen.findByTestId('minute-segment-options');

    expect(minutOptions).toBeInTheDocument();

    userEvent.selectOptions(minutOptions, '10');

    expect(await screen.findByText('10')).toBeInTheDocument();
  });

  it('Day option should render corresponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    const cronType = await screen.findByTestId('cron-type');
    userEvent.selectOptions(cronType, 'day');

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

    expect(await screen.findAllByText('10')).toHaveLength(2);
    expect(await screen.findAllByText('02')).toHaveLength(2);
  });

  it('week option should render corresponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    const cronType = await screen.findByTestId('cron-type');
    userEvent.selectOptions(cronType, 'week');

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

    expect(await screen.findAllByText('10')).toHaveLength(2);
    expect(await screen.findAllByText('02')).toHaveLength(2);
  });

  it('None option should render corresponding component', async () => {
    render(<CronEditor {...mockProps} />);

    const cronType = await screen.findByTestId('cron-type');
    await act(async () => {
      userEvent.selectOptions(cronType, '');
    });

    expect(
      await screen.findByTestId('manual-segment-container')
    ).toBeInTheDocument();
  });
});
