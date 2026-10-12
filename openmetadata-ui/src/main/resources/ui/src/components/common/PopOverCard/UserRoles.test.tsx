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
import { User } from '../../../generated/entity/teams/user';
import { UserRoles } from './UserRoles.component';

const mockUser: User = {
  name: 'testUser',
  displayName: 'Test User',
  roles: [
    { id: '1', name: 'Role 1' },
    { id: '2', name: 'Role 2' },
  ],
  isAdmin: true,
} as unknown as User;

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

describe('UserRoles Component', () => {
  it('should render roles and admin badge when available', () => {
    render(<UserRoles user={mockUser} />);

    expect(screen.getByText('label.role-plural')).toBeInTheDocument();
    expect(screen.getByText('Role 1')).toBeInTheDocument();
    expect(screen.getByText('Role 2')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should not render when no roles are available', () => {
    const { container } = render(<UserRoles user={{} as User} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should not render admin badge when isAdmin is false', () => {
    const userWithoutAdmin = { ...mockUser, isAdmin: false } as unknown as User;

    render(<UserRoles user={userWithoutAdmin} />);

    expect(screen.getByText('Role 1')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).toBeNull();
  });
});
