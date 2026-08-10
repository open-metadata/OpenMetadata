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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OwnerType } from '../../../enums/user.enum';
import { getTeamByName } from '../../../rest/teamsAPI';
import { getUserByName } from '../../../rest/userAPI';
import UserPopOverCard from './UserPopOverCard';

const mockStoreState = {
  userProfilePics: {},
  updateUserProfilePics: jest.fn(),
};

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
  Link: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockImplementation((selector) =>
      selector ? selector(mockStoreState) : mockStoreState
    ),
}));

jest.mock('../../../rest/userAPI', () => ({
  getUserByName: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ name: 'testUser', displayName: 'Test User' })
    ),
}));

jest.mock('../../../rest/teamsAPI', () => ({
  getTeamByName: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ name: 'testTeam', displayName: 'Test Team' })
    ),
}));

jest.mock('../../../utils/UserDataUtils', () => ({
  getUserWithImage: jest.fn().mockImplementation((user) => user),
}));

jest.mock('../ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockImplementation(() => <div>ProfilePicture</div>);
});

jest.mock('./PopoverContent.component', () => ({
  PopoverContent: jest.fn().mockImplementation(() => <div>PopoverContent</div>),
}));

jest.mock('./PopoverTitle.component', () => ({
  PopoverTitle: jest.fn().mockImplementation(() => <div>PopoverTitle</div>),
}));

jest.mock('./TeamPopoverContent.component', () => ({
  TeamPopoverContent: jest
    .fn()
    .mockImplementation(() => <div>TeamPopoverContent</div>),
}));

jest.mock('./TeamPopoverTitle.component', () => ({
  TeamPopoverTitle: jest
    .fn()
    .mockImplementation(() => <div>TeamPopoverTitle</div>),
}));

describe('UserPopOverCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('should not fetch anything until the popover is opened', () => {
    render(<UserPopOverCard userName="testUser" />);

    expect(getUserByName).not.toHaveBeenCalled();
    expect(getTeamByName).not.toHaveBeenCalled();
  });

  it('should fetch once for the shared title and content, even across re-hovers', async () => {
    render(
      <UserPopOverCard userName="testUser">
        <span data-testid="owner-chip">testUser</span>
      </UserPopOverCard>
    );

    const chip = screen.getByTestId('owner-chip');

    fireEvent.mouseEnter(chip);

    await waitFor(() => expect(getUserByName).toHaveBeenCalledTimes(1));

    fireEvent.mouseLeave(chip);
    fireEvent.mouseEnter(chip);

    await waitFor(() =>
      expect(screen.getByText('PopoverTitle')).toBeInTheDocument()
    );

    expect(getUserByName).toHaveBeenCalledTimes(1);
    expect(screen.getByText('PopoverContent')).toBeInTheDocument();
  });

  it('should fetch team details once for a team owner', async () => {
    render(
      <UserPopOverCard type={OwnerType.TEAM} userName="testTeam">
        <span data-testid="owner-chip">testTeam</span>
      </UserPopOverCard>
    );

    fireEvent.mouseEnter(screen.getByTestId('owner-chip'));

    await waitFor(() => expect(getTeamByName).toHaveBeenCalledTimes(1));

    expect(getUserByName).not.toHaveBeenCalled();
    expect(screen.getByText('TeamPopoverTitle')).toBeInTheDocument();
    expect(screen.getByText('TeamPopoverContent')).toBeInTheDocument();
  });
});
