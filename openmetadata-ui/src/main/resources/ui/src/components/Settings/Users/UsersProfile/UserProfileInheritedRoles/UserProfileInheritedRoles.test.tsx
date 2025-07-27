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

import { render, screen } from '@testing-library/react';
import UserProfileInheritedRoles from './UserProfileInheritedRoles.component';
import { UserProfileInheritedRolesProps } from './UserProfileInheritedRoles.interface';

const mockPropsData: UserProfileInheritedRolesProps = {
  inheritedRoles: [],
};

jest.mock('../../../../common/Chip/Chip.component', () => {
  return jest.fn().mockReturnValue(<p>Chip</p>);
});

describe('Test User Profile Roles Component', () => {
  it('should render user profile roles component', async () => {
    render(<UserProfileInheritedRoles {...mockPropsData} />);

    expect(
      screen.getByTestId('user-profile-inherited-roles')
    ).toBeInTheDocument();

    expect(
      screen.getByTestId('user-profile-inherited-roles')
    ).toBeInTheDocument();

    expect(await screen.findAllByText('Chip')).toHaveLength(1);
  });
});
