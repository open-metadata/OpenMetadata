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
import ProfilePicture from './ProfilePicture';

const mockUseUserProfile = jest.fn();

jest.mock('../../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
}));

jest.mock(
  '../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockReturnValue({ permissions: {} }),
  })
);

jest.mock('../../../../utils/PermissionsUtils', () => ({
  userPermissions: { hasViewPermissions: jest.fn().mockReturnValue(true) },
}));

jest.mock('../../Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="loader">Loader</div>)
);

describe('ProfilePicture (atoms)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the initial character when there is no profile image', () => {
    mockUseUserProfile.mockReturnValue([undefined, false]);

    render(<ProfilePicture name="John Doe" />);

    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('should render the profile image when a profile url is available', () => {
    mockUseUserProfile.mockReturnValue(['http://image.test/pic.png', false]);

    const { container } = render(<ProfilePicture name="John Doe" />);
    const img = container.querySelector('img');

    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'http://image.test/pic.png');
  });

  it('should render the loader while the profile picture is loading', () => {
    mockUseUserProfile.mockReturnValue([undefined, true]);

    render(<ProfilePicture name="John Doe" />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByText('J')).not.toBeInTheDocument();
  });

  it('should prefer displayName over name for the initial', () => {
    mockUseUserProfile.mockReturnValue([undefined, false]);

    render(<ProfilePicture displayName="Adam Smith" name="zzz" />);

    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
