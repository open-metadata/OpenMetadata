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

import { fireEvent, render, screen } from '@testing-library/react';
import { OwnerType } from '../../../enums/user.enum';
import { User } from '../../../generated/entity/teams/user';
import UserPopOverCard from './UserPopOverCard';

const mockStoreState: { userProfilePics: Record<string, User> } = {
  userProfilePics: {},
};

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockImplementation((selector) => selector(mockStoreState)),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
  Link: jest
    .fn()
    .mockImplementation(({ children, onClick, to: _to, ...rest }) => (
      <button {...rest} type="button" onClick={onClick}>
        {children}
      </button>
    )),
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
  afterEach(() => {
    mockStoreState.userProfilePics = {};
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

  it('should invoke onTitleClick when the title is clicked', () => {
    const onTitleClick = jest.fn();
    render(
      <UserPopOverCard
        showUserName
        displayName="Test User"
        userName="testUser"
        onTitleClick={onTitleClick}
      />
    );

    fireEvent.click(screen.getByTestId('testUser'));

    expect(onTitleClick).toHaveBeenCalledTimes(1);
  });

  it('should show the stored display name when no displayName is passed', () => {
    mockStoreState.userProfilePics = {
      testUser: { name: 'testUser', displayName: 'Test User' } as User,
    };

    render(<UserPopOverCard showUserName userName="testUser" />);

    expect(screen.getByTestId('testUser')).toHaveTextContent('Test User');
  });

  it('should prefer the displayName prop over the stored user', () => {
    mockStoreState.userProfilePics = {
      testUser: { name: 'testUser', displayName: 'Stored Name' } as User,
    };

    render(
      <UserPopOverCard
        showUserName
        displayName="Prop Name"
        userName="testUser"
      />
    );

    expect(screen.getByText('Prop Name')).toBeInTheDocument();
    expect(screen.queryByText('Stored Name')).not.toBeInTheDocument();
  });

  it('should fall back to the user name when the stored user has no display name', () => {
    mockStoreState.userProfilePics = {
      testUser: { name: 'testUser', id: 'testUser', email: '' } as User,
    };

    render(<UserPopOverCard showUserName userName="testUser" />);

    expect(screen.getByTestId('testUser')).toHaveTextContent('testUser');
  });

  it('should fall back to the user name before the user is loaded', () => {
    render(<UserPopOverCard showUserName userName="testUser" />);

    expect(screen.getByTestId('testUser')).toHaveTextContent('testUser');
  });

  it('should not use a stored user for a team', () => {
    mockStoreState.userProfilePics = {
      testTeam: { name: 'testTeam', displayName: 'Some User' } as User,
    };

    render(
      <UserPopOverCard showUserName type={OwnerType.TEAM} userName="testTeam" />
    );

    expect(screen.getByTestId('testTeam')).toHaveTextContent('testTeam');
    expect(screen.queryByText('Some User')).not.toBeInTheDocument();
  });

  it('should render children instead of the resolved name', () => {
    mockStoreState.userProfilePics = {
      testUser: { name: 'testUser', displayName: 'Test User' } as User,
    };

    render(
      <UserPopOverCard showUserName userName="testUser">
        <span>Custom Child</span>
      </UserPopOverCard>
    );

    expect(screen.getByText('Custom Child')).toBeInTheDocument();
    expect(screen.queryByText('Test User')).not.toBeInTheDocument();
  });
});
