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

import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { getBotByName } from '../../rest/botsAPI';
import { getUserByName } from '../../rest/userAPI';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
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

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({ isAdminUser: true })),
}));

jest.mock(
  '../../components/Settings/Bot/BotDetails/BotDetails.component',
  () => {
    return jest
      .fn()
      .mockReturnValue(<div data-testid="bots-details">BotsDetails</div>);
  }
);

jest.mock('../../rest/botsAPI', () => ({
  getBotByName: jest.fn().mockImplementation(() => Promise.resolve(botData)),
  updateBotDetail: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../rest/userAPI', () => ({
  getUserByName: jest.fn().mockImplementation(() => Promise.resolve()),
  revokeUserToken: jest.fn().mockImplementation(() => Promise.resolve()),
  updateUserDetail: jest.fn().mockImplementation(() => Promise.resolve()),
}));

// BotDetailsPage now fetches its own permissions via useEntityPermissions (Task 8
// batch-final) rather than an imperative usePermissionProvider().getEntityPermissionByFqn
// call — mock the hook directly, mirroring RolesDetailPage.test.tsx's setMockPermissions
// helper.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (overrides: Partial<OperationPermission> = {}) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

describe('Test BotsPage Component', () => {
  beforeEach(() => {
    setMockPermissions({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    });
  });

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

    const errorPlaceholder = await findByTestId('no-data-placeholder');

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('should call useEntityPermissions with the BOT resource', async () => {
    render(<BotDetailsPage />, { wrapper: MemoryRouter });

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.BOT,
      expect.any(String),
      expect.objectContaining({ enabled: expect.any(Boolean) })
    );
  });

  it('should fetch bot data when view access is granted', async () => {
    render(<BotDetailsPage />, { wrapper: MemoryRouter });

    await waitFor(() => expect(getBotByName).toHaveBeenCalled());
  });

  it('should not fetch bot data when view access is denied', async () => {
    setMockPermissions({});
    (getBotByName as jest.Mock).mockClear();

    const { findByTestId } = render(<BotDetailsPage />, {
      wrapper: MemoryRouter,
    });

    // No page-level permission placeholder gates this — old code left botData/botUserData
    // empty and rendered BotDetails regardless; only the fetch itself is gated.
    await findByTestId('bots-details');

    expect(getBotByName).not.toHaveBeenCalled();
  });
});
