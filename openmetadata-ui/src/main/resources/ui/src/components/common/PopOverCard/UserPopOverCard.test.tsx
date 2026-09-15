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
import { OwnerType } from '../../../enums/user.enum';
import UserPopOverCard from './UserPopOverCard';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
  Link: jest.fn().mockImplementation(({ children }) => children),
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
