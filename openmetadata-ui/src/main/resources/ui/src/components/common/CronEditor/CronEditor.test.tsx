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

import {
  act,
  findByRole,
  fireEvent,
  render,
  screen,
  waitForElement,
} from '@testing-library/react';
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

    expect(cronType).toBeInTheDocument();

    const cronSelect = await findByRole(cronType, 'combobox');
    act(() => {
      userEvent.click(cronSelect);
    });
    await waitForElement(() => screen.getByText('label.hour'));
    await act(async () => {
      fireEvent.click(screen.getByText('label.hour'));
    });

    expect(
      await screen.findByTestId('hour-segment-container')
    ).toBeInTheDocument();

    const minutesOptions = await screen.findByTestId('minute-options');

    expect(minutesOptions).toBeInTheDocument();

    const minuteSelect = await findByRole(minutesOptions, 'combobox');

    act(() => {
      userEvent.click(minuteSelect);
    });
    await waitForElement(() => screen.getByText('03'));
    await act(async () => {
      fireEvent.click(screen.getByText('03'));
    });

    expect(await screen.getAllByText('03')).toHaveLength(2);
  });

  it('Minute option should render corresponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    const cronType = await screen.findByTestId('cron-type');

    expect(cronType).toBeInTheDocument();

    const cronSelect = await findByRole(cronType, 'combobox');
    act(() => {
      userEvent.click(cronSelect);
    });
    await waitForElement(() => screen.getByText('label.minute-plural'));
    await act(async () => {
      fireEvent.click(screen.getByText('label.minute-plural'));
    });

    expect(
      await screen.findByTestId('minute-segment-container')
    ).toBeInTheDocument();

    const minutesOptions = await screen.findByTestId('minute-segment-options');

    expect(minutesOptions).toBeInTheDocument();

    const minuteSelect = await findByRole(minutesOptions, 'combobox');

    act(() => {
      userEvent.click(minuteSelect);
    });
    await waitForElement(() => screen.getByText('15'));
    await act(async () => {
      fireEvent.click(screen.getByText('15'));
    });

    expect(await screen.getAllByText('15')).toHaveLength(2);
  });

  it('Day option should render corresponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    const cronType = await screen.findByTestId('cron-type');

    expect(cronType).toBeInTheDocument();

    const cronSelect = await findByRole(cronType, 'combobox');
    act(() => {
      userEvent.click(cronSelect);
    });
    await waitForElement(() => screen.getByText('label.day'));
    await act(async () => {
      fireEvent.click(screen.getByText('label.day'));
    });

    expect(
      await screen.findByTestId('day-segment-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('time-option-container')
    ).toBeInTheDocument();

    const minutesOptions = await screen.findByTestId('minute-options');
    const hourOptions = await screen.findByTestId('hour-options');

    expect(minutesOptions).toBeInTheDocument();
    expect(hourOptions).toBeInTheDocument();

    const minuteSelect = await findByRole(minutesOptions, 'combobox');
    act(() => {
      userEvent.click(minuteSelect);
    });
    await waitForElement(() => screen.getByText('10'));
    await act(async () => {
      fireEvent.click(screen.getByText('10'));
    });

    expect(await screen.findAllByText('10')).toHaveLength(2);
  });

  it('week option should render corresponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    const cronType = await screen.findByTestId('cron-type');

    expect(cronType).toBeInTheDocument();

    const cronSelect = await findByRole(cronType, 'combobox');
    act(() => {
      userEvent.click(cronSelect);
    });
    await waitForElement(() => screen.getByText('label.week'));
    await act(async () => {
      fireEvent.click(screen.getByText('label.week'));
    });

    expect(
      await screen.findByTestId('week-segment-time-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('week-segment-time-options-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('week-segment-day-option-container')
    ).toBeInTheDocument();

    const minutesOptions = await screen.findByTestId('minute-options');

    expect(minutesOptions).toBeInTheDocument();

    const minuteSelect = await findByRole(minutesOptions, 'combobox');
    act(() => {
      userEvent.click(minuteSelect);
    });
    await waitForElement(() => screen.getByText('10'));
    await act(async () => {
      fireEvent.click(screen.getByText('10'));
    });

    expect(await screen.findAllByText('10')).toHaveLength(2);

    const hourOptions = await screen.findByTestId('hour-options');

    expect(hourOptions).toBeInTheDocument();
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
