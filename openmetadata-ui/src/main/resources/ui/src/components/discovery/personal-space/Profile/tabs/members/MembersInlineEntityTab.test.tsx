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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import MembersInlineEntityTab from './MembersInlineEntityTab';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('../../../../../common/Table/TableV2', () => ({
  __esModule: true,
  default: ({ 'data-testid': testId }: { 'data-testid': string }) => (
    <div data-testid={testId} />
  ),
}));

const baseProps = {
  dataSource: [],
  columns: [],
  canEditAll: true,
  isAdding: false,
  isSavingInline: false,
  items: [],
  selectedNew: [],
  available: [],
  entityLabel: 'Role',
  entityPluralLabel: 'Roles',
  tableTestId: 'team-roles-table',
  addButtonTestId: 'add-role',
  addSelectTestId: 'add-role-select',
  filterOption: undefined,
  onStartAdd: jest.fn(),
  onCancelAdd: jest.fn(),
  onConfirmAdd: jest.fn(),
  onItemInserted: jest.fn(),
  onItemCleared: jest.fn(),
} as unknown as React.ComponentProps<typeof MembersInlineEntityTab>;

describe('MembersInlineEntityTab', () => {
  it('shows the add button (and the table) when editing is allowed and not adding', () => {
    const onStartAdd = jest.fn();
    render(<MembersInlineEntityTab {...baseProps} onStartAdd={onStartAdd} />);

    expect(screen.getByTestId('team-roles-table')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-role'));

    expect(onStartAdd).toHaveBeenCalled();
  });

  it('hides the add button without edit permission', () => {
    render(<MembersInlineEntityTab {...baseProps} canEditAll={false} />);

    expect(screen.queryByTestId('add-role')).not.toBeInTheDocument();
  });

  it('shows the add form with save disabled until a selection is made', () => {
    const { rerender } = render(
      <MembersInlineEntityTab {...baseProps} isAdding />
    );

    expect(screen.getByTestId('add-role-select')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'label.save' })).toBeDisabled();

    rerender(
      <MembersInlineEntityTab {...baseProps} isAdding selectedNew={['r1']} />
    );

    expect(
      screen.getByRole('button', { name: 'label.save' })
    ).not.toBeDisabled();
  });

  it('wires cancel and confirm while adding', () => {
    const onCancelAdd = jest.fn();
    const onConfirmAdd = jest.fn();
    render(
      <MembersInlineEntityTab
        {...baseProps}
        isAdding
        selectedNew={['r1']}
        onCancelAdd={onCancelAdd}
        onConfirmAdd={onConfirmAdd}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    expect(onCancelAdd).toHaveBeenCalled();
    expect(onConfirmAdd).toHaveBeenCalled();
  });
});
