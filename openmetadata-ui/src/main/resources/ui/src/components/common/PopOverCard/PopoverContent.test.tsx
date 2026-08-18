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
import { OwnerType } from '../../../enums/user.enum';
import { User } from '../../../generated/entity/teams/user';
import { PopoverContent } from './PopoverContent.component';

const mockUserData = {
  name: 'testUser',
  displayName: 'Test User',
  teams: [{ id: '1', name: 'Team 1', deleted: false }],
  roles: [{ id: '1', name: 'Role 1' }],
  isAdmin: true,
} as unknown as User;

const mockStoreState = {
  userProfilePics: { testUser: mockUserData },
  updateUserProfilePics: jest.fn(),
};

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockImplementation((selector) =>
      selector ? selector(mockStoreState) : mockStoreState
    ),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p>Loader</p>);
});

describe('PopoverContent Component', () => {
  it('should show loader while loading', () => {
    render(
      <PopoverContent loading type={OwnerType.USER} userName="testUser" />
    );

    expect(screen.getByText('Loader')).toBeInTheDocument();
    expect(
      screen.queryByText('message.no-data-available')
    ).not.toBeInTheDocument();
  });

  it('should show no data message when user data is empty', () => {
    render(<PopoverContent type={OwnerType.USER} userName="testUser" />);

    expect(screen.getByText('message.no-data-available')).toBeInTheDocument();
  });

  it('should render teams and roles when user data is provided', () => {
    render(
      <PopoverContent
        type={OwnerType.USER}
        user={mockUserData}
        userName="testUser"
      />
    );

    expect(
      screen.queryByText('message.no-data-available')
    ).not.toBeInTheDocument();
    expect(screen.getByText('label.team-plural')).toBeInTheDocument();
    expect(screen.getByText('Team 1')).toBeInTheDocument();
  });
});
