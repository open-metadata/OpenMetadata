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
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityReference } from '../../../generated/entity/type';
import { DomainMembersTab } from './DomainMembersTab.component';

const mockAddMembersToDomain = jest.fn().mockResolvedValue({});
const mockRemoveMembersFromDomain = jest.fn().mockResolvedValue({});
const mockShowErrorToast = jest.fn();
const mockSearchQuery = jest.fn();

let capturedOnUpdate:
  | ((selected?: EntityReference[]) => Promise<void>)
  | undefined;

const directUserHit = {
  _source: {
    id: 'user-1',
    name: 'alice',
    displayName: 'Alice',
    fullyQualifiedName: 'alice',
    domains: [
      { id: 'domain-1', type: 'domain', fullyQualifiedName: 'TestDomain' },
    ],
  },
};

const inheritedUserHit = {
  _source: {
    id: 'user-2',
    name: 'bob',
    displayName: 'Bob',
    fullyQualifiedName: 'bob',
    domains: [
      {
        id: 'domain-1',
        type: 'domain',
        fullyQualifiedName: 'TestDomain',
        inherited: true,
      },
    ],
  },
};

const teamHit = {
  _source: {
    id: 'team-1',
    name: 'data_eng',
    displayName: 'Data Eng',
    fullyQualifiedName: 'data_eng',
    domains: [
      { id: 'domain-1', type: 'domain', fullyQualifiedName: 'TestDomain' },
    ],
  },
};

jest.mock('../../../rest/domainAPI', () => ({
  addMembersToDomain: (...args: unknown[]) => mockAddMembersToDomain(...args),
  removeMembersFromDomain: (...args: unknown[]) =>
    mockRemoveMembersFromDomain(...args),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: (...args: unknown[]) => mockSearchQuery(...args),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

jest.mock(
  '../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest.fn().mockImplementation((props) => {
      capturedOnUpdate = props.onUpdate;

      return (
        <div data-testid="user-team-selectable-list">{props.children}</div>
      );
    }),
  })
);

jest.mock('../../common/UserTag/UserTag.component', () => ({
  UserTag: jest.fn().mockImplementation(({ name }) => <span>{name}</span>),
}));

jest.mock('../../common/SearchBarComponent/SearchBar.component', () => {
  return jest.fn().mockImplementation(() => <div>SearchBar</div>);
});

jest.mock('../../common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious</div>);
});

const editAllPermission = { EditAll: true } as OperationPermission;
const noEditPermission = { EditAll: false } as OperationPermission;

const setupSearchMock = () => {
  mockSearchQuery.mockImplementation(({ searchIndex }) =>
    Promise.resolve({
      hits: {
        hits:
          searchIndex === 'team'
            ? [teamHit]
            : [directUserHit, inheritedUserHit],
        total: { value: searchIndex === 'team' ? 1 : 2 },
      },
    })
  );
};

describe('DomainMembersTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnUpdate = undefined;
    setupSearchMock();
  });

  it('renders assigned users by default with inherited indicator', async () => {
    render(
      <DomainMembersTab
        domainFqn="TestDomain"
        permissions={editAllPermission}
      />,
      { wrapper: MemoryRouter }
    );

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(
      mockSearchQuery.mock.calls.every(
        ([params]) => params.searchIndex === 'user'
      )
    ).toBe(true);
  });

  it('switches to teams and refetches from the team index', async () => {
    render(
      <DomainMembersTab
        domainFqn="TestDomain"
        permissions={editAllPermission}
      />,
      { wrapper: MemoryRouter }
    );

    await screen.findByText('Alice');

    await act(async () => {
      fireEvent.click(screen.getByTestId('member-type-team'));
    });

    expect(await screen.findByText('Data Eng')).toBeInTheDocument();
    expect(
      mockSearchQuery.mock.calls.some(
        ([params]) => params.searchIndex === 'team'
      )
    ).toBe(true);
  });

  it('adds selected members via the bulk endpoint', async () => {
    render(
      <DomainMembersTab
        domainFqn="TestDomain"
        permissions={editAllPermission}
      />,
      { wrapper: MemoryRouter }
    );

    await screen.findByText('Alice');

    const newUser: EntityReference = {
      id: 'user-3',
      type: 'user',
      name: 'carol',
    };

    await act(async () => {
      await capturedOnUpdate?.([newUser]);
    });

    expect(mockAddMembersToDomain).toHaveBeenCalledWith('TestDomain', [
      newUser,
    ]);
    expect(screen.getByText('carol')).toBeInTheDocument();
  });

  it('removes a member after confirmation', async () => {
    render(
      <DomainMembersTab
        domainFqn="TestDomain"
        permissions={editAllPermission}
      />,
      { wrapper: MemoryRouter }
    );

    await screen.findByText('Alice');

    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-domain-member-alice'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.confirm'));
    });

    expect(mockRemoveMembersFromDomain).toHaveBeenCalledWith('TestDomain', [
      expect.objectContaining({ id: 'user-1' }),
    ]);

    await waitFor(() =>
      expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    );
  });

  it('disables remove for inherited members', async () => {
    render(
      <DomainMembersTab
        domainFqn="TestDomain"
        permissions={editAllPermission}
      />,
      { wrapper: MemoryRouter }
    );

    await screen.findByText('Bob');

    expect(screen.getByTestId('remove-domain-member-bob')).toBeDisabled();
    expect(screen.getByTestId('remove-domain-member-alice')).toBeEnabled();
  });

  it('hides add and disables remove without EditAll', async () => {
    render(
      <DomainMembersTab
        domainFqn="TestDomain"
        permissions={noEditPermission}
      />,
      { wrapper: MemoryRouter }
    );

    await screen.findByText('Alice');

    expect(
      screen.queryByTestId('add-domain-member-button')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('remove-domain-member-alice')).toBeDisabled();
  });

  it('shows an error toast when the member fetch fails', async () => {
    mockSearchQuery.mockRejectedValue(new Error('search unavailable'));

    render(
      <DomainMembersTab
        domainFqn="TestDomain"
        permissions={editAllPermission}
      />,
      { wrapper: MemoryRouter }
    );

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
  });
});
