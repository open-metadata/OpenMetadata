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
import { Popover, Tabs } from '@openmetadata/ui-core-components';
import { act, render, screen } from '@testing-library/react';
import { searchQuery } from '../../../rest/searchAPI';
import { SelectableList } from '../SelectableList/SelectableList.component';
import { UserTeamSelectableList } from './UserTeamSelectableList.component';

const mockOnUpdate = jest.fn();

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
}));

const mockListMounted = jest.fn();

// The real list reads its first page once, when it mounts.
jest.mock('../SelectableList/SelectableList.component', () => ({
  SelectableList: jest.fn().mockImplementation(() => {
    const { useEffect } = jest.requireActual('react');
    useEffect(() => {
      mockListMounted();
    }, []);

    return <div>SelectableList</div>;
  }),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation(
      (entity?: { displayName?: string; name?: string }) =>
        entity?.displayName ?? entity?.name ?? ''
    ),
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

  describe('with its own options', () => {
    const options = [
      { id: 'user-1', type: 'user', name: 'aaron_j', displayName: 'Aaron J' },
      { id: 'user-2', type: 'user', name: 'ben_k', displayName: 'Ben K' },
      { id: 'team-1', type: 'team', name: 'finance', displayName: 'Finance' },
    ];

    const renderWithOptions = () =>
      render(
        <UserTeamSelectableList
          hasPermission
          options={options}
          popoverProps={{ open: true }}
          onUpdate={mockOnUpdate}>
          <p>CustomRenderer</p>
        </UserTeamSelectableList>
      );

    const listProps = (testId: string) =>
      (SelectableList as jest.Mock).mock.calls
        .map(([props]) => props)
        .filter((props) => props.searchBarDataTestId === testId)
        .at(-1);

    beforeEach(() => jest.clearAllMocks());

    it('should count both tabs from the options, without searching', async () => {
      await act(async () => {
        renderWithOptions();
      });

      const badges = (Tabs.Item as unknown as jest.Mock).mock.calls
        .slice(-2)
        .map(([props]) => [props.id, props.badge]);

      expect(badges).toEqual([
        ['teams', 1],
        ['users', 2],
      ]);
      expect(searchQuery).not.toHaveBeenCalled();
    });

    it('should list and search each tab within the options', async () => {
      await act(async () => {
        renderWithOptions();
      });

      const users = listProps('owner-select-users-search-bar');
      const teams = listProps('owner-select-teams-search-bar');

      await expect(users.fetchOptions('')).resolves.toEqual({
        data: [options[0], options[1]],
        paging: { total: 2 },
      });
      // Display name or login name, any case.
      await expect(users.fetchOptions('AARON')).resolves.toEqual({
        data: [options[0]],
        paging: { total: 1 },
      });
      await expect(users.fetchOptions('ben_')).resolves.toEqual({
        data: [options[1]],
        paging: { total: 1 },
      });
      await expect(teams.fetchOptions('fin')).resolves.toEqual({
        data: [options[2]],
        paging: { total: 1 },
      });
      expect(searchQuery).not.toHaveBeenCalled();
    });

    it('should list options that arrive after it opened', async () => {
      const { rerender } = render(
        <UserTeamSelectableList
          hasPermission
          options={[]}
          popoverProps={{ open: true }}
          onUpdate={mockOnUpdate}>
          <p>CustomRenderer</p>
        </UserTeamSelectableList>
      );

      const mountsBefore = mockListMounted.mock.calls.length;
      await act(async () => {
        rerender(
          <UserTeamSelectableList
            hasPermission
            options={options}
            popoverProps={{ open: true }}
            onUpdate={mockOnUpdate}>
            <p>CustomRenderer</p>
          </UserTeamSelectableList>
        );
      });

      // The lists mount again under a new key, so they read the new options.
      expect(mockListMounted.mock.calls.length).toBeGreaterThan(mountsBefore);
      await expect(
        listProps('owner-select-users-search-bar').fetchOptions('')
      ).resolves.toEqual({
        data: [options[0], options[1]],
        paging: { total: 2 },
      });
      expect(searchQuery).not.toHaveBeenCalled();
    });
  });
});
