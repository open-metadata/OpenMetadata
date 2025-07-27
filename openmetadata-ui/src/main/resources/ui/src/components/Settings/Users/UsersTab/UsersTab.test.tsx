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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getUserById } from '../../../../rest/userAPI';
import { mockUsersTabData } from '../mocks/User.mocks';
import { UsersTab } from './UsersTabs.component';

jest.mock('../../../../rest/userAPI', () => ({
  getUserById: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockUsersTabData)),
}));

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
}));

const mockUsers = [
  {
    deleted: false,
    displayName: 'Aaron Johnson',
    fullyQualifiedName: 'aaron_johnson0',
    href: 'http://localhost:8585/api/v1/users/f281e7fd-5fd3-4279-8a2d-ade80febd743',
    id: 'f281e7fd-5fd3-4279-8a2d-ade80febd743',
    name: 'aaron_johnson0',
    type: 'user',
  },
];

jest.mock('../../../common/PopOverCard/UserPopOverCard', () =>
  jest.fn().mockReturnValue('Aaron Johnson')
);

const mockOnRemoveUser = jest.fn();

describe('UsersTab', () => {
  it('should renders Users Tab', async () => {
    await act(async () => {
      render(<UsersTab users={mockUsers} onRemoveUser={mockOnRemoveUser} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText('label.username')).toBeInTheDocument();
    expect(await screen.findByText('label.team-plural')).toBeInTheDocument();
    expect(await screen.findByText('label.role-plural')).toBeInTheDocument();
    expect(await screen.findByText('label.action-plural')).toBeInTheDocument();
  });

  it('should display the user details', async () => {
    await act(async () => {
      render(<UsersTab users={mockUsers} onRemoveUser={mockOnRemoveUser} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findAllByText('Aaron Johnson')).toHaveLength(2);
    expect(await screen.findByText('Sales')).toBeInTheDocument();
    expect(await screen.findByText('Data Steward')).toBeInTheDocument();
  });

  it('should render empty placeholder if no data', async () => {
    (getUserById as jest.Mock).mockImplementation(() => Promise.resolve([])),
      await act(async () => {
        render(<UsersTab users={[]} onRemoveUser={mockOnRemoveUser} />, {
          wrapper: MemoryRouter,
        });
      });

    expect(
      await screen.findByTestId('assign-error-placeholder-label.user')
    ).toBeInTheDocument();
  });

  it('should display the remove confirmation modal when remove button is clicked', async () => {
    await act(async () => {
      render(<UsersTab users={mockUsers} onRemoveUser={mockOnRemoveUser} />, {
        wrapper: MemoryRouter,
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-user-btn'));
    });

    expect(
      await screen.getByTestId('remove-confirmation-modal')
    ).toBeInTheDocument();
  });

  it('should close the remove confirmation modal when cancel button is clicked', async () => {
    await act(async () => {
      render(<UsersTab users={mockUsers} onRemoveUser={mockOnRemoveUser} />, {
        wrapper: MemoryRouter,
      });
    });
    fireEvent.click(screen.getByTestId('remove-user-btn'));
    fireEvent.click(screen.getByText('label.cancel'));

    expect(
      screen.queryByTestId('remove-confirmation-modal')
    ).not.toBeInTheDocument();
  });
});
