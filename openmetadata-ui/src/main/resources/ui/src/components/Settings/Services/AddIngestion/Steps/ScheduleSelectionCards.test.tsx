/*
 *  Copyright 2025 Collate.
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

import { fireEvent, render, screen, within } from '@testing-library/react';
import { SelectionOption } from '../../../../common/SelectionCardGroup/SelectionCardGroup.interface';
import ScheduleSelectionCards from './ScheduleSelectionCards';

const OPTIONS: SelectionOption[] = [
  {
    value: 'schedule',
    label: 'Schedule',
    description: 'Runs repeatedly on a cadence you set.',
    icon: <span data-testid="schedule-icon" />,
  },
  {
    value: 'onDemand',
    label: 'On demand',
    description: 'Runs only when you trigger it manually.',
    icon: <span data-testid="ondemand-icon" />,
  },
];

describe('ScheduleSelectionCards', () => {
  it('should render all options with label, description and icon', () => {
    render(<ScheduleSelectionCards options={OPTIONS} value="schedule" />);

    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(
      screen.getByText('Runs repeatedly on a cadence you set.')
    ).toBeInTheDocument();
    expect(screen.getByText('On demand')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-icon')).toBeInTheDocument();
    expect(screen.getByTestId('ondemand-icon')).toBeInTheDocument();
  });

  it('should show the selected indicator only on the selected card', () => {
    render(<ScheduleSelectionCards options={OPTIONS} value="schedule" />);

    const scheduleCard = screen.getByTestId('schedular-schedule');
    const onDemandCard = screen.getByTestId('schedular-onDemand');

    expect(
      within(scheduleCard).getByTestId('selected-indicator')
    ).toBeInTheDocument();
    expect(
      within(onDemandCard).getByTestId('unselected-indicator')
    ).toBeInTheDocument();
  });

  it('should call onChange with the option value when a card is clicked', () => {
    const onChange = jest.fn();
    render(
      <ScheduleSelectionCards
        options={OPTIONS}
        value="schedule"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('schedular-onDemand'));

    expect(onChange).toHaveBeenCalledWith('onDemand');
  });

  it('should not call onChange when disabled', () => {
    const onChange = jest.fn();
    render(
      <ScheduleSelectionCards
        disabled
        options={OPTIONS}
        value="schedule"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('schedular-onDemand'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
