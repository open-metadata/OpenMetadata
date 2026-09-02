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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../../../enums/entity.enum';
import { User } from '../../../../../generated/entity/teams/user';
import PersonaRow from './PersonaRow';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
}));

jest.mock('../../../../../rest/PersonaAPI', () => ({
  searchPersonas: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

// The Autocomplete's own behaviour is not under test here — the draft state
// that feeds it is. Rendering the selected labels keeps the assertion readable.
jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return {
    ...actual,
    Autocomplete: ({
      selectedItems,
    }: {
      selectedItems: { id: string; label: string }[];
    }) => (
      <div data-testid="persona-multiselect">
        {selectedItems.map((item) => (
          <span data-testid={`draft-${item.id}`} key={item.id}>
            {item.label}
          </span>
        ))}
      </div>
    ),
  };
});

const PERSONA = {
  id: 'persona-1',
  type: EntityType.PERSONA,
  name: 'data-engineer',
  displayName: 'Data Engineer',
};

const userWithoutPersonas = { id: 'user-1', name: 'john' } as User;
const userWithPersonas = {
  ...userWithoutPersonas,
  personas: [PERSONA],
} as User;

describe('PersonaRow', () => {
  it('should save the personas the row is displaying when they arrive after mount', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(undefined);

    // ProfilePage seeds userData from the application store, which carries no
    // personas; getUserByName backfills them a moment later. The draft is
    // seeded at mount, so without a re-seed on entering edit mode the row would
    // save the empty set it captured and silently drop every persona.
    const { rerender } = render(
      <PersonaRow
        updateUserDetails={updateUserDetails}
        userData={userWithoutPersonas}
      />
    );

    rerender(
      <PersonaRow
        updateUserDetails={updateUserDetails}
        userData={userWithPersonas}
      />
    );

    fireEvent.click(screen.getByTestId('persona-edit'));

    expect(screen.getByTestId(`draft-${PERSONA.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('persona-save'));

    await waitFor(() =>
      expect(updateUserDetails).toHaveBeenCalledWith(
        { personas: [PERSONA] },
        'personas'
      )
    );
  });
});
