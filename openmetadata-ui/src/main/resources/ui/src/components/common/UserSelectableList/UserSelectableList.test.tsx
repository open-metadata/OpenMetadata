/*
 *  Copyright 2023 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UserSelectableList } from './UserSelectableList.component';

const mockOnUpdate = jest.fn();

jest.mock('../../../rest/userAPI', () => ({
  getUsers: jest.fn().mockResolvedValue({ data: [], paging: { total: 5 } }),
}));

jest.mock('../../../rest/miscAPI', () => ({
  searchData: jest.fn().mockResolvedValue({ data: [], paging: { total: 5 } }),
}));

jest.mock('../SelectableList/SelectableList.component', () => ({
  SelectableList: jest.fn().mockReturnValue(<div>selectable-list</div>),
}));

describe('UserSelectableList Component Test', () => {
  it('should render disabled button if no permission', () => {
    render(
      <UserSelectableList
        hasPermission={false}
        selectedUsers={[]}
        onUpdate={mockOnUpdate}
      />
    );

    act(() => {
      expect(screen.getByTestId('add-user')).toBeDisabled();
    });
  });

  it('should render enabled button if has permission', () => {
    render(
      <UserSelectableList
        hasPermission
        selectedUsers={[]}
        onUpdate={mockOnUpdate}
      />
    );

    act(() => {
      expect(screen.getByTestId('add-user')).toBeEnabled();
    });
  });

  it('should render selectablelist if click on add-user', () => {
    render(
      <UserSelectableList
        hasPermission
        selectedUsers={[]}
        onUpdate={mockOnUpdate}
      />
    );

    act(() => {
      fireEvent.click(screen.getByTestId('add-user'));
    });

    expect(screen.getByText('selectable-list')).toBeInTheDocument();
  });
});
