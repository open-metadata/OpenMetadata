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

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityReference } from '../../../../generated/entity/type';
import { PersonaSelectableList } from './PersonaSelectableList.component';

const mockGetAllPersonas = jest.fn();
const mockSearchPersonas = jest.fn();

jest.mock('../../../../rest/PersonaAPI', () => ({
  getAllPersonas: (...args: unknown[]) => mockGetAllPersonas(...args),
  searchPersonas: (...args: unknown[]) => mockSearchPersonas(...args),
}));

jest.mock('../../../../utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('../../../../utils/EntityReferenceUtils', () => ({
  getEntityReferenceListFromEntities: (
    entities: Array<Record<string, unknown>>
  ) => entities.map((e) => ({ ...e, type: 'persona' })),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const PERSONAS = [
  {
    id: 'p1',
    name: 'analyst',
    displayName: 'Analyst',
    fullyQualifiedName: 'analyst',
  },
  {
    id: 'p2',
    name: 'steward',
    displayName: 'Steward',
    fullyQualifiedName: 'steward',
  },
];

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const openAndType = async (text: string) => {
  const input = screen.getByRole('combobox');
  await user.clear(input);
  await user.type(input, text);
  // The search is debounced by 300ms.
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
};

describe('PersonaSelectableList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllPersonas.mockResolvedValue({
      data: PERSONAS,
      paging: { total: PERSONAS.length },
    });
    mockSearchPersonas.mockResolvedValue([PERSONAS[0]]);
  });

  it('loads the initial persona page via getAllPersonas', async () => {
    render(
      <PersonaSelectableList
        hasPermission
        selectedPersonas={[]}
        onUpdate={jest.fn()}
      />
    );

    await waitFor(() => expect(mockGetAllPersonas).toHaveBeenCalled());

    expect(mockSearchPersonas).not.toHaveBeenCalled();
  });

  it('searches personas server-side as the user types', async () => {
    render(
      <PersonaSelectableList
        hasPermission
        selectedPersonas={[]}
        onUpdate={jest.fn()}
      />
    );

    await waitFor(() => expect(mockGetAllPersonas).toHaveBeenCalled());

    await user.click(screen.getByTestId('edit-user-persona'));
    await openAndType('ana');

    await waitFor(() =>
      expect(mockSearchPersonas).toHaveBeenCalledWith('ana', 50)
    );
  });

  it('filters a caller-provided personaList locally without hitting the server', async () => {
    render(
      <PersonaSelectableList
        hasPermission
        personaList={PERSONAS as unknown as EntityReference[]}
        selectedPersonas={[]}
        onUpdate={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('edit-user-persona'));
    await openAndType('ana');

    await waitFor(() =>
      expect(
        screen.queryByTestId('persona-option-Steward')
      ).not.toBeInTheDocument()
    );

    expect(screen.getByTestId('persona-option-Analyst')).toBeInTheDocument();
    expect(mockSearchPersonas).not.toHaveBeenCalled();
    expect(mockGetAllPersonas).not.toHaveBeenCalled();
  });

  it('retains a persona selected under a previous query when saving', async () => {
    mockSearchPersonas.mockImplementation((query: string) => {
      const stewMatches = query === 'stew' ? [PERSONAS[1]] : [];

      return Promise.resolve(query === 'ana' ? [PERSONAS[0]] : stewMatches);
    });
    const onUpdate = jest.fn().mockResolvedValue(undefined);

    render(
      <PersonaSelectableList
        hasPermission
        multiSelect
        selectedPersonas={[]}
        onUpdate={onUpdate}
      />
    );

    await user.click(screen.getByTestId('edit-user-persona'));

    await openAndType('ana');
    await user.click(await screen.findByTestId('persona-option-Analyst'));

    // 'analyst' is not in the 'stew' results, yet it must survive the save.
    await openAndType('stew');
    await user.click(await screen.findByTestId('persona-option-Steward'));

    await user.click(screen.getByTestId('user-profile-persona-edit-save'));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith([
        {
          id: 'p1',
          name: 'analyst',
          displayName: 'Analyst',
          fullyQualifiedName: 'analyst',
          type: 'persona',
        },
        {
          id: 'p2',
          name: 'steward',
          displayName: 'Steward',
          fullyQualifiedName: 'steward',
          type: 'persona',
        },
      ])
    );
  });
});
