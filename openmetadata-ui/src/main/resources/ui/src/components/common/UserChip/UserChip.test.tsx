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

import { render, screen } from '@testing-library/react';

let mockProfile: { name?: string; displayName?: string } | undefined;

jest.mock('../../../components/common/PopOverCard/UserPopOverCard', () => ({
  __esModule: true,
  default: ({
    children,
    userName,
    type,
  }: {
    children?: React.ReactNode;
    userName: string;
    type: string;
  }) => (
    <div data-testid="popover" data-type={type} data-user={userName}>
      {children}
    </div>
  ),
}));

jest.mock('../../../components/common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: ({ name, displayName }: { name: string; displayName?: string }) => (
    <span data-display={displayName} data-name={name} data-testid="avatar" />
  ),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => [null, false, mockProfile],
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: (ref?: { displayName?: string; name?: string }) =>
    ref?.displayName ?? ref?.name ?? '',
}));

import UserChip from './UserChip';

beforeEach(() => {
  mockProfile = undefined;
});

describe('UserChip', () => {
  it('renders the display name, not the login', () => {
    render(
      <UserChip
        user={{
          id: 'u1',
          type: 'user',
          name: 'harsh.v',
          displayName: 'Harsh Vador',
        }}
      />
    );

    expect(screen.getByText('Harsh Vador')).toBeInTheDocument();
    expect(screen.queryByText('harsh.v')).not.toBeInTheDocument();
  });

  it('keys the hover card off the login so the popover can fetch the user', () => {
    render(<UserChip user={{ id: 'u1', type: 'user', name: 'harsh.v' }} />);

    expect(screen.getByTestId('popover')).toHaveAttribute(
      'data-user',
      'harsh.v'
    );
  });

  it('gives the avatar the display name so its initials and colour match', () => {
    render(
      <UserChip
        user={{
          id: 'u1',
          type: 'user',
          name: 'harsh.v',
          displayName: 'Harsh Vador',
        }}
      />
    );

    const avatar = screen.getByTestId('avatar');

    expect(avatar).toHaveAttribute('data-display', 'Harsh Vador');
    expect(avatar).toHaveAttribute('data-name', 'harsh.v');
  });

  it('keeps the reference display name when the user lookup only cached a placeholder', () => {
    mockProfile = { name: 'harsh.v' };

    render(
      <UserChip
        user={{
          id: 'u1',
          type: 'user',
          name: 'harsh.v',
          displayName: 'Harsh Vador',
        }}
      />
    );

    expect(screen.getByText('Harsh Vador')).toBeInTheDocument();
    expect(screen.queryByText('harsh.v')).not.toBeInTheDocument();
  });

  it('prefers the cached profile when the reference carries no display name', () => {
    mockProfile = { name: 'harsh.v', displayName: 'Harsh Vador' };

    render(<UserChip user={{ id: 'u1', type: 'user', name: 'harsh.v' }} />);

    expect(screen.getByText('Harsh Vador')).toBeInTheDocument();
  });

  it('accepts a bare login for payloads that carry no reference', () => {
    render(<UserChip user="sonika" />);

    expect(screen.getByText('sonika')).toBeInTheDocument();
    expect(screen.getByTestId('popover')).toHaveAttribute('data-type', 'user');
  });

  it('marks a team so the hover card and avatar use the team shape', () => {
    render(
      <UserChip user={{ id: 't1', type: 'team', name: 'Organization' }} />
    );

    expect(screen.getByTestId('popover')).toHaveAttribute('data-type', 'team');
  });

  it('renders the avatar alone when the name is already in the sentence', () => {
    render(
      <UserChip
        hideName
        user={{
          id: 'u1',
          type: 'user',
          name: 'harsh.v',
          displayName: 'Harsh Vador',
        }}
      />
    );

    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.queryByText('Harsh Vador')).not.toBeInTheDocument();
  });

  it('renders nothing without a login to key the card on', () => {
    const { container } = render(
      <UserChip user={{ id: 'u1', type: 'user' }} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
