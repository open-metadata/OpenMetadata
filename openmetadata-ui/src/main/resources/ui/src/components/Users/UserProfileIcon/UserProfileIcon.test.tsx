/*
 *  Copyright 2024 Collate.
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
import React from 'react';
import { getImageWithResolutionAndFallback } from '../../../utils/ProfilerUtils';
import { useApplicationConfigContext } from '../../ApplicationConfigProvider/ApplicationConfigProvider';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import { mockUserData } from '../mocks/User.mocks';
import { UserProfileIcon } from './UserProfileIcon.component';

const mockLogout = jest.fn();
const mockUpdateSelectedPersona = jest.fn();

jest.mock('../../ApplicationConfigProvider/ApplicationConfigProvider', () => ({
  useApplicationConfigContext: jest.fn().mockImplementation(() => ({
    selectedPersona: {},
    updateSelectedPersona: mockUpdateSelectedPersona,
  })),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Test User'),
}));

jest.mock('../../../utils/ProfilerUtils', () => ({
  getImageWithResolutionAndFallback: jest
    .fn()
    .mockImplementation(() => 'valid-image-url'),
  ImageQuality: jest.fn().mockReturnValue('6x'),
}));

jest.mock('../../common/AvatarComponent/Avatar', () =>
  jest.fn().mockReturnValue(<div>Avatar</div>)
);

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
}));

jest.mock('../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthContext: jest.fn(() => ({
    currentUser: mockUserData,
  })),
  onLogoutHandler: mockLogout,
}));

describe('UserProfileIcon', () => {
  it('should render User Profile Icon', () => {
    const { getByTestId } = render(<UserProfileIcon />);

    expect(getByTestId('dropdown-profile')).toBeInTheDocument();
  });

  it('should display the user name', () => {
    const { getByText } = render(<UserProfileIcon />);

    expect(getByText('Test User')).toBeInTheDocument();
  });

  it('should display default in case of no persona is selected', () => {
    const { getByText } = render(<UserProfileIcon />);

    expect(getByText('label.default')).toBeInTheDocument();
  });

  it('should display image if image url is valid', () => {
    const { getByTestId } = render(<UserProfileIcon />);

    expect(getByTestId('app-bar-user-avatar')).toBeInTheDocument();
  });

  it('should not display avatar if image url is valid', () => {
    (getImageWithResolutionAndFallback as jest.Mock).mockImplementation(
      () => undefined
    );
    const { queryByTestId, getByText } = render(<UserProfileIcon />);

    expect(queryByTestId('app-bar-user-avatar')).not.toBeInTheDocument();
    expect(getByText('Avatar')).toBeInTheDocument();
  });

  it('should display the user team', () => {
    (useApplicationConfigContext as jest.Mock).mockImplementation(() => ({
      selectedPersona: {
        id: '3362fe18-05ad-4457-9632-84f22887dda6',
        type: 'team',
      },
      updateSelectedPersona: jest.fn(),
    }));
    const { getByTestId } = render(<UserProfileIcon />);

    expect(getByTestId('default-persona')).toHaveTextContent('Test User');
  });

  it('should show empty placeholder when no teams data', async () => {
    (useAuthContext as jest.Mock).mockImplementation(() => ({
      currentUser: { ...mockUserData, teams: [] },
      onLogoutHandler: mockLogout,
    }));
    const teamLabels = screen.queryAllByText('label.team-plural');

    teamLabels.forEach((label) => {
      expect(label).toHaveTextContent('--');
    });
  });
});
