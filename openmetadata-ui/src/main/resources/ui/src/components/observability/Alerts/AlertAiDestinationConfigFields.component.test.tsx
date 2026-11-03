/*
 *  Copyright 2026 Collate.
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
import { SubscriptionCategory } from '../../../generated/events/eventSubscription';
import AlertAiDestinationConfigFields from './AlertAiDestinationConfigFields.component';
import type { AlertAiFormValue } from './AlertAiFormFields.interface';
import { getAlertAiTeamOptions } from './AlertAiFormFieldsSearchUtils';

jest.mock('./AlertAiFormFieldsSearchUtils', () => ({
  getAlertAiTeamOptions: jest.fn(),
  getAlertAiUserOptions: jest.fn().mockResolvedValue([]),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const TEAM_FQN = 'PW%team-1';

const renderTeamsDestination = () => {
  const onChange = jest.fn();
  const destination = {
    destinationType: SubscriptionCategory.Teams,
    config: {},
  };

  render(
    <AlertAiDestinationConfigFields
      destination={destination as never}
      name={0}
      value={{ destinations: [destination] } as unknown as AlertAiFormValue}
      onChange={onChange}
    />
  );

  return { onChange };
};

const openAndSearch = async () => {
  fireEvent.click(screen.getByTestId('team-user-select-trigger-0'));
  fireEvent.change(screen.getByPlaceholderText('label.search-by-type'), {
    target: { value: 'PW' },
  });
  await act(async () => {
    jest.advanceTimersByTime(600);
  });
};

describe('AlertAiDestinationConfigFields — team/user picker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (getAlertAiTeamOptions as jest.Mock).mockResolvedValue([
      { label: 'PW Team 1', value: TEAM_FQN },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays open while the drawer scrolls, so a search result can be picked', async () => {
    const { onChange } = renderTeamsDestination();
    await openAndSearch();

    fireEvent.scroll(window);
    fireEvent.scroll(document.body);

    fireEvent.click(screen.getByTestId(`team-user-option-${TEAM_FQN}`));

    expect(getAlertAiTeamOptions).toHaveBeenLastCalledWith('PW');
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByTestId('team-user-select-dropdown-0')).toBeVisible();
  });

  it('closes on Escape without the key reaching the drawer around it', async () => {
    const drawerKeyDown = jest.fn();
    document.body.addEventListener('keydown', drawerKeyDown);
    renderTeamsDestination();
    await openAndSearch();

    fireEvent.keyDown(screen.getByPlaceholderText('label.search-by-type'), {
      key: 'Escape',
    });

    expect(screen.queryByTestId('team-user-select-dropdown-0')).toBeNull();
    expect(drawerKeyDown).not.toHaveBeenCalled();

    document.body.removeEventListener('keydown', drawerKeyDown);
  });

  it('closes on a pointer press outside and clears the search', async () => {
    renderTeamsDestination();
    await openAndSearch();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByTestId('team-user-select-dropdown-0')).toBeNull();

    fireEvent.click(screen.getByTestId('team-user-select-trigger-0'));

    expect(screen.getByPlaceholderText('label.search-by-type')).toHaveValue('');
  });
});
