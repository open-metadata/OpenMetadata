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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import AddUsersModal from './AddUsersModalV1';

const mockCancel = jest.fn();
const mockSave = jest.fn();
const mockAllUsers = [
  {
    id: 'b0c9cab3-a5bc-42a8-bcb4-cfa1460e1ef4',
    name: 'aaron_johnson0',
    fullyQualifiedName: 'aaron_johnson0',
    displayName: 'Aaron Johnson',
    version: 0.3,
    updatedAt: 1659369350357,
    updatedBy: 'anonymous',
    email: 'aaron_johnson0@gmail.com',
    href: 'http://localhost:8585/api/v1/users/b0c9cab3-a5bc-42a8-bcb4-cfa1460e1ef4',
    isAdmin: false,
    deleted: false,
  },
  {
    id: 'd5ba343a-fd34-4af3-8d3e-cb512a323f35',
    name: 'aaron_singh2',
    fullyQualifiedName: 'aaron_singh2',
    displayName: 'Aaron Singh',
    version: 0.1,
    updatedAt: 1659332218590,
    updatedBy: 'anonymous',
    email: 'aaron_singh2@gmail.com',
    href: 'http://localhost:8585/api/v1/users/d5ba343a-fd34-4af3-8d3e-cb512a323f35',
    isAdmin: false,
    deleted: false,
  },
  {
    id: '189850b8-97f9-4d52-ace8-769c90a48319',
    name: 'aaron_warren5',
    fullyQualifiedName: 'aaron_warren5',
    displayName: 'Aaron Warren',
    version: 0.1,
    updatedAt: 1659332218666,
    updatedBy: 'anonymous',
    email: 'aaron_warren5@gmail.com',
    href: 'http://localhost:8585/api/v1/users/189850b8-97f9-4d52-ace8-769c90a48319',
    isAdmin: false,
    deleted: false,
  },
  {
    id: '54b0ae87-4ddf-4cb9-85a1-1cd6b28db8ee',
    name: 'adam_matthews2',
    fullyQualifiedName: 'adam_matthews2',
    displayName: 'Adam Matthews',
    version: 0.1,
    updatedAt: 1659332218744,
    updatedBy: 'anonymous',
    email: 'adam_matthews2@gmail.com',
    href: 'http://localhost:8585/api/v1/users/54b0ae87-4ddf-4cb9-85a1-1cd6b28db8ee',
    isAdmin: false,
    deleted: false,
  },
  {
    id: 'aba1a593-3788-40ce-a725-c2f26663542e',
    name: 'adam_rodriguez9',
    fullyQualifiedName: 'adam_rodriguez9',
    displayName: 'Adam Rodriguez',
    version: 0.1,
    updatedAt: 1659332218824,
    updatedBy: 'anonymous',
    email: 'adam_rodriguez9@gmail.com',
    href: 'http://localhost:8585/api/v1/users/aba1a593-3788-40ce-a725-c2f26663542e',
    isAdmin: false,
    deleted: false,
  },
];
const mockUserList = [
  {
    description: 'Robert Mitchell',
    href: 'href',
    id: 'id1',
    name: 'robert_mitchell6',
    type: 'user',
  },
  {
    description: 'Shane Davis',
    href: 'href',
    id: 'id2',
    name: 'shane_davis8',
    type: 'user',
  },
];

jest.mock('components/common/searchbar/Searchbar', () => {
  return jest.fn().mockReturnValue(<p data-testid="searchbar">Searchbar</p>);
});

jest.mock('./UserCard', () => {
  return jest
    .fn()
    .mockImplementation(() => <p data-testid="user-card">UserCard</p>);
});

jest.mock('rest/userAPI', () => {
  return {
    getUsers: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ data: mockAllUsers })),
  };
});

describe('Test AddUsersModal component', () => {
  it('should render modal with required component', async () => {
    await act(async () => {
      render(
        <AddUsersModal
          isVisible
          header="Adding new users"
          list={mockUserList}
          onCancel={mockCancel}
          onSave={mockSave}
        />
      );
    });

    const header = await screen.findByText('Adding new users');
    const searchbar = await screen.findByTestId('searchbar');
    const saveBtn = await screen.findByText(/Save/);
    const cancelBtn = await screen.findByText(/Cancel/);

    expect(saveBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();

    expect(header).toBeInTheDocument();
    expect(searchbar).toBeInTheDocument();
  });

  it('UserCard should be equal to length of list', async () => {
    await act(async () => {
      render(
        <AddUsersModal
          isVisible
          header="Adding new users"
          list={mockUserList}
          onCancel={mockCancel}
          onSave={mockSave}
        />
      );
    });
    const userCard = await screen.findAllByTestId('user-card');

    expect(userCard).toHaveLength(mockAllUsers.length);
  });

  it('Onclick of Discard button, onCancel callback should called', async () => {
    await act(async () => {
      render(
        <AddUsersModal
          isVisible
          header="Adding new users"
          list={mockUserList}
          onCancel={mockCancel}
          onSave={mockSave}
        />
      );
    });
    const discard = await screen.findByText(/Cancel/);
    fireEvent.click(discard);

    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it('Onclick of Save button, onSave callback should called', async () => {
    await act(async () => {
      render(
        <AddUsersModal
          isVisible
          header="Adding new users"
          list={mockUserList}
          onCancel={mockCancel}
          onSave={mockSave}
        />
      );
    });
    const save = await screen.findByText(/Save/);
    fireEvent.click(save);

    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
