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

import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  MOCK_PROPS,
  TEST_SEARCHED_TEAM_OPTIONS,
  TEST_TEAM_OPTIONS,
} from '../../../../constants/TeamAndUserSelectItem.constants';
import TeamAndUserSelectItem from './TeamAndUserSelectItem';

jest.mock('../../../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

describe('TeamAndUserSelectItem Component', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('dropdown should be visible after clicking trigger button', async () => {
    await act(async () => {
      render(<TeamAndUserSelectItem {...MOCK_PROPS} />);
    });

    const triggerButton = screen.getByTestId('dropdown-trigger-button');

    await act(async () => {
      fireEvent.click(triggerButton);
      jest.advanceTimersByTime(500);
    });

    expect(
      screen.getByTestId('team-user-select-dropdown-0')
    ).toBeInTheDocument();
  });

  it('should show initial options on click of trigger button', async () => {
    await act(async () => {
      render(<TeamAndUserSelectItem {...MOCK_PROPS} />);
    });

    const triggerButton = screen.getByTestId('dropdown-trigger-button');

    await act(async () => {
      fireEvent.click(triggerButton);
      jest.advanceTimersByTime(500);
    });

    expect(
      screen.getByTestId(`${TEST_TEAM_OPTIONS[0].value}-option-label`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`${TEST_TEAM_OPTIONS[1].value}-option-label`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`${TEST_TEAM_OPTIONS[2].value}-option-label`)
    ).toBeInTheDocument();
  });

  it('should show searched options after searching', async () => {
    await act(async () => {
      render(<TeamAndUserSelectItem {...MOCK_PROPS} />);
    });

    const triggerButton = screen.getByTestId('dropdown-trigger-button');

    await act(async () => {
      fireEvent.click(triggerButton);
      jest.advanceTimersByTime(500);
    });

    expect(
      screen.getByTestId(`${TEST_TEAM_OPTIONS[0].value}-option-label`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`${TEST_TEAM_OPTIONS[1].value}-option-label`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`${TEST_TEAM_OPTIONS[2].value}-option-label`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`${TEST_TEAM_OPTIONS[3].value}-option-label`)
    ).toBeInTheDocument();

    const searchInput = screen.getByTestId('search-input');

    fireEvent.change(searchInput, { target: { value: 'test' } });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(
      screen.getByTestId(`${TEST_SEARCHED_TEAM_OPTIONS[0].value}-option-label`)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`${TEST_SEARCHED_TEAM_OPTIONS[1].value}-option-label`)
    ).toBeInTheDocument();
  });

  it('dropdown should close after clicking outside it', async () => {
    await act(async () => {
      render(<TeamAndUserSelectItem {...MOCK_PROPS} />);
    });

    const triggerButton = screen.getByTestId('dropdown-trigger-button');

    await act(async () => {
      fireEvent.click(triggerButton);
      jest.advanceTimersByTime(500);
    });

    expect(
      screen.getByTestId('team-user-select-dropdown-0')
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(document.body);
    });

    expect(screen.queryByTestId('team-user-select-dropdown-0')).toBeNull();
  });
});
