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
import React from 'react';
import { EntityReference } from '../../../../../../generated/entity/type';
import { getUserById } from '../../../../../../rest/userAPI';
import PersonaUsersTab from './PersonaUsersTab';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/userAPI', () => ({
  getUserById: jest.fn(),
}));

jest.mock('../../../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Trash01: () => <span />,
}));

type Column = { id: string; label: string };

jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');
  const { FormProvider, useFormContext } =
    jest.requireActual('react-hook-form');

  // Picks a fixed user, standing in for the react-aria Autocomplete.
  const FormFields = ({
    fields,
  }: {
    fields: Array<{ name: string; props?: { 'data-testid'?: string } }>;
  }) => {
    const { setValue } = useFormContext();

    return (
      <>
        {fields.map((field) => (
          <button
            data-testid={field.props?.['data-testid']}
            key={field.name}
            type="button"
            onClick={() =>
              setValue(field.name, [
                {
                  id: 'u1',
                  label: 'alice',
                  value: { id: 'u1', name: 'alice', type: 'user' },
                },
                {
                  id: 'u3',
                  label: 'carol',
                  value: { id: 'u3', name: 'carol', type: 'user' },
                },
              ])
            }>
            pick
          </button>
        ))}
      </>
    );
  };

  const Table = Object.assign(
    ({
      children,
      'data-testid': testId,
    }: React.PropsWithChildren<{ 'data-testid'?: string }>) => (
      <table data-testid={testId}>{children}</table>
    ),
    {
      Body: <T,>({
        children,
        items,
        renderEmptyState,
      }: {
        children: (item: T) => React.ReactNode;
        items: T[];
        renderEmptyState: () => React.ReactNode;
      }) => (
        <tbody>
          {items.length ? (
            items.map(children)
          ) : (
            <tr>
              <td>{renderEmptyState()}</td>
            </tr>
          )}
        </tbody>
      ),
      Cell: ({ children }: React.PropsWithChildren) => <td>{children}</td>,
      Head: ({ label }: { label: string }) => <th>{label}</th>,
      Header: ({
        children,
        columns,
      }: {
        children: (col: Column) => React.ReactNode;
        columns: Column[];
      }) => (
        <thead>
          <tr>{columns.map(children)}</tr>
        </thead>
      ),
      Row: ({
        children,
        columns,
      }: {
        children: (col: Column) => React.ReactNode;
        columns: Column[];
      }) => <tr>{columns.map(children)}</tr>,
    }
  );

  return {
    ...actual,
    Box: ({
      children,
      'data-testid': testId,
    }: React.PropsWithChildren<{ 'data-testid'?: string }>) => (
      <div data-testid={testId}>{children}</div>
    ),
    Button: ({
      children,
      'data-testid': testId,
      isDisabled,
      onPress,
    }: React.PropsWithChildren<{
      'data-testid'?: string;
      isDisabled?: boolean;
      onPress?: () => void;
    }>) => (
      <button
        data-testid={testId}
        disabled={isDisabled}
        type="button"
        onClick={onPress}>
        {children}
      </button>
    ),
    ButtonUtility: ({
      'data-testid': testId,
      isDisabled,
      onPress,
    }: {
      'data-testid'?: string;
      isDisabled?: boolean;
      onPress?: () => void;
    }) => (
      <button
        aria-label={testId}
        data-testid={testId}
        disabled={isDisabled}
        type="button"
        onClick={onPress}
      />
    ),
    EmptyPlaceholder: ({ title }: { title: string }) => (
      <div data-testid="empty-placeholder">{title}</div>
    ),
    FormFields,
    HookForm: ({
      children,
      form,
    }: React.PropsWithChildren<{ form: Record<string, unknown> }>) => (
      <FormProvider {...form}>{children}</FormProvider>
    ),
    Skeleton: () => <div data-testid="skeleton" />,
    Table,
    TableCard: {
      Root: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    },
    Typography: ({
      children,
      'data-testid': testId,
    }: React.PropsWithChildren<{ 'data-testid'?: string }>) => (
      <span data-testid={testId}>{children}</span>
    ),
  };
});

const USERS: EntityReference[] = [
  { id: 'u1', name: 'alice', type: 'user' },
  { id: 'u2', name: 'bob', type: 'user' },
];

