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
import { User } from '../../../../../generated/entity/teams/user';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { useEntityTypeCustomProperties } from '../../../../../hooks/useEntityTypeCustomProperties';
import { getAllCustomProperties } from '../../../../../rest/metadataTypeAPI';
import { useUserCustomPropertyAccess } from './useUserCustomPropertyAccess';
import UserCustomPropertiesTable from './UserCustomPropertiesTable';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

jest.mock('./useUserCustomPropertyAccess', () => ({
  useUserCustomPropertyAccess: jest.fn(),
}));

jest.mock('../../../../../hooks/useEntityTypeCustomProperties', () => ({
  useEntityTypeCustomProperties: jest.fn(),
}));

jest.mock('../../../../../rest/metadataTypeAPI', () => ({
  getAllCustomProperties: jest.fn(),
}));

jest.mock(
  '../../../../common/CustomPropertyTable/CustomPropertyCard/CustomPropertyEditModal',
  () => ({
    CustomPropertyEditModal: ({
      property,
      onSave,
    }: {
      property: CustomProperty;
      onSave: (value: unknown) => void;
    }) => (
      <button
        data-testid="custom-property-edit-modal"
        onClick={() => onSave('E-200')}>
        {property.name}
      </button>
    ),
  })
);

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

const renderTable = (onUpdate = jest.fn().mockResolvedValue(undefined)) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <UserCustomPropertiesTable user={USER} onUpdate={onUpdate} />
    </QueryClientProvider>
  );

describe('UserCustomPropertiesTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAllCustomProperties as jest.Mock).mockResolvedValue({
      table: [{ name: 'notes', type: 'string' }],
      user: [
        { name: 'employeeId', type: 'string' },
        { name: 'notes', type: 'string' },
      ],
      dashboard: [{ name: 'notes', type: 'string' }],
      pipeline: [{ name: 'notes', type: 'string' }],
      team: [{ name: 'other', type: 'string' }],
    });
    mockDefinitions(PROPERTIES);
  });

  it('shows the permission placeholder without view permission', () => {
    mockAccess(false, false);

    renderTable();

    expect(
      screen.getByTestId('user-custom-properties-no-permission')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('user-custom-properties-table')
    ).not.toBeInTheDocument();
    expect(getAllCustomProperties).not.toHaveBeenCalled();
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

  it('renders name, description, type, value and an empty-value dash', () => {
    mockAccess(true, false);

    renderTable();

    expect(
      screen.getByText('message.properties-defined-for-every-user')
    ).toBeInTheDocument();

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
    ).toHaveTextContent('—');
  });

  it('lists the entity types sharing the property name, user first, max 3 then +N', async () => {
    mockAccess(true, false);

    renderTable();

    const entityTypesOf = (name: string) =>
      within(screen.getByTestId(`custom-property-row-${name}`)).getByTestId(
        'property-entity-types'
      ).textContent;

    await waitFor(() =>
      expect(entityTypesOf('notes')).toBe(
        'UserDashboardPipelinelabel.plus-count:1'
      )
    );

    expect(entityTypesOf('employeeId')).toBe('User');
  });

  it('hides the edit pencils without edit permission', () => {
    mockAccess(true, false);

    renderTable();

    expect(screen.queryByTestId('edit-employeeId')).not.toBeInTheDocument();
  });

  it('saves an edited value into the user extension', async () => {
    mockAccess(true, true);
    const onUpdate = jest.fn().mockResolvedValue(undefined);

    renderTable(onUpdate);
    fireEvent.click(screen.getByTestId('edit-employeeId'));
    fireEvent.click(screen.getByTestId('custom-property-edit-modal'));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        { extension: { employeeId: 'E-200', other: 'kept' } },
        'extension'
      )
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId('custom-property-edit-modal')
      ).not.toBeInTheDocument()
    );
  });
});
