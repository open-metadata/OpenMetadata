/*
 *  Copyright 2021 Collate
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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-test-renderer';
import UserDataCard, { Item, Props } from './UserDataCard';

const onClick = jest.fn();
const onDelete = jest.fn();

const mockItem: Item = {
  displayName: 'description1',
  name: 'name1',
  email: 'string@email.com',
  isActiveUser: true,
  profilePhoto: '',
  teamCount: 'Cloud_Infra',
};

const mockProp: Props = {
  item: mockItem,
  onClick,
  onDelete,
};

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock('../../components/common/ProfilePicture/ProfilePicture', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="profile-picture">ProfilePicture</p>);
});

jest.mock('../../utils/SvgUtils', () => {
  return {
    __esModule: true,
    default: jest.fn().mockReturnValue(<p data-testid="svg-icon">SVGIcons</p>),
    Icons: {
      DELETE: 'delete',
    },
  };
});

jest.mock('../common/non-admin-action/NonAdminAction', () => {
  return jest.fn().mockImplementation(({ children }) => {
    return (
      <div>
        NonAdminAction
        {children}
      </div>
    );
  });
});

describe('Test UserDataCard component', () => {
  it('Component should render', async () => {
    const { findByTestId, findByText } = render(
      <UserDataCard {...mockProp} item={{ ...mockItem, id: 'id1' }} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const cardContainer = await findByTestId('user-card-container');
    const avatar = await findByTestId('profile-picture');
    const userDisplayName = await findByText(mockItem.displayName);

    expect(avatar).toBeInTheDocument();
    expect(cardContainer).toBeInTheDocument();

    act(() => {
      fireEvent.click(userDisplayName);
    });

    expect(onClick).toBeCalled();
  });

  it('Data should render', async () => {
    const { findByTestId } = render(<UserDataCard {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    expect(await findByTestId('data-container')).toBeInTheDocument();
  });

  it('Inacive status should be shown for deleted user', () => {
    const { getByText } = render(
      <UserDataCard {...mockProp} item={{ ...mockItem, isActiveUser: false }} />
    );

    expect(getByText('Inactive')).toBeInTheDocument();
  });

  it('User should get removed when deleted', async () => {
    const { queryByText, getByTestId } = render(
      <UserDataCard {...mockProp} item={{ ...mockItem, id: 'id1' }} />
    );
    const removeButton = getByTestId('remove');

    expect(queryByText(mockItem.displayName)).toBeInTheDocument();
    expect(removeButton).toBeInTheDocument();

    act(() => {
      fireEvent.click(removeButton);
    });

    expect(onDelete).toHaveBeenCalledWith('id1', mockItem.displayName);
  });
});
