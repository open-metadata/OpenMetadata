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

import { findByTestId, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import UserCard from './UserCard';

const mockItem = {
  displayName: 'description1',
  fqn: 'service.database.databaseSchema.table',
  id: 'id1',
  type: 'table',
};

const mockRemove = jest.fn();

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
      TABLE: 'table',
      TOPIC: 'topic',
      DASHBOARD: 'dashboard',
    },
  };
});

describe('Test userCard component', () => {
  it('Component should render', async () => {
    const { container } = render(<UserCard isIconVisible item={mockItem} />, {
      wrapper: MemoryRouter,
    });

    const cardContainer = await findByTestId(container, 'user-card-container');
    const avatar = await findByTestId(container, 'profile-picture');

    expect(avatar).toBeInTheDocument();
    expect(cardContainer).toBeInTheDocument();
  });

  it('Data should render', async () => {
    const { container } = render(<UserCard item={mockItem} />, {
      wrapper: MemoryRouter,
    });

    expect(await findByTestId(container, 'data-container')).toBeInTheDocument();
  });

  it('If isActionVisible is passed it should show delete icon', async () => {
    const { container } = render(
      <UserCard isActionVisible item={mockItem} onRemove={mockRemove} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const remove = await findByTestId(container, 'remove');

    expect(remove).toBeInTheDocument();
  });

  it('If dataset is provided, it should display accordingly', async () => {
    const { container } = render(
      <UserCard isDataset isIconVisible item={mockItem} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const svgIcon = await findByTestId(container, 'svg-icon');
    const datasetLink = await findByTestId(container, 'dataset-link');

    expect(svgIcon).toBeInTheDocument();
    expect(datasetLink).toBeInTheDocument();
    expect(datasetLink).toHaveTextContent('database/databaseSchema/table');
  });

  it('If isOwner is passed it should allow delete action', async () => {
    const { container } = render(
      <UserCard
        isActionVisible
        isOwner
        item={mockItem}
        onRemove={mockRemove}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const remove = await findByTestId(container, 'remove');

    fireEvent.click(remove);

    expect(remove).toBeInTheDocument();
    expect(mockRemove).toBeCalled();
  });
});
