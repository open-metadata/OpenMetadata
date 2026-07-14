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

import { act, render, screen, waitFor } from '@testing-library/react';
import { Domain, DomainType } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import { DomainMembersWidget } from './DomainMembersWidget';

const mockAddMembersToDomain = jest.fn().mockResolvedValue({});
const mockRemoveMembersFromDomain = jest.fn().mockResolvedValue({});
const mockShowErrorToast = jest.fn();
const mockSearchQuery = jest.fn();

let capturedOnUpdate:
  | ((selected?: EntityReference[]) => Promise<void>)
  | undefined;
let capturedOwner: EntityReference[] | undefined;

const mockPermissions = { EditAll: true };
const mockContext: {
  data: Domain;
  permissions: typeof mockPermissions;
  isVersionView: boolean;
} = {
  data: {
    id: 'domain-1',
    name: 'TestDomain',
    fullyQualifiedName: 'TestDomain',
    description: 'test',
    domainType: DomainType.Aggregate,
  },
  permissions: mockPermissions,
  isVersionView: false,
};

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

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => mockContext,
}));

jest.mock(
  '../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: jest.fn().mockImplementation((props) => {
      capturedOnUpdate = props.onUpdate;
      capturedOwner = props.owner;

      return (
        <div data-testid="user-team-selectable-list">{props.children}</div>
      );
    }),
  })
);

jest.mock('../../common/UserTag/UserTag.component', () => ({
  UserTag: jest.fn().mockImplementation(({ name }) => <span>{name}</span>),
}));

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

describe('DomainMembersWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnUpdate = undefined;
    capturedOwner = undefined;
    mockContext.permissions = { EditAll: true };
    mockContext.isVersionView = false;
    setupSearchMock();
  });

  it('renders fetched users and teams including inherited members', async () => {
    render(<DomainMembersWidget />);

    expect(
      await screen.findByTestId('domain-member-alice')
    ).toBeInTheDocument();
    expect(screen.getByTestId('domain-member-bob')).toBeInTheDocument();
    expect(screen.getByTestId('domain-member-data_eng')).toBeInTheDocument();
  });

  it('excludes inherited members from the picker selection', async () => {
    render(<DomainMembersWidget />);

    await screen.findByTestId('domain-member-alice');
    await waitFor(() => expect(capturedOwner).toHaveLength(2));

    const ownerIds = (capturedOwner ?? []).map((item) => item.id);

    expect(ownerIds).toContain('team-1');
    expect(ownerIds).toContain('user-1');
    expect(ownerIds).not.toContain('user-2');
  });

  it('hides the edit control without EditAll permission', async () => {
    mockContext.permissions = { EditAll: false };

    render(<DomainMembersWidget />);

    await screen.findByTestId('domain-member-alice');

    expect(
      screen.queryByTestId('user-team-selectable-list')
    ).not.toBeInTheDocument();
  });

  it('hides the edit control in version view', async () => {
    mockContext.isVersionView = true;

    render(<DomainMembersWidget />);

    await screen.findByTestId('domain-member-alice');

    expect(
      screen.queryByTestId('user-team-selectable-list')
    ).not.toBeInTheDocument();
  });

  it('adds only the newly selected members', async () => {
    render(<DomainMembersWidget />);

    await screen.findByTestId('domain-member-alice');
    await waitFor(() => expect(capturedOwner).toHaveLength(2));

    const newUser: EntityReference = {
      id: 'user-3',
      type: 'user',
      name: 'carol',
    };

    await act(async () => {
      await capturedOnUpdate?.([...(capturedOwner ?? []), newUser]);
    });

    expect(mockAddMembersToDomain).toHaveBeenCalledWith('TestDomain', [
      newUser,
    ]);
    expect(mockRemoveMembersFromDomain).not.toHaveBeenCalled();
  });

  it('removes only the deselected direct members', async () => {
    render(<DomainMembersWidget />);

    await screen.findByTestId('domain-member-alice');
    await waitFor(() => expect(capturedOwner).toHaveLength(2));

    const remaining = (capturedOwner ?? []).filter(
      (item) => item.id !== 'user-1'
    );

    await act(async () => {
      await capturedOnUpdate?.(remaining);
    });

    expect(mockAddMembersToDomain).not.toHaveBeenCalled();
    expect(mockRemoveMembersFromDomain).toHaveBeenCalledWith('TestDomain', [
      expect.objectContaining({ id: 'user-1' }),
    ]);
  });

  it('shows an error toast when the bulk call fails', async () => {
    mockAddMembersToDomain.mockRejectedValueOnce(new Error('forbidden'));

    render(<DomainMembersWidget />);

    await screen.findByTestId('domain-member-alice');
    await waitFor(() => expect(capturedOwner).toHaveLength(2));

    await act(async () => {
      await capturedOnUpdate?.([
        ...(capturedOwner ?? []),
        { id: 'user-3', type: 'user', name: 'carol' },
      ]);
    });

    expect(mockShowErrorToast).toHaveBeenCalled();
  });
});
