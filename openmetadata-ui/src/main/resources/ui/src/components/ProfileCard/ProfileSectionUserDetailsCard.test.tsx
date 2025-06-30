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

import { render, screen } from '@testing-library/react';
import { User } from '../../generated/entity/teams/user';
import ProfileSectionUserDetailsCard from './ProfileSectionUserDetailsCard.component';

// Mock dependencies
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: () => ({
    isAdminUser: true,
  }),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    authConfig: { provider: 'basic' },
    currentUser: { id: 'current-user-id', name: 'currentuser' },
  }),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: () => ({
    fqn: 'testuser',
  }),
}));

jest.mock('moment', () => {
  const actualMoment = jest.requireActual('moment');
  const mockMoment = (timestamp?: number) => {
    if (timestamp) {
      return actualMoment(timestamp);
    }

    // Return a fixed time for "now"
    return actualMoment('2025-01-01T12:00:00Z');
  };
  mockMoment.isMoment = actualMoment.isMoment;

  return mockMoment;
});

jest.mock('../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn(() => <div data-testid="profile-picture">ProfilePicture</div>);
});

jest.mock('../common/PopOverCard/UserPopOverCard', () => {
  return jest.fn(({ children }) => (
    <div data-testid="user-popover">{children}</div>
  ));
});

const mockUser: User = {
  id: 'test-user-id',
  name: 'testuser',
  email: 'test@example.com',
  isBot: false,
  deleted: false,
};

const defaultProps = {
  userData: mockUser,
  afterDeleteAction: jest.fn(),
  updateUserDetails: jest.fn(),
  handleRestoreUser: jest.fn(),
};

describe('ProfileSectionUserDetailsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Online Status Display', () => {
    it('should show "Online now" when lastActivityTime is within 5 minutes', () => {
      const recentActivityTime = new Date('2025-01-01T11:57:00Z').getTime(); // 3 minutes ago
      const userWithRecentActivity = {
        ...mockUser,
        lastActivityTime: recentActivityTime,
      };

      render(
        <ProfileSectionUserDetailsCard
          {...defaultProps}
          userData={userWithRecentActivity}
        />
      );

      expect(screen.getByTestId('user-online-status')).toBeInTheDocument();
      expect(screen.getByText('label.online-now')).toBeInTheDocument();
    });

    it('should show "Active recently" when lastActivityTime is between 5 and 60 minutes', () => {
      const recentActivityTime = new Date('2025-01-01T11:30:00Z').getTime(); // 30 minutes ago
      const userWithRecentActivity = {
        ...mockUser,
        lastActivityTime: recentActivityTime,
      };

      render(
        <ProfileSectionUserDetailsCard
          {...defaultProps}
          userData={userWithRecentActivity}
        />
      );

      expect(screen.getByTestId('user-online-status')).toBeInTheDocument();
      expect(screen.getByText('label.active-recently')).toBeInTheDocument();
    });

    it('should not show online status when lastActivityTime is older than 60 minutes', () => {
      const oldActivityTime = new Date('2025-01-01T10:00:00Z').getTime(); // 2 hours ago
      const userWithOldActivity = {
        ...mockUser,
        lastActivityTime: oldActivityTime,
      };

      render(
        <ProfileSectionUserDetailsCard
          {...defaultProps}
          userData={userWithOldActivity}
        />
      );

      expect(
        screen.queryByTestId('user-online-status')
      ).not.toBeInTheDocument();
    });

    it('should fall back to lastLoginTime when lastActivityTime is not available', () => {
      const recentLoginTime = new Date('2025-01-01T11:58:00Z').getTime(); // 2 minutes ago
      const userWithLoginTime = {
        ...mockUser,
        lastLoginTime: recentLoginTime,
        lastActivityTime: undefined,
      };

      render(
        <ProfileSectionUserDetailsCard
          {...defaultProps}
          userData={userWithLoginTime}
        />
      );

      expect(screen.getByTestId('user-online-status')).toBeInTheDocument();
      expect(screen.getByText('label.online-now')).toBeInTheDocument();
    });

    it('should not show online status for bot users', () => {
      const botUser = {
        ...mockUser,
        isBot: true,
        lastActivityTime: new Date('2025-01-01T11:59:00Z').getTime(), // 1 minute ago
      };

      render(
        <ProfileSectionUserDetailsCard {...defaultProps} userData={botUser} />
      );

      expect(
        screen.queryByTestId('user-online-status')
      ).not.toBeInTheDocument();
    });

    it('should not show online status when both lastActivityTime and lastLoginTime are not available', () => {
      const userWithoutTimes = {
        ...mockUser,
        lastActivityTime: undefined,
        lastLoginTime: undefined,
      };

      render(
        <ProfileSectionUserDetailsCard
          {...defaultProps}
          userData={userWithoutTimes}
        />
      );

      expect(
        screen.queryByTestId('user-online-status')
      ).not.toBeInTheDocument();
    });
  });

  describe('Basic User Information', () => {
    it('should display user email', () => {
      render(<ProfileSectionUserDetailsCard {...defaultProps} />);

      expect(screen.getByTestId('user-email-value')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should display user display name', () => {
      render(<ProfileSectionUserDetailsCard {...defaultProps} />);

      expect(screen.getByTestId('user-display-name')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('should show profile picture', () => {
      render(<ProfileSectionUserDetailsCard {...defaultProps} />);

      expect(screen.getByTestId('profile-picture')).toBeInTheDocument();
    });
  });

  describe('Online Status Badge Styling', () => {
    it('should have success status badge for online users', () => {
      const recentActivityTime = new Date('2025-01-01T11:59:00Z').getTime(); // 1 minute ago
      const userWithRecentActivity = {
        ...mockUser,
        lastActivityTime: recentActivityTime,
      };

      const { container } = render(
        <ProfileSectionUserDetailsCard
          {...defaultProps}
          userData={userWithRecentActivity}
        />
      );

      const badge = container.querySelector(
        '[data-testid="user-online-status"]'
      );

      expect(badge).toHaveAttribute('status', 'success');
    });

    it('should be positioned below the email', () => {
      const recentActivityTime = new Date('2025-01-01T11:59:00Z').getTime();
      const userWithRecentActivity = {
        ...mockUser,
        lastActivityTime: recentActivityTime,
      };

      const { container } = render(
        <ProfileSectionUserDetailsCard
          {...defaultProps}
          userData={userWithRecentActivity}
        />
      );

      const statusContainer = container.querySelector(
        '[data-testid="user-online-status"]'
      )?.parentElement;

      expect(statusContainer).toHaveClass('m-t-sm');
    });
  });
});