const USER_DETAILS = {
  u1: {
    id: 'u1',
    name: 'alice',
    displayName: 'Alice',
    teams: [{ id: 't1', name: 'Data', type: 'team' }],
    roles: [
      { id: 'r1', name: 'DataSteward', type: 'role' },
      { id: 'r2', name: 'DataConsumer', type: 'role' },
    ],
  },
  u2: { id: 'u2', name: 'bob', teams: [], roles: [] },
} as Record<string, unknown>;

const mockOnUsersChange = jest.fn();

const renderTab = (
  props: Partial<React.ComponentProps<typeof PersonaUsersTab>> = {}
) =>
  render(
    <PersonaUsersTab
      canEdit
      users={USERS}
      onUsersChange={mockOnUsersChange}
      {...props}
    />
  );

describe('PersonaUsersTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUserById as jest.Mock).mockImplementation(
      async (id: string) => USER_DETAILS[id]
    );
  });

  it('fetches each user with teams and roles and renders a row per user', async () => {
    renderTab();

    expect(screen.getAllByTestId('skeleton')).toHaveLength(2);

    const names = await screen.findAllByTestId('persona-user-name');

    expect(names.map((n) => n.textContent)).toEqual(['Alice', 'bob']);
    expect(getUserById).toHaveBeenCalledWith('u1', {
      fields: ['teams', 'roles'],
    });
    expect(getUserById).toHaveBeenCalledWith('u2', {
      fields: ['teams', 'roles'],
    });
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('DataSteward, DataConsumer')).toBeInTheDocument();
    expect(screen.getAllByText('--')).toHaveLength(2);
  });

  it('skips users whose details fail to load', async () => {
    (getUserById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'u2') {
        throw new Error('gone');
      }

      return USER_DETAILS[id];
    });
    renderTab();

    await waitFor(() =>
      expect(screen.getAllByTestId('persona-user-name')).toHaveLength(1)
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('bob')).not.toBeInTheDocument();
  });

  it('shows an empty state when the persona has no users', async () => {
    renderTab({ users: [] });

    expect(await screen.findByTestId('empty-placeholder')).toHaveTextContent(
      'label.no-entity-found'
    );
    expect(getUserById).not.toHaveBeenCalled();
  });

  it('removes a user from the persona', async () => {
    renderTab();

    fireEvent.click(await screen.findByTestId('remove-user-Alice'));

    expect(mockOnUsersChange).toHaveBeenCalledWith([USERS[1]]);
  });

  it('disables removal and hides add without edit permission', async () => {
    renderTab({ canEdit: false });

    expect(await screen.findByTestId('remove-user-Alice')).toBeDisabled();
    expect(screen.queryByTestId('add-persona-user')).not.toBeInTheDocument();
  });

  it('adds picked users without duplicating existing ones', async () => {
    renderTab();
    await screen.findAllByTestId('persona-user-name');

    fireEvent.click(screen.getByTestId('add-persona-user'));

    expect(screen.queryByTestId('add-persona-user')).not.toBeInTheDocument();
    expect(screen.getByTestId('save-persona-users')).toBeDisabled();

    fireEvent.click(screen.getByTestId('add-persona-users-select'));

    const save = screen.getByTestId('save-persona-users');

    await waitFor(() => expect(save).toBeEnabled());

    fireEvent.click(save);

    expect(mockOnUsersChange).toHaveBeenCalledWith([
      USERS[0],
      USERS[1],
      { id: 'u3', name: 'carol', type: 'user' },
    ]);
    expect(screen.queryByTestId('save-persona-users')).not.toBeInTheDocument();
    expect(screen.getByTestId('add-persona-user')).toBeInTheDocument();
  });

  it('discards picked users on cancel', async () => {
    renderTab();
    await screen.findAllByTestId('persona-user-name');

    fireEvent.click(screen.getByTestId('add-persona-user'));
    fireEvent.click(screen.getByTestId('add-persona-users-select'));
    fireEvent.click(screen.getByText('label.cancel'));

    expect(screen.queryByTestId('save-persona-users')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-persona-user'));

    expect(screen.getByTestId('save-persona-users')).toBeDisabled();
    expect(mockOnUsersChange).not.toHaveBeenCalled();
  });
});
