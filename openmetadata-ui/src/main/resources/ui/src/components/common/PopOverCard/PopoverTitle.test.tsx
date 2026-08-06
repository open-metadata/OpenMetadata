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
import { useNavigate } from 'react-router-dom';
import { OwnerType } from '../../../enums/user.enum';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { PopoverTitle } from './PopoverTitle.component';

const mockUserData = {
  name: 'testUser',
  displayName: 'Test User',
};

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockPush),
  Link: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest
    .fn()
    .mockImplementation(() => [null, null, mockUserData]),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

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

    screen.getByText('Test User').click();

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

    screen.getByText('Test User').click();

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

  it('should navigate to team details path when type is TEAM', () => {
    const mockNavigate = jest.fn();
    (useNavigate as jest.Mock).mockImplementationOnce(() => mockNavigate);
    (useUserProfile as jest.Mock).mockImplementation(() => [
      null,
      null,
      { name: 'testTeam', displayName: 'Test Team' },
    ]);

    render(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.TEAM}
        userName="testTeam"
      />
    );

    screen.getByText('Test Team').click();

    expect(mockNavigate).toHaveBeenCalledWith(
      '/settings/members/teams/testTeam'
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('/users/testTeam');
  });

  it('should navigate to user profile path when type is USER', () => {
    const mockNavigate = jest.fn();
    (useNavigate as jest.Mock).mockImplementationOnce(() => mockNavigate);
    (useUserProfile as jest.Mock).mockImplementation(() => [
      null,
      null,
      { name: 'testUser', displayName: 'Test User' },
    ]);

    render(
      <PopoverTitle
        profilePicture={<div>ProfilePicture</div>}
        type={OwnerType.USER}
        userName="testUser"
      />
    );

    screen.getByText('Test User').click();

    expect(mockNavigate).toHaveBeenCalledWith('/users/testUser');
  });
});
