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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';

const mockSearchPersonas = jest.fn();
const mockShowErrorToast = jest.fn();
let mockIsAdmin: boolean | undefined;

jest.mock('rest/PersonaAPI', () => ({
  searchPersonas: (...a: unknown[]) => mockSearchPersonas(...a),
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: (...a: unknown[]) => mockShowErrorToast(...a),
}));

jest.mock('hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: 'harsh' } }),
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

jest.mock('./ChipView', () => ({
  __esModule: true,
  default: ({
    label,
    values,
  }: {
    label?: string;
    values: { name?: string; displayName?: string }[];
  }) => (
    <div data-testid={`chip-${label}`}>
      {values.map((v) => v.displayName ?? v.name).join(',')}
    </div>
  ),
}));

jest.mock('./InlineEditCard', () => {
  const ReactModule = require('react');

  const MockInlineEditCard = ({
    view,
    renderEdit,
    canEdit,
    onSave,
    onEnterEdit,
  }: {
    view?: ReactNode;
    renderEdit?: () => ReactNode;
    canEdit?: boolean;
    onSave?: () => void;
    onEnterEdit?: () => void;
  }) => {
    // The mock renders the edit control immediately, so trigger the row's
    // enter-edit hook (which lazily loads the persona options) on mount.
    ReactModule.useEffect(() => {
      onEnterEdit?.();
    }, [onEnterEdit]);

    return (
      <div>
        <span data-testid="can-edit">{String(canEdit)}</span>
        {view}
        {renderEdit?.()}
        <button data-testid="save" onClick={onSave}>
          save
        </button>
      </div>
    );
  };

  return { __esModule: true, default: MockInlineEditCard };
});

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Autocomplete: Object.assign(
    ({
      onItemInserted,
      onSearchChange,
    }: {
      onItemInserted?: (...args: never[]) => void;
      onSearchChange?: (...args: never[]) => void;
    }) => (
      <div>
        <button
          data-testid="add-persona"
          type="button"
          onClick={() => onItemInserted('p2')}>
          add
        </button>
        <button
          data-testid="search-persona"
          type="button"
          onClick={() => onSearchChange?.('analyst')}>
          search
        </button>
      </div>
    ),
    { Item: ({ children }: { children?: ReactNode }) => <div>{children}</div> }
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { User } from 'generated/entity/teams/user';
import PersonaRow from './PersonaRow';

const userData = {
  name: 'harsh',
  personas: [{ id: 'p1', name: 'data-steward', displayName: 'Data Steward' }],
  defaultPersona: { id: 'd1', name: 'onboarding', displayName: 'Onboarding' },
} as unknown as User;

describe('PersonaRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = false;
    mockSearchPersonas.mockResolvedValue([
      { id: 'p1', name: 'data-steward', displayName: 'Data Steward' },
      { id: 'd1', name: 'onboarding', displayName: 'Onboarding' },
      {
        id: 'p2',
        name: 'analyst',
        displayName: 'Analyst',
        fullyQualifiedName: 'analyst',
      },
    ]);
  });

  it('searches personas on mount and renders the assigned persona chips', async () => {
    await act(async () => {
      render(<PersonaRow updateUserDetails={jest.fn()} userData={userData} />);
    });

    expect(mockSearchPersonas).toHaveBeenCalledWith('', 50);
    expect(screen.getByTestId('chip-label.persona')).toHaveTextContent(
      'Data Steward'
    );
  });

  it('searches server-side as the user types', async () => {
    await act(async () => {
      render(<PersonaRow updateUserDetails={jest.fn()} userData={userData} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('search-persona'));
    });

    await waitFor(() =>
      expect(mockSearchPersonas).toHaveBeenCalledWith('analyst', 50)
    );
  });

  it('shows an error toast when loading the persona options fails', async () => {
    mockSearchPersonas.mockRejectedValue(new Error('boom'));

    await act(async () => {
      render(<PersonaRow updateUserDetails={jest.fn()} userData={userData} />);
    });

    // onEnterEdit → fetchPersonas rejects → caught and surfaced as a toast, not an
    // unhandled promise rejection.
    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
  });

  it('is admin-managed: editable for admins, locked for non-admins', async () => {
    await act(async () => {
      render(<PersonaRow updateUserDetails={jest.fn()} userData={userData} />);
    });

    // Non-admin (beforeEach default) cannot edit persona assignment.
    expect(screen.getByTestId('can-edit')).toHaveTextContent('false');

    mockIsAdmin = true;
    await act(async () => {
      render(<PersonaRow updateUserDetails={jest.fn()} userData={userData} />);
    });

    expect(screen.getAllByTestId('can-edit')[1]).toHaveTextContent('true');
  });

  it('persists only the existing personas when nothing changed', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(undefined);

    await act(async () => {
      render(
        <PersonaRow updateUserDetails={updateUserDetails} userData={userData} />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save'));
    });

    await waitFor(() =>
      expect(updateUserDetails).toHaveBeenCalledWith(
        {
          personas: [
            { id: 'p1', name: 'data-steward', displayName: 'Data Steward' },
          ],
        },
        'personas'
      )
    );
  });

  it('sends the full selected persona refs (with name/FQN) on save', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(undefined);

    await act(async () => {
      render(
        <PersonaRow updateUserDetails={updateUserDetails} userData={userData} />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-persona'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save'));
    });

    // Newly-added persona ships its full ref from the pool (name + FQN) — a bare
    // {id, type} 500s the backend, which sorts personas by name.
    await waitFor(() =>
      expect(updateUserDetails).toHaveBeenCalledWith(
        {
          personas: [
            { id: 'p1', name: 'data-steward', displayName: 'Data Steward' },
            {
              id: 'p2',
              type: 'persona',
              name: 'analyst',
              displayName: 'Analyst',
              fullyQualifiedName: 'analyst',
            },
          ],
        },
        'personas'
      )
    );
  });
});
