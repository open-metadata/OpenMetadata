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

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let mockIsAdmin: boolean | undefined;

jest.mock('hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: 'harsh' } }),
}));

import { User } from '../../../../../generated/entity/teams/user';
import DefaultPersonaRow from './DefaultPersonaRow';

const defaultPersona = {
  id: 'd1',
  type: 'persona',
  name: 'onboarding',
  displayName: 'Onboarding',
};
const userData: User = {
  id: 'u1',
  name: 'harsh',
  email: 'harsh@example.com',
  defaultPersona,
};

describe('DefaultPersonaRow', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockIsAdmin = false;
  });

  it('renders the default persona chip and its select', async () => {
    render(
      <DefaultPersonaRow updateUserDetails={jest.fn()} userData={userData} />
    );

    expect(screen.getByText('Onboarding')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('default-persona-edit'));

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('lets the user edit their own default persona', () => {
    render(
      <DefaultPersonaRow updateUserDetails={jest.fn()} userData={userData} />
    );

    expect(screen.getByTestId('default-persona-edit')).toBeInTheDocument();
  });

  it('does not display an automatically selected team persona as a saved default', () => {
    render(
      <DefaultPersonaRow
        updateUserDetails={jest.fn()}
        userData={{
          ...userData,
          defaultPersona: { ...defaultPersona, inherited: true },
        }}
      />
    );

    expect(screen.queryByText('Onboarding')).not.toBeInTheDocument();
    expect(screen.getByText('message.no-default-persona')).toBeInTheDocument();
  });

  it('can save the active team persona as an explicit default', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <DefaultPersonaRow
        updateUserDetails={updateUserDetails}
        userData={{
          ...userData,
          defaultPersona: { ...defaultPersona, inherited: true },
        }}
      />
    );

    await userEvent.click(screen.getByTestId('default-persona-edit'));
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(
      await screen.findByRole('option', { name: 'Onboarding' })
    );
    await userEvent.click(screen.getByTestId('default-persona-save'));

    await waitFor(() =>
      expect(updateUserDetails).toHaveBeenCalledWith(
        { defaultPersona: { ...userData.defaultPersona, inherited: false } },
        'defaultPersona'
      )
    );
  });

  it('can clear an explicitly saved default', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(undefined);
    render(
      <DefaultPersonaRow
        updateUserDetails={updateUserDetails}
        userData={userData}
      />
    );

    await userEvent.click(screen.getByTestId('default-persona-edit'));
    await userEvent.click(
      within(screen.getByTestId('autocomplete-selected-item')).getByRole(
        'button'
      )
    );
    await userEvent.click(screen.getByTestId('default-persona-save'));

    await waitFor(() =>
      expect(updateUserDetails).toHaveBeenCalledWith(
        { defaultPersona: undefined },
        'defaultPersona'
      )
    );
  });
});
