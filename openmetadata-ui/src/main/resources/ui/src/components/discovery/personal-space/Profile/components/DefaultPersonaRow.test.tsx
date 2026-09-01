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

import { act, render, screen } from '@testing-library/react';

let mockIsAdmin: boolean | undefined;

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

jest.mock('@openmetadata/ui-core-components', () => ({
  Autocomplete: ({ 'data-testid': testId }: { 'data-testid'?: string }) => (
    <div data-testid={testId} />
  ),
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

jest.mock('./InlineEditCard', () => ({
  __esModule: true,
  default: ({
    view,
    renderEdit,
    canEdit,
  }: {
    view?: ReactNode;
    renderEdit: (ctx: { cancel: () => void; save: () => void }) => ReactNode;
    canEdit?: boolean;
  }) => (
    <div>
      <span data-testid="can-edit">{String(canEdit)}</span>
      {view}
      {renderEdit({ cancel: jest.fn(), save: jest.fn() })}
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { User } from 'generated/entity/teams/user';
import DefaultPersonaRow from './DefaultPersonaRow';

const userData = {
  name: 'harsh',
  defaultPersona: { id: 'd1', name: 'onboarding', displayName: 'Onboarding' },
} as unknown as User;

describe('DefaultPersonaRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = false;
  });

  it('renders the default persona chip and its select', async () => {
    await act(async () => {
      render(
        <DefaultPersonaRow updateUserDetails={jest.fn()} userData={userData} />
      );
    });

    expect(screen.getByTestId('chip-label.default-persona')).toHaveTextContent(
      'Onboarding'
    );
    expect(screen.getByTestId('default-persona-select')).toBeInTheDocument();
  });

  it('lets the user edit their own default persona', async () => {
    await act(async () => {
      render(
        <DefaultPersonaRow updateUserDetails={jest.fn()} userData={userData} />
      );
    });

    expect(screen.getByTestId('can-edit')).toHaveTextContent('true');
  });
});
