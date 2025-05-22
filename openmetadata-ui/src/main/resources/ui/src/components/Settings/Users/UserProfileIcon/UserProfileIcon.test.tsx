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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getImageWithResolutionAndFallback } from '../../../../utils/ProfilerUtils';
import { mockPersonaData, mockUserData } from '../mocks/User.mocks';
import { UserProfileIcon } from './UserProfileIcon.component';

const mockLogout = jest.fn();

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    selectedPersona: {},
    setSelectedPersona: jest.fn(),
    onLogoutHandler: mockLogout,
    currentUser: mockUserData,
  })),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Test User'),
}));

jest.mock('../../../../utils/ProfilerUtils', () => ({
  getImageWithResolutionAndFallback: jest
    .fn()
    .mockImplementation(() => 'valid-image-url'),
  ImageQuality: jest.fn().mockReturnValue('6x'),
}));

jest.mock('../../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<div>ProfilePicture</div>)
);

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
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

  it('should display image if profile pic is valid', () => {
    const { getByTestId } = render(<UserProfileIcon />);

    expect(getByTestId('app-bar-user-profile-pic')).toBeInTheDocument();
  });

  it('should not display profile pic if image url is invalid', () => {
    (getImageWithResolutionAndFallback as jest.Mock).mockImplementation(
      () => undefined
    );
    const { queryByTestId, getByText } = render(<UserProfileIcon />);

    expect(queryByTestId('app-bar-user-profile-pic')).not.toBeInTheDocument();
    expect(getByText('ProfilePicture')).toBeInTheDocument();
  });

  it('should display the user team', () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      selectedPersona: {
        id: '3362fe18-05ad-4457-9632-84f22887dda6',
        type: 'team',
      },
      setSelectedPersona: jest.fn(),
    }));
    const { getByTestId } = render(<UserProfileIcon />);

    expect(getByTestId('default-persona')).toHaveTextContent('Test User');
  });

  it('should show empty placeholder when no teams data', async () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      currentUser: { ...mockUserData, teams: [] },
      onLogoutHandler: mockLogout,
    }));
    const teamLabels = screen.queryAllByText('label.team-plural');

    teamLabels.forEach((label) => {
      expect(label).toHaveTextContent('--');
    });
  });

  it('should show checked if selected persona is true', async () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      currentUser: {
        ...mockUserData,
        personas: mockPersonaData,
      },
      onLogoutHandler: mockLogout,
      selectedPersona: {
        id: '0430976d-092a-46c9-90a8-61c6091a6f38',
        type: 'persona',
      },
      setSelectedPersona: jest.fn(),
    }));

    const { getByTestId } = render(<UserProfileIcon />);
    fireEvent.click(getByTestId('dropdown-profile'));
    fireEvent.click(getByTestId('persona-label'));

    expect(getByTestId('check-outlined')).toBeInTheDocument();
  });

  it('should not show checked if selected persona is true', async () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      currentUser: {
        ...mockUserData,
        personas: mockPersonaData,
      },
      onLogoutHandler: mockLogout,
      selectedPersona: {
        id: 'test',
        type: 'persona',
      },
      setSelectedPersona: jest.fn(),
    }));

    const { getByTestId, queryByTestId } = render(<UserProfileIcon />);
    fireEvent.click(getByTestId('dropdown-profile'));
    fireEvent.click(getByTestId('persona-label'));

    expect(queryByTestId('check-outlined')).not.toBeInTheDocument();
  });
});
