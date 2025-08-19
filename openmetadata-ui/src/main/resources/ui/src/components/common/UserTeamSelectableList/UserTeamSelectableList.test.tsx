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
import { render, screen } from '@testing-library/react';
import { Popover } from '../AntdCompat';;
import { UserTeamSelectableList } from './UserTeamSelectableList.component';

const mockOnUpdate = jest.fn();

jest.mock('../SelectableList/SelectableList.component', () => {
  return {
    SelectableList: jest.fn().mockReturnValue(<div>SelectableList</div>),
  };
});

jest.mock('../../../utils/CommonUtils', () => {
  return {
    getCountBadge: jest.fn().mockReturnValue(<div>CountBadge</div>),
  };
});

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('getEntityName'),
  getEntityReferenceListFromEntities: jest.fn().mockReturnValue([]),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Popover: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../IconButtons/EditIconButton', () => ({
  EditIconButton: jest.fn().mockImplementation(() => <div>EditIconButton</div>),
}));

jest.mock('../../../utils/APIUtils', () => ({
  formatTeamsResponse: jest.fn(),
  formatUsersResponse: jest.fn(),
}));

jest.mock('../UserTag/UserTag.component', () => ({
  UserTag: jest.fn().mockReturnValue(<div>UserTag</div>),
}));

describe('UserTeamSelectableList Component Test', () => {
  it('should render children if provided', () => {
    render(
      <UserTeamSelectableList hasPermission onUpdate={mockOnUpdate}>
        <p>CustomRenderer</p>
      </UserTeamSelectableList>
    );

    const children = screen.getByText('CustomRenderer');

    expect(children).toBeInTheDocument();
  });

  it('should pass popover props to popover component', () => {
    render(
      <UserTeamSelectableList
        hasPermission
        popoverProps={{ open: true }}
        onUpdate={mockOnUpdate}>
        <p>CustomRenderer</p>
      </UserTeamSelectableList>
    );

    expect(Popover).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
      }),
      {}
    );
  });
});
