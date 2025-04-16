/*
 *  Copyright 2023 Collate.
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
import { getImageWithResolutionAndFallback } from '../../../../../utils/ProfilerUtils';
import { mockUserData } from '../../mocks/User.mocks';
import UserProfileImage from './UserProfileImage.component';
import { UserProfileImageProps } from './UserProfileImage.interface';

const mockPropsData: UserProfileImageProps = {
  userData: mockUserData,
};

jest.mock('../../../../../utils/ProfilerUtils', () => ({
  getImageWithResolutionAndFallback: jest.fn().mockImplementation(undefined),
  ImageQuality: jest.fn().mockReturnValue('6x'),
}));

jest.mock('../../../../common/ProfilePicture/ProfilePicture', () => {
  return jest
    .fn()
    .mockImplementation(({ displayName }) => <p>{displayName}</p>);
});

describe('Test User User Profile Image Component', () => {
  it('should render user profile image component', async () => {
    render(<UserProfileImage {...mockPropsData} />);

    expect(screen.getByTestId('profile-image-container')).toBeInTheDocument();
  });

  it('should render user profile picture component if no image found', async () => {
    await act(async () => {
      render(<UserProfileImage {...mockPropsData} />);
    });

    expect(screen.getByTestId('profile-image-container')).toBeInTheDocument();

    expect(screen.queryByText(mockUserData.name)).toBeNull();
    expect(screen.getByText(mockUserData.displayName)).toBeInTheDocument();
  });

  it('should fallback to name for the displayName prop of ProfilePicture', async () => {
    await act(async () => {
      render(
        <UserProfileImage userData={{ ...mockUserData, displayName: '' }} />
      );
    });

    expect(screen.getByTestId('profile-image-container')).toBeInTheDocument();

    expect(screen.getByText(mockUserData.name)).toBeInTheDocument();
  });

  it('should render user profile picture component with image', async () => {
    (getImageWithResolutionAndFallback as jest.Mock).mockImplementationOnce(
      () => '/image/test/png'
    );

    render(<UserProfileImage {...mockPropsData} />);

    expect(screen.getByTestId('profile-image-container')).toBeInTheDocument();

    expect(screen.getByTestId('user-profile-image')).toBeInTheDocument();
  });
});
