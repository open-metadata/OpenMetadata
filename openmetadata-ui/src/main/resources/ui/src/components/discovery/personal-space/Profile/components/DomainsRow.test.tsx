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

jest.mock('hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

jest.mock('./ChipView', () => ({
  __esModule: true,
  default: ({
    label,
    values,
  }: {
    label?: string;
    values: { name?: string; displayName?: string }[];
  }) => <div data-testid={`chip-${label}`}>{values.length}</div>,
}));

jest.mock('./InlineEditCard', () => ({
  __esModule: true,
  default: ({
    view,
    renderEdit,
    canEdit,
    onSave,
    isSaveDisabled,
  }: {
    view?: ReactNode;
    renderEdit?: () => ReactNode;
    canEdit?: boolean;
    onSave?: () => void;
    isSaveDisabled?: boolean;
  }) => (
    <div>
      <span data-testid="can-edit">{String(canEdit)}</span>
      {view}
      {renderEdit?.()}
      <button
        data-testid="save"
        disabled={isSaveDisabled}
        type="button"
        onClick={onSave}>
        save
      </button>
    </div>
  ),
}));

jest.mock('../../../../common/DomainSelect/DomainSelect', () => ({
  __esModule: true,
  default: ({
    selectedDomain,
    onUpdate,
  }: {
    selectedDomain: { id: string }[];
    onUpdate: (domains: { id: string; name: string }[]) => void;
  }) => (
    <button
      data-testid="add-domain"
      type="button"
      onClick={() =>
        onUpdate([
          ...(selectedDomain as { id: string; name: string }[]),
          { id: 'd2', name: 'marketing' },
        ])
      }>
      add
    </button>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { User } from '../../../../../generated/entity/teams/user';
import DomainsRow from './DomainsRow';

describe('DomainsRow', () => {
  beforeEach(() => {
    mockIsAdmin = true;
  });

  it('renders the domains chip and is editable for admins', async () => {
    await act(async () => {
      render(
        <DomainsRow
          updateUserDetails={jest.fn()}
          userData={
            {
              name: 'harsh',
              domains: [{ id: 'd', name: 'sales' }],
            } as unknown as User
          }
        />
      );
    });

    expect(screen.getByTestId('chip-label.domain-plural')).toHaveTextContent(
      '1'
    );
    expect(screen.getByTestId('can-edit')).toHaveTextContent('true');
  });

  it('retains the existing domain ref and appends only the newly-added one', async () => {
    const updateUserDetails = jest.fn().mockResolvedValue(undefined);

    await act(async () => {
      render(
        <DomainsRow
          updateUserDetails={updateUserDetails}
          userData={
            {
              name: 'harsh',
              domains: [{ id: 'd', name: 'sales' }],
            } as unknown as User
          }
        />
      );
    });

    expect(screen.getByTestId('save')).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-domain'));
    });

    expect(screen.getByTestId('save')).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('save'));
    });

    await waitFor(() =>
      expect(updateUserDetails).toHaveBeenCalledWith(
        {
          domains: [
            { id: 'd', name: 'sales' },
            { id: 'd2', type: 'domain' },
          ],
        },
        'domains'
      )
    );
  });
});
