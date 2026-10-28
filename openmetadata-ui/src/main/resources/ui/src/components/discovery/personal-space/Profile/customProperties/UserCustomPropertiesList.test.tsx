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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { NO_DATA_PLACEHOLDER } from '../../../../../constants/constants';
import { User } from '../../../../../generated/entity/teams/user';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { useUserCustomPropertyAccess } from '../../../../../hooks/discovery/personal-space/useUserCustomPropertyAccess';
import { useEntityTypeCustomProperties } from '../../../../../hooks/useEntityTypeCustomProperties';
import UserCustomPropertiesList from './UserCustomPropertiesList';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

jest.mock(
  '../../../../../hooks/discovery/personal-space/useUserCustomPropertyAccess',
  () => ({
    useUserCustomPropertyAccess: jest.fn(),
  })
);

jest.mock('../../../../../hooks/useEntityTypeCustomProperties', () => ({
  useEntityTypeCustomProperties: jest.fn(),
}));

const PROPERTIES = [
  {
    name: 'employeeId',
    displayName: 'Employee ID',
    description: 'Identifier from the HR system.',
    propertyType: { id: 't1', name: 'string', type: 'type' },
  },
  {
    name: 'notes',
    description: 'Free-form notes.',
    propertyType: { id: 't2', name: 'string', type: 'type' },
  },
] as CustomProperty[];

const USER = {
  id: 'u1',
  name: 'alice',
  email: 'alice@x.io',
  extension: { employeeId: 'E-100', other: 'kept' },
} as User;

const mockAccess = (canView: boolean, canEdit: boolean, isLoading = false) =>
  (useUserCustomPropertyAccess as jest.Mock).mockReturnValue({
    canView,
    canEdit,
    isLoading,
  });

const mockDefinitions = (customProperties: CustomProperty[]) =>
  (useEntityTypeCustomProperties as jest.Mock).mockReturnValue({
    customProperties,
    isLoading: false,
  });

const renderTable = (onUpdate = jest.fn().mockResolvedValue(true)) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <UserCustomPropertiesList user={USER} onUpdate={onUpdate} />
    </QueryClientProvider>
  );

describe('UserCustomPropertiesList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDefinitions(PROPERTIES);
  });

  it('shows the permission placeholder without view permission', () => {
    mockAccess(false, false);

    renderTable();

    expect(
      screen.getByTestId('custom-properties-no-permission')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-properties-list')
    ).not.toBeInTheDocument();
  });

  it('shows the empty state when users have no custom properties', () => {
    mockAccess(true, true);
    mockDefinitions([]);

    renderTable();

    expect(
      screen.getByText('message.no-custom-properties-for-users')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.define-user-custom-properties-hint')
    ).toBeInTheDocument();
  });

  it('renders name, type badge, description, value and an empty-value dash', () => {
    mockAccess(true, false);

    renderTable();

    const employeeRow = screen.getByTestId('custom-property-row-employeeId');

    expect(within(employeeRow).getByText('Employee ID')).toBeInTheDocument();
    expect(
      within(employeeRow).getByText('Identifier from the HR system.')
    ).toBeInTheDocument();
    expect(within(employeeRow).getByText('E-100')).toBeInTheDocument();
    expect(
      within(employeeRow).getByTestId('property-type-badge')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('custom-property-row-notes')).getByTestId(
        'no-value'
      )
    ).toHaveTextContent(NO_DATA_PLACEHOLDER);
  });

  it('hides the edit pencils without edit permission', () => {
    mockAccess(true, false);

    renderTable();

    expect(screen.queryByTestId('edit-employeeId')).not.toBeInTheDocument();
  });

  it('keeps Save disabled until the value changes', () => {
    mockAccess(true, true);

    renderTable();
    fireEvent.click(screen.getByTestId('edit-employeeId'));

    expect(screen.getByTestId('inline-save-btn')).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Employee ID' }), {
      target: { value: 'E-200' },
    });

    expect(screen.getByTestId('inline-save-btn')).toBeEnabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Employee ID' }), {
      target: { value: 'E-100' },
    });

    expect(screen.getByTestId('inline-save-btn')).toBeDisabled();
  });

  it('saves an edited value into the user extension in place', async () => {
    mockAccess(true, true);
    const onUpdate = jest.fn().mockResolvedValue(true);

    renderTable(onUpdate);
    fireEvent.click(screen.getByTestId('edit-employeeId'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Employee ID' }), {
      target: { value: 'E-200' },
    });
    fireEvent.click(screen.getByTestId('inline-save-btn'));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        { extension: { employeeId: 'E-200', other: 'kept' } },
        'extension'
      )
    );
    await waitFor(() =>
      expect(screen.queryByTestId('inline-save-btn')).not.toBeInTheDocument()
    );
  });

  it('keeps the editor open when the save fails', async () => {
    mockAccess(true, true);
    const onUpdate = jest.fn().mockResolvedValue(false);

    renderTable(onUpdate);
    fireEvent.click(screen.getByTestId('edit-employeeId'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Employee ID' }), {
      target: { value: 'E-200' },
    });
    fireEvent.click(screen.getByTestId('inline-save-btn'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());

    expect(screen.getByTestId('inline-save-btn')).toBeInTheDocument();
  });

  it('filters the rows by the search text and says when nothing matches', () => {
    mockAccess(true, false);
    renderTable();

    fireEvent.change(screen.getByTestId('custom-property-search'), {
      target: { value: 'employee' },
    });

    expect(
      screen.getByTestId('custom-property-row-employeeId')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-property-row-notes')
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('custom-property-search'), {
      target: { value: 'nothing-like-this' },
    });

    expect(
      screen.getByTestId('no-matching-custom-properties')
    ).toBeInTheDocument();
  });

  it('waits for the full profile before offering any edit', () => {
    mockAccess(true, true);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <UserCustomPropertiesList
          isProfileLoading
          user={USER}
          onUpdate={jest.fn()}
        />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('custom-properties-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-employeeId')).not.toBeInTheDocument();
  });
});
