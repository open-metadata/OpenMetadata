/*
 *  Copyright 2025 Collate.
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

import { act, render, screen } from '@testing-library/react';
import { noop } from 'lodash';
import { useNavigate } from 'react-router-dom';
import { OwnerType } from '../../../enums/user.enum';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getUserByName } from '../../../rest/userAPI';
import UserPopOverCard, {
  PopoverContent,
  PopoverTitle,
  UserRoles,
  UserTeams,
} from './UserPopOverCard';

const mockUserData = {
  name: 'testUser',
  displayName: 'Test User',
  teams: [
    { id: '1', name: 'Team 1', deleted: false },
    { id: '2', name: 'Team 2', deleted: false },
  ],
  roles: [
    { id: '1', name: 'Role 1' },
    { id: '2', name: 'Role 2' },
  ],
  isAdmin: true,
};

const mockUserProfilePics = {
  testUser: mockUserData,
};

const mockUpdateUserProfilePics = jest.fn();

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    userProfilePics: mockUserProfilePics,
    updateUserProfilePics: mockUpdateUserProfilePics,
  })),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest
    .fn()
    .mockImplementation(() => [null, null, mockUserData]),
}));

jest.mock('../../../rest/userAPI', () => ({
  getUserByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockUserData)),
}));

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockPush),
  Link: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p>Loader</p>);
});

jest.mock('../ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockImplementation(() => <div>ProfilePicture</div>);
});

describe('Test UserPopOverCard components', () => {
  describe('UserTeams Component', () => {
    it('should render teams when teams are available', () => {
      render(<UserTeams userName="testUser" />);

      expect(screen.getByText('label.team-plural')).toBeInTheDocument();
      expect(screen.getByText('Team 1')).toBeInTheDocument();
      expect(screen.getByText('Team 2')).toBeInTheDocument();
    });

    it('should not render when no teams are available', () => {
      const { container } = render(<UserTeams userName="nonExistentUser" />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('UserRoles Component', () => {
    it('should render roles and admin badge when available', () => {
      render(<UserRoles userName="testUser" />);

      expect(screen.getByText('label.role-plural')).toBeInTheDocument();
      expect(screen.getByText('Role 1')).toBeInTheDocument();
      expect(screen.getByText('Role 2')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('should not render when no roles are available', () => {
      const { container } = render(<UserRoles userName="nonExistentUser" />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('PopoverContent Component', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should show loader while loading', async () => {
      (useUserProfile as jest.Mock).mockImplementation(() => [null, null, {}]);
      (getUserByName as jest.Mock).mockImplementationOnce(
        () => new Promise(noop)
      );

      render(<PopoverContent type={OwnerType.USER} userName="testUser" />);

      expect(screen.getByText('Loader')).toBeInTheDocument();
    });

    it('should show no data message when user data is empty', async () => {
      (useUserProfile as jest.Mock).mockImplementation(() => [null, null, {}]);
      (getUserByName as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({})
      );

      await act(async () => {
        render(<PopoverContent type={OwnerType.USER} userName="testUser" />);
      });

      expect(screen.getByText('message.no-data-available')).toBeInTheDocument();
    });

    it('should fetch additional user details when needed', async () => {
      const mockUser = { name: 'testUser', teams: null };
      (useUserProfile as jest.Mock).mockImplementation(() => [
        null,
        null,
        mockUser,
      ]);

      await act(async () => {
        render(<PopoverContent type={OwnerType.USER} userName="testUser" />);
      });

      expect(getUserByName).toHaveBeenCalledWith('testUser', {
        fields: ['teams', 'roles', 'profile'],
      });
    });

    it('should not fetch additional details for team type', async () => {
      await act(async () => {
        render(<PopoverContent type={OwnerType.TEAM} userName="testUser" />);
      });

      expect(getUserByName).not.toHaveBeenCalled();
    });
  });

  describe('PopoverTitle Component', () => {
    it('should render user name and display name correctly', () => {
      (useUserProfile as jest.Mock).mockImplementation(() => [
        null,
        null,
        mockUserData,
      ]);
      render(
        <PopoverTitle
          profilePicture={<div>ProfilePicture</div>}
          type={OwnerType.USER}
          userName="testUser"
        />
      );

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('testUser')).toBeInTheDocument();
    });

    it('should navigate using name instead of display name when clicking display name in tooltip', () => {
      (useUserProfile as jest.Mock).mockImplementation(() => [
        null,
        null,
        mockUserData,
      ]);

      render(
        <PopoverTitle
          profilePicture={<div>ProfilePicture</div>}
          type={OwnerType.USER}
          userName="testUser"
        />
      );

      const displayNameButton = screen.getByText('Test User');
      displayNameButton.click();

      expect(mockPush).toHaveBeenCalledWith('/users/testUser');
    });

    it('should handle click on user name', () => {
      const mockNavigate = jest.fn();
      (useNavigate as jest.Mock).mockImplementationOnce(() => mockNavigate);

      render(
        <PopoverTitle
          profilePicture={<div>ProfilePicture</div>}
          type={OwnerType.USER}
          userName="testUser"
        />
      );

      const userNameButton = screen.getByText('Test User');
      userNameButton.click();

      expect(mockNavigate).toHaveBeenCalledWith('/users/testUser');
    });

    it('should show only userName when displayName is not available', () => {
      (useUserProfile as jest.Mock).mockImplementationOnce(() => [
        null,
        null,
        { name: 'testUser' },
      ]);

      render(
        <PopoverTitle
          profilePicture={<div>ProfilePicture</div>}
          type={OwnerType.USER}
          userName="testUser"
        />
      );

      expect(screen.getByText('testUser')).toBeInTheDocument();
      expect(screen.queryByText('Test User')).not.toBeInTheDocument();
    });
  });

  describe('UserPopOverCard Component', () => {
    it('should render with default props', () => {
      render(<UserPopOverCard userName="testUser" />);

      expect(screen.getByText('ProfilePicture')).toBeInTheDocument();
    });

    it('should render with custom children', () => {
      render(
        <UserPopOverCard userName="testUser">
          <div data-testid="custom-child">Custom Child</div>
        </UserPopOverCard>
      );

      expect(screen.getByTestId('custom-child')).toBeInTheDocument();
    });

    it('should render with showUserName prop', () => {
      render(
        <UserPopOverCard
          showUserName
          displayName="Test User"
          userName="testUser"
        />
      );

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('should render with showUserProfile prop', () => {
      render(<UserPopOverCard showUserProfile={false} userName="testUser" />);

      expect(screen.queryByText('ProfilePicture')).not.toBeInTheDocument();
    });

    it('should render with custom profile width', () => {
      render(<UserPopOverCard profileWidth={32} userName="testUser" />);

      expect(screen.getByText('ProfilePicture')).toBeInTheDocument();
    });

    it('should render with team type', () => {
      render(<UserPopOverCard type={OwnerType.TEAM} userName="testUser" />);

      expect(screen.getByText('ProfilePicture')).toBeInTheDocument();
    });
  });
});
