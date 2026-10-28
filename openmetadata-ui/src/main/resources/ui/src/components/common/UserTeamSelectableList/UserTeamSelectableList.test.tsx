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
import { Popover } from '@openmetadata/ui-core-components';
import { act, render, screen, waitFor } from '@testing-library/react';
import { searchQuery } from '../../../rest/searchAPI';
import { SelectableList } from '../SelectableList/SelectableList.component';
import { UserTeamSelectableList } from './UserTeamSelectableList.component';

const mockOnUpdate = jest.fn();

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
}));

jest.mock('../SelectableList/SelectableList.component', () => ({
  SelectableList: jest.fn().mockReturnValue(<div>SelectableList</div>),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('getEntityName'),
}));

jest.mock('../../../utils/EntityReferenceUtils', () => ({
  getEntityReferenceListFromEntities: jest.fn().mockReturnValue([]),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Popover: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  PopoverTrigger: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  Tabs: Object.assign(
    jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
    {
      List: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
      Item: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
      Panel: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
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

  it('should pass popoverProps.open to Popover as isOpen when open is true', () => {
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
        isOpen: true,
      }),
      {}
    );
  });

  it('should search and count only the allowed users and teams', async () => {
    render(
      <UserTeamSelectableList
        hasPermission
        allowedIds={['user-1', 'team-1']}
        popoverProps={{ open: true }}
        onUpdate={mockOnUpdate}>
        <p>CustomRenderer</p>
      </UserTeamSelectableList>
    );

    const allowedClause = { terms: { 'id.keyword': ['user-1', 'team-1'] } };

    // The tab not shown first is counted up front.
    await waitFor(() =>
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          searchIndex: 'user',
          pageSize: 0,
          queryFilter: {
            query: {
              bool: {
                must: [
                  { bool: { must: [{ term: { isBot: 'false' } }] } },
                  allowedClause,
                ],
              },
            },
          },
        })
      )
    );

    const { fetchOptions } = (SelectableList as jest.Mock).mock.calls[0][0];
    await act(() => fetchOptions('ops'));

    expect(searchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        searchIndex: 'team',
        query: 'ops',
        queryFilter: {
          query: {
            bool: {
              must: [
                {
                  bool: { must: [{ match: { teamType: 'Group' } }] },
                },
                allowedClause,
              ],
            },
          },
        },
      })
    );
  });

  it('should search everyone when no ids are given', async () => {
    render(
      <UserTeamSelectableList
        hasPermission
        popoverProps={{ open: true }}
        onUpdate={mockOnUpdate}>
        <p>CustomRenderer</p>
      </UserTeamSelectableList>
    );

    await waitFor(() =>
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          searchIndex: 'user',
          queryFilter: {
            query: { bool: { must: [{ term: { isBot: 'false' } }] } },
          },
        })
      )
    );
  });
});
