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

let mockIsAdmin: boolean | undefined;

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  debounce: (fn: (...args: unknown[]) => unknown) =>
    Object.assign(fn, { cancel: jest.fn() }),
}));

jest.mock('../../../../../rest/rolesAPIV1', () => ({
  searchRoles: jest.fn().mockResolvedValue([]),
}));

jest.mock('constants/constants', () => ({
  TERM_ADMIN: 'Admin',
}));

jest.mock('hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: (ref: { name?: string }) => ref?.name ?? '',
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('antd', () => ({ Select: () => <div /> }));

jest.mock('./ChipBadgeList', () => ({
  __esModule: true,
  default: ({ values }: { values: unknown[] }) => (
    <div data-testid="chip-list">{values.length}</div>
  ),
}));

jest.mock('./InlineEditCard', () => ({
  __esModule: true,
  default: ({
    view,
    renderEdit,
    canEdit,
    onSave,
  }: {
    view?: ReactNode;
    renderEdit?: () => ReactNode;
    canEdit?: boolean;
    onSave?: () => void;
  }) => (
    <div>
      <span data-testid="can-edit">{String(canEdit)}</span>
      {view}
      {renderEdit?.()}
      <button data-testid="save" type="button" onClick={onSave}>
        save
      </button>
    </div>
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Autocomplete: Object.assign(
    ({
      onItemInserted,
      onSearchChange,
    }: {
      onItemInserted: (...args: unknown[]) => void;
      onSearchChange?: (...args: unknown[]) => void;
    }) => (
      <>
        <button
          data-testid="add-role"
          type="button"
          onClick={() => onItemInserted('r2')}>
          add
        </button>
        <input
          aria-label="roles-search-input"
          data-testid="roles-search-input"
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </>
    ),
    { Item: ({ children }: { children?: ReactNode }) => <div>{children}</div> }
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { User } from '../../../../../generated/entity/teams/user';
import { searchRoles } from '../../../../../rest/rolesAPIV1';
import RolesRow from './RolesRow';

const mockSearchRoles = searchRoles as jest.Mock;

describe('RolesRow', () => {
  beforeEach(() => {
    mockIsAdmin = true;
  });

  it('renders the roles chips and is editable for admins', async () => {
    await act(async () => {
      render(
        <RolesRow
          updateUserDetails={jest.fn()}
          userData={
            {
              name: 'harsh',
              roles: [{ id: 'r', name: 'DataSteward' }],
              inheritedRoles: [],
              isAdmin: false,
            } as unknown as User
          }
        />
      );
    });

    expect(screen.getByTestId('can-edit')).toHaveTextContent('true');
  });

  it('retains the existing role ref and appends only the newly-added one', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(undefined);

    await act(async () => {
      render(
        <RolesRow
          updateUserDetails={updateUserDetails}
          userData={
            {
              name: 'harsh',
              roles: [{ id: 'r', name: 'DataSteward' }],
              inheritedRoles: [],
              isAdmin: false,
            } as unknown as User
          }
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-role'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save'));
    });

    await waitFor(() =>
      expect(updateUserDetails).toHaveBeenCalledWith(
        {
          roles: [
            { id: 'r', name: 'DataSteward' },
            { id: 'r2', type: 'role' },
          ],
          isAdmin: false,
        },
        'roles'
      )
    );
  });

  it('calls the roles search API with the typed query', async () => {
    await act(async () => {
      render(
        <RolesRow
          updateUserDetails={jest.fn()}
          userData={
            {
              name: 'harsh',
              roles: [],
              inheritedRoles: [],
              isAdmin: false,
            } as unknown as User
          }
        />
      );
    });

    mockSearchRoles.mockClear();

    await act(async () => {
      fireEvent.change(screen.getByTestId('roles-search-input'), {
        target: { value: 'kjqhs' },
      });
    });

    await waitFor(() =>
      expect(mockSearchRoles).toHaveBeenCalledWith('kjqhs', 50)
    );
  });
});
