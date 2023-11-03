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
  getByText,
  getByTitle,
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

const getHourDescription = (value: string) =>
  `label.schedule-to-run-every hour ${value} past the hour`;

const getMinuteDescription = (value: string) =>
  `label.schedule-to-run-every ${value}`;

const getDayDescription = () => 'label.schedule-to-run-every day at 00:00';

const handleScheduleEverySelector = async (text: string) => {
  const everyDropdown = await screen.findByTestId('time-dropdown-container');

  expect(everyDropdown).toBeInTheDocument();

  const cronSelect = await findByRole(everyDropdown, 'combobox');
  act(() => {
    userEvent.click(cronSelect);
  });
  await waitForElement(
    async () => await expect(screen.getByText(text)).toBeInTheDocument()
  );
  await act(async () => {
    fireEvent.click(screen.getByText(text));
  });

  await waitForElement(
    async () => await expect(getByText(everyDropdown, text)).toBeInTheDocument()
  );
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

    await handleScheduleEverySelector('label.hour');

    expect(screen.getByTestId('schedule-description')).toHaveTextContent(
      getHourDescription('0 minute')
    );

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

    expect(await getByTitle(minutesOptions, '03')).toBeInTheDocument();

    expect(screen.getByTestId('schedule-description')).toHaveTextContent(
      getHourDescription('3 minutes')
    );
  });

  it('Minute option should render corresponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    await handleScheduleEverySelector('label.minute-plural');

    expect(screen.getByTestId('schedule-description')).toHaveTextContent(
      getMinuteDescription('5')
    );

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

    expect(screen.getByTestId('schedule-description')).toHaveTextContent(
      getMinuteDescription('15')
    );
  });

  it('Day option should render corresponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    await handleScheduleEverySelector('label.day');

    expect(screen.getByTestId('schedule-description')).toHaveTextContent(
      getDayDescription()
    );

    expect(
      await screen.findByTestId('day-segment-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('time-option-container')
    ).toBeInTheDocument();

    // For Hours Selector
    const hourOptions = await screen.findByTestId('hour-options');

    expect(hourOptions).toBeInTheDocument();

    const hourSelect = await findByRole(hourOptions, 'combobox');
    act(() => {
      userEvent.click(hourSelect);
    });

    await waitForElement(() => screen.getByText('01'));
    await act(async () => {
      fireEvent.click(screen.getByText('01'));
    });

    expect(await getByTitle(hourOptions, '01')).toBeInTheDocument();

    // For Minute Selector
    const minutesOptions = await screen.findByTestId('minute-options');

    expect(minutesOptions).toBeInTheDocument();
  });

  it('week option should render corresponding component', async () => {
    render(<CronEditor disabled={false} onChange={jest.fn} />);

    await handleScheduleEverySelector('label.week');

    expect(screen.getByTestId('schedule-description')).toHaveTextContent(
      'label.schedule-to-run-every week on label.monday at 00:00'
    );

    expect(
      await screen.findByTestId('week-segment-time-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('week-segment-time-options-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('week-segment-day-option-container')
    ).toBeInTheDocument();

    // For Hours Selector
    const hourOptions = await screen.findByTestId('hour-options');

    expect(hourOptions).toBeInTheDocument();

    const hourSelect = await findByRole(hourOptions, 'combobox');
    act(() => {
      userEvent.click(hourSelect);
    });

    await waitForElement(() => screen.getByText('10'));
    await act(async () => {
      fireEvent.click(screen.getByText('10'));
    });

    expect(await getByTitle(hourOptions, '10')).toBeInTheDocument();

    // For Minute Selector
    const minutesOptions = await screen.findByTestId('minute-options');

    expect(minutesOptions).toBeInTheDocument();

    // For Days Selector

    const daysContainer = await screen.findByTestId(
      'week-segment-day-option-container'
    );

    expect(daysContainer).toBeInTheDocument();
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
