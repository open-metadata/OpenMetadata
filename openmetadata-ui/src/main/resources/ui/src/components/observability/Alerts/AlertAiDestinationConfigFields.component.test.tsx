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
import { fireEvent, render, screen } from '@testing-library/react';
import { AlertType } from '../../../generated/events/api/createEventSubscription';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import AlertAiDestinationConfigFields from './AlertAiDestinationConfigFields.component';
import { AlertAiDestinationItemProps } from './AlertAiFormFields.interface';

jest.mock('./AlertAiFormFieldsSearchUtils', () => ({
  getAlertAiTeamOptions: jest
    .fn()
    .mockResolvedValue([{ label: 'Data Platform', value: 'data-platform' }]),
  getAlertAiUserOptions: jest.fn().mockResolvedValue([]),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const destination = {
  category: SubscriptionCategory.Teams,
  config: { receivers: [] },
  destinationType: SubscriptionCategory.Teams,
  type: SubscriptionType.Email,
} satisfies AlertAiDestinationItemProps['destination'];

const value: AlertAiDestinationItemProps['value'] = {
  alertType: AlertType.Observability,
  destinations: [destination],
  input: {},
  name: 'test-alert',
  readTimeout: 12,
  timeout: 10,
};

const renderOpenPicker = () => {
  render(
    <div data-testid="scroll-container">
      <AlertAiDestinationConfigFields
        destination={destination}
        name={0}
        value={value}
        onChange={jest.fn()}
      />
    </div>
  );
  fireEvent.click(screen.getByTestId('team-user-select-trigger-0'));

  expect(screen.getByTestId('team-user-search-input-0')).toBeInTheDocument();
};

describe('AlertAiDestinationConfigFields team/user picker', () => {
  it('stays open when an ancestor of the trigger scrolls', () => {
    renderOpenPicker();

    fireEvent.scroll(screen.getByTestId('scroll-container'));

    expect(screen.getByTestId('team-user-search-input-0')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    renderOpenPicker();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(
      screen.queryByTestId('team-user-search-input-0')
    ).not.toBeInTheDocument();
  });

  it('keeps the search when Escape ends an IME composition', () => {
    renderOpenPicker();

    fireEvent.keyDown(document, { isComposing: true, key: 'Escape' });

    expect(screen.getByTestId('team-user-search-input-0')).toBeInTheDocument();
  });

  it('closes when the user scrolls the form, not when they scroll the options', () => {
    renderOpenPicker();

    fireEvent.wheel(screen.getByTestId('team-user-select-dropdown-0'));

    expect(screen.getByTestId('team-user-search-input-0')).toBeInTheDocument();

    fireEvent.wheel(screen.getByTestId('scroll-container'));

    expect(
      screen.queryByTestId('team-user-search-input-0')
    ).not.toBeInTheDocument();
  });

  it('closes when focus moves outside the picker', () => {
    renderOpenPicker();

    fireEvent.focusIn(screen.getByTestId('scroll-container'));

    expect(
      screen.queryByTestId('team-user-search-input-0')
    ).not.toBeInTheDocument();
  });

  it('closes on a pointer press outside the picker', () => {
    renderOpenPicker();

    fireEvent.pointerDown(document.body);

    expect(
      screen.queryByTestId('team-user-search-input-0')
    ).not.toBeInTheDocument();
  });
});
