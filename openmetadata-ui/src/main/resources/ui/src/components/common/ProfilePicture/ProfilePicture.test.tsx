/*
 *  Copyright 2022 Collate.
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

import { Avatar } from '@openmetadata/ui-core-components';
import { findByTestId, render } from '@testing-library/react';
import ProfilePicture from './ProfilePicture';

jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: jest.fn(({ src, 'data-testid': testId, ...props }) =>
    src ? (
      <img alt="" data-testid="profile-image" src={src} />
    ) : (
      <div data-testid={testId ?? 'profile-avatar'} {...props} />
    )
  ),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));

jest.mock('../../../utils/UserDataUtils', () => {
  return {
    fetchAllUsers: jest.fn(),
    fetchUserProfilePic: jest.fn(),
    getUserDataFromOidc: jest.fn(),
    matchUserDetails: jest.fn(),
  };
});

const mockUseUserProfile = jest.fn().mockReturnValue(['', false, {}]);
jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: () => mockUseUserProfile(),
}));

const mockData = {
  name: 'test-name',
};

describe('Test ProfilePicture component', () => {
  it('ProfilePicture component should render with Avatar', async () => {
    const { container } = render(<ProfilePicture {...mockData} width="36" />);

    const avatar = await findByTestId(container, 'profile-avatar');

    expect(avatar).toBeInTheDocument();
  });

  it('should render with profile image when profileURL is available', async () => {
    mockUseUserProfile.mockReturnValue([
      'https://example.com/profile.jpg',
      false,
      {},
    ]);

    const { container } = render(<ProfilePicture {...mockData} width="36" />);

    const profileImage = await findByTestId(container, 'profile-image');

    expect(profileImage).toBeInTheDocument();
  });

  it('forwards a defined size straight to the Avatar', () => {
    mockUseUserProfile.mockReturnValue(['', false, {}]);
    (Avatar as jest.Mock).mockClear();

    render(<ProfilePicture {...mockData} size="sm" />);

    expect((Avatar as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ size: 'sm' })
    );
  });

  it('maps the legacy numeric width to the nearest defined size', () => {
    mockUseUserProfile.mockReturnValue(['', false, {}]);
    (Avatar as jest.Mock).mockClear();

    render(<ProfilePicture {...mockData} width="40" />);

    expect((Avatar as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ size: 'md' })
    );
  });

  it('paints the ring in the fill hue only when asked to', () => {
    mockUseUserProfile.mockReturnValue(['', false, {}]);
    (Avatar as jest.Mock).mockClear();

    render(<ProfilePicture {...mockData} matchRingToFill />);
    render(<ProfilePicture {...mockData} />);

    const [matched, plain] = (Avatar as jest.Mock).mock.calls.map(
      ([props]) => props
    );
    const ringClass = 'tw:border-[hsl(var(--avatar-hue)_70%_80%)]';

    expect(matched.className).toContain(ringClass);
    expect(plain.className).not.toContain(ringClass);
  });

  it('carries the hue as a CSS variable so the tint can follow the theme', () => {
    mockUseUserProfile.mockReturnValue(['', false, {}]);
    (Avatar as jest.Mock).mockClear();

    render(<ProfilePicture {...mockData} />);

    const props = (Avatar as jest.Mock).mock.calls[0][0];

    expect(props.style).toEqual({
      '--avatar-hue': expect.any(Number),
    });
    expect(props.className).toContain(
      'tw:bg-[hsl(var(--avatar-hue)_100%_92%)]'
    );
    expect(props.className).toContain(
      'tw:dark:bg-[hsl(var(--avatar-hue)_40%_22%)]'
    );
  });
});
