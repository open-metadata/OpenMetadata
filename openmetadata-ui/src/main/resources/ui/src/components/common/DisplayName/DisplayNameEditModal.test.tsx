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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  highlightSearchText,
  renderHighlightedText,
} from '../../../utils/EntitySearchUtils';
import DisplayName from './DisplayName';
import { DisplayNameProps } from './DisplayName.interface';

// This suite deliberately renders the REAL `EntityNameModal` (no mock) so the
// full edit-displayName save flow — `DisplayName` -> `EntityNameModal` form ->
// `onSave` -> `DisplayName.handleDisplayNameUpdate` -> `onEditDisplayName` —
// is exercised end-to-end. The co-located `DisplayName.test.tsx` mocks the
// modal wholesale (it only asserts on the contract), which is exactly why
// commit 7afecdd59c ("feat: highlight search text functionality (#19405)")
// went undetected: no test ever seeded the modal with a highlighted ReactNode
// `name` and clicked Save.
//
// `react-router-dom`'s `Link` is still mocked so the component renders under
// jsdom without a router.

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(({ children, ...props }) => (
    <a href="#" {...props}>
      {children}
    </a>
  )),
}));

jest.mock('../../../constants/constants', () => ({
  DE_ACTIVE_COLOR: '#BFBFBF',
  ICON_DIMENSION: { width: 16, height: 16 },
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest
    .fn()
    .mockImplementation((_entityType, fqn) => `/entity/${fqn}`),
}));

const mockOnEditDisplayName = jest.fn().mockResolvedValue(undefined);

const baseProps: DisplayNameProps = {
  id: '1',
  displayName: 'Existing Display',
  link: '/entity/1',
  hasEditPermission: true,
  onEditDisplayName: mockOnEditDisplayName,
};

const openEditModal = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('edit-displayName-button'));
  });

  return screen.findByTestId('entity-name-modal');
};

const getNameInput = () => screen.getByTestId('name') as HTMLInputElement;

const getDisplayNameInput = () =>
  screen.getByTestId('displayName') as HTMLInputElement;

describe('DisplayName edit-displayName save flow (real EntityNameModal)', () => {
  beforeEach(() => {
    mockOnEditDisplayName.mockClear();
  });

  it('seeds the modal Name from a plain-string `name` and invokes onEditDisplayName on Save', async () => {
    render(
      <MemoryRouter>
        <DisplayName {...baseProps} name="UserDatabase" />
      </MemoryRouter>
    );

    await openEditModal();

    // Name field is seeded from the plain string; with `allowRename` unset
    // the input is also disabled — but `value` must still be present.
    expect(getNameInput().value).toBe('UserDatabase');
    // The Name input is disabled (no `allowRename`), per `EntityNameModal` contract.
    expect(getNameInput()).toBeDisabled();

    await act(async () => {
      fireEvent.change(getDisplayNameInput(), {
        target: { value: 'User DB Display' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    await waitFor(() => expect(mockOnEditDisplayName).toHaveBeenCalledTimes(1));

    expect(mockOnEditDisplayName).toHaveBeenCalledWith(
      { name: 'UserDatabase', displayName: 'User DB Display' },
      '1'
    );
  });

  it('seeds the modal Name from `entityName` when `name` is a highlighted ReactNode and Save invokes onEditDisplayName (the bug case fixed)', async () => {
    // Reproduce exactly what `DatabaseSchemaTable` / `SchemaTablesTab` /
    // `ServiceMainTabContentUtils` pass under search highlighting — a
    // highlighted ReactNode for `name` and the raw `record.name` as
    // `entityName`.
    const highlightedName: ReactNode = renderHighlightedText(
      highlightSearchText('UserDatabase', 'data')
    );

    // Sanity check: `name` here is genuinely a ReactElement (i.e. the bug's
    // precondition), not a plain string — otherwise `isString(name)` would
    // simply return true and the test wouldn't be exercising the bug.
    expect(typeof highlightedName).not.toBe('string');

    render(
      <MemoryRouter>
        <DisplayName
          {...baseProps}
          entityName="UserDatabase"
          name={highlightedName}
        />
      </MemoryRouter>
    );

    await openEditModal();

    expect(getNameInput().value).toBe('UserDatabase');
    expect(getNameInput()).toBeDisabled();

    await act(async () => {
      fireEvent.change(getDisplayNameInput(), {
        target: { value: 'User DB Display' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    await waitFor(() => expect(mockOnEditDisplayName).toHaveBeenCalledTimes(1));

    expect(mockOnEditDisplayName).toHaveBeenCalledWith(
      { name: 'UserDatabase', displayName: 'User DB Display' },
      '1'
    );
  });

  it('keeps the existing display name when both `name` and `displayName` are highlighted and Save is clicked without edits', async () => {
    render(
      <MemoryRouter>
        <DisplayName
          {...baseProps}
          displayName={renderHighlightedText(
            highlightSearchText('User Database', 'user')
          )}
          entityDisplayName="User Database"
          entityName="UserDatabase"
          name={renderHighlightedText(
            highlightSearchText('UserDatabase', 'user')
          )}
        />
      </MemoryRouter>
    );

    await openEditModal();

    expect(getDisplayNameInput().value).toBe('User Database');

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    await waitFor(() => expect(mockOnEditDisplayName).toHaveBeenCalledTimes(1));

    expect(mockOnEditDisplayName).toHaveBeenCalledWith(
      { name: 'UserDatabase', displayName: 'User Database' },
      '1'
    );
  });

  it('blocks Save with a "Name is required" error when `name` is a highlighted ReactNode and no `entityName` is supplied (regression guard for the original bug)', async () => {
    const highlightedName: ReactNode = renderHighlightedText(
      highlightSearchText('UserDatabase', 'data')
    );

    render(
      <MemoryRouter>
        <DisplayName {...baseProps} name={highlightedName} />
      </MemoryRouter>
    );

    await openEditModal();

    // The legacy `isString(name) ? name : ''` fallback still seeds '' when no
    // raw `entityName` is provided — this preserves un-migrated callers'
    // behavior. The required Name field is empty and disabled, so Save is
    // blocked exactly as the bug described.
    expect(getNameInput().value).toBe('');
    expect(getNameInput()).toBeDisabled();

    await act(async () => {
      fireEvent.change(getDisplayNameInput(), {
        target: { value: 'User DB Display' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    // react-i18next is mocked globally to return the key verbatim, so the
    // "Name is required" message renders as `label.field-required` with the
    // `field` placeholder substituted (see setupTests.js).
    await waitFor(() => {
      expect(screen.getByText(/label\.field-required/)).toBeInTheDocument();
    });

    expect(mockOnEditDisplayName).not.toHaveBeenCalled();
  });
});
