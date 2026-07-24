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

jest.mock('antd', () => {
  const antd = jest.requireActual('antd');

  return {
    ...antd,
    // Render the popover content inline so the Select mounts without a click.
    Popover: ({ children, content }: any) => (
      <div>
        {children}
        {content}
      </div>
    ),
    Select: ({ options, onSearch, onChange }: any) => (
      <div>
        <input
          data-testid="persona-search"
          onChange={(e) => onSearch?.(e.target.value)}
        />
        {(options ?? []).map((option: { label: string; value: string }) => (
          <div
            data-testid={`option-${option.value}`}
            key={option.value}
            onClick={() => onChange?.([option.value])}>
            {option.label}
          </div>
        ))}
      </div>
    ),
  };
});

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

    fireEvent.change(screen.getByTestId('persona-search'), {
      target: { value: 'ana' },
    });

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

    fireEvent.change(screen.getByTestId('persona-search'), {
      target: { value: 'ana' },
    });

    await waitFor(() =>
      expect(screen.queryByTestId('option-steward')).not.toBeInTheDocument()
    );

    expect(screen.getByTestId('option-analyst')).toBeInTheDocument();
    expect(mockSearchPersonas).not.toHaveBeenCalled();
    expect(mockGetAllPersonas).not.toHaveBeenCalled();
  });
});
