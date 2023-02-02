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

import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getUserByName } from 'rest/userAPI';
import BotDetailsPage from './BotDetailsPage';

const mockUserDetail = {
  id: 'cb3db26a-5e01-4d14-8f06-bb1040c28ad0',
  name: 'customermail2020',
  displayName: '',
  version: 0.1,
  updatedAt: 1652179111681,
  updatedBy: 'anonymous',
  email: 'customermail2020@gmail.com',
  href: 'http://localhost:8585/api/v1/users/cb3db26a-5e01-4d14-8f06-bb1040c28ad0',
  isBot: true,
  isAdmin: false,
  deleted: false,
};

const botData = {
  id: '4755f87d-2a53-4376-97e6-fc072f29cf5a',
  name: 'ingestion-bot',
  fullyQualifiedName: 'ingestion-bot',
  displayName: 'ingestion-bot',
  botUser: {
    id: 'b91d42cb-2a02-4364-ae80-db08b77f1b0c',
    type: 'user',
    name: 'ingestion-bot',
    fullyQualifiedName: 'ingestion-bot',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/b91d42cb-2a02-4364-ae80-db08b77f1b0c',
  },
  version: 0.1,
  updatedAt: 1664267598781,
  updatedBy: 'ingestion-bot',
  href: 'http://localhost:8585/api/v1/bots/4755f87d-2a53-4376-97e6-fc072f29cf5a',
  deleted: false,
};

jest.mock('components/BotDetails/BotDetails.component', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="bots-details">BotsDetails</div>);
});

jest.mock('rest/userAPI', () => ({
  getBotByName: jest.fn().mockImplementation(() => Promise.resolve(botData)),
  getUserByName: jest.fn().mockImplementation(() => Promise.resolve()),
  revokeUserToken: jest.fn().mockImplementation(() => Promise.resolve()),
  updateUserDetail: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
  }),
}));

describe('Test BotsPage Component', () => {
  it('Should render all child elements', async () => {
    (getUserByName as jest.Mock).mockImplementationOnce(() => {
      return Promise.resolve({ data: mockUserDetail });
    });
    const { findByTestId } = render(<BotDetailsPage />, {
      wrapper: MemoryRouter,
    });

    const botsDetailsComponent = await findByTestId('bots-details');

    expect(botsDetailsComponent).toBeInTheDocument();
  });

  it('Should render error placeholder if API fails', async () => {
    (getUserByName as jest.Mock).mockImplementationOnce(() => {
      return Promise.reject();
    });
    const { findByTestId } = render(<BotDetailsPage />, {
      wrapper: MemoryRouter,
    });

    const errorPlaceholder = await findByTestId('error');

    expect(errorPlaceholder).toBeInTheDocument();
  });
});
