/*
 *  Copyright 2025 Collate.
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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';

const mockGetUserAccessToken = jest.fn();
const mockUpdateUserAccessToken = jest.fn();
const mockPut = jest.fn();

jest.mock('rest/userAPI', () => ({
  getUserAccessToken: (...a: unknown[]) => mockGetUserAccessToken(...a),
  updateUserAccessToken: (...a: unknown[]) => mockUpdateUserAccessToken(...a),
}));

jest.mock('rest/index', () => ({
  __esModule: true,
  default: { put: (...a: unknown[]) => mockPut(...a) },
}));

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const Select = Object.assign(() => <div data-testid="expiry-select" />, {
    Item: () => null,
  });

  return {
    BadgeWithDot: ({
      children,
      color,
    }: {
      children?: ReactNode;
      color?: string;
    }) => <span data-color={color}>{children}</span>,
    Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Button: ({
      children,
      onClick,
      color,
      isDisabled,
    }: {
      children?: ReactNode;
      onClick?: (...args: unknown[]) => void;
      color?: string;
      isDisabled?: boolean;
    }) => (
      <button data-color={color} disabled={isDisabled} onClick={onClick}>
        {children}
      </button>
    ),
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Skeleton: () => <div data-testid="skeleton" />,
    FeaturedIcon: () => <span data-testid="featured-icon" />,
    Select,
  };
});

jest.mock('@untitledui/icons', () => ({
  Copy01: () => <span />,
  Eye: () => <span />,
  EyeOff: () => <span />,
  Key01: () => <span />,
  Plus: () => <span />,
  RefreshCcw02: () => <span />,
  Trash02: () => <span />,
}));

jest.mock('utils/BotsUtils', () => ({
  getTokenExpiry: () => ({
    tokenExpiryDate: 'Jan 1st, 2030',
    isTokenExpired: false,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import AccessTokenRow from './AccessTokenRow';

describe('AccessTokenRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the empty state with expiry select and generates a token', async () => {
    mockGetUserAccessToken.mockResolvedValue([]);
    mockUpdateUserAccessToken.mockResolvedValue({
      tokenName: 'ai-profile-token',
      token: 'tid',
      jwtToken: 'jwt',
    });

    await act(async () => {
      render(<AccessTokenRow />);
    });

    expect(
      screen.getByText('message.no-access-token-title')
    ).toBeInTheDocument();
    expect(screen.getByTestId('expiry-select')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('label.generate-token'));
    });

    expect(mockUpdateUserAccessToken).toHaveBeenCalledWith({
      JWTTokenExpiry: 'OneHour',
      tokenName: 'ai-profile-token',
    });
  });

  it('revokes the managed token by id (no removeAll)', async () => {
    mockGetUserAccessToken.mockResolvedValue([
      { tokenName: 'ai-profile-token', token: 'tid', jwtToken: 'jwt' },
    ]);
    mockPut.mockResolvedValue({});

    await act(async () => {
      render(<AccessTokenRow />);
    });

    await waitFor(() =>
      expect(screen.getByText('label.revoke')).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByText('label.revoke'));
    });

    expect(mockPut).toHaveBeenCalledWith('/users/security/token/revoke', {
      tokenIds: ['tid'],
    });
  });

  it('renders the revoke button as destructive', async () => {
    mockGetUserAccessToken.mockResolvedValue([
      { tokenName: 'ai-profile-token', token: 'tid', jwtToken: 'jwt' },
    ]);

    await act(async () => {
      render(<AccessTokenRow />);
    });

    await waitFor(() =>
      expect(screen.getByText('label.revoke')).toHaveAttribute(
        'data-color',
        'secondary-destructive'
      )
    );
  });

  it('shows the token header, status and expiry', async () => {
    mockGetUserAccessToken.mockResolvedValue([
      {
        tokenName: 'ai-profile-token',
        token: 'tid',
        jwtToken: 'jwt',
        expiryDate: 1893456000000,
      },
    ]);

    await act(async () => {
      render(<AccessTokenRow />);
    });

    await waitFor(() =>
      expect(screen.getByText('label.collate-api-token')).toBeInTheDocument()
    );

    // Status pill + header sub-label both read "Active" for a live token.
    expect(screen.getAllByText('label.active').length).toBeGreaterThan(0);
    expect(screen.getByText('message.token-expires-on')).toBeInTheDocument();
  });

  it('regenerates by revoking the current token then issuing a new one', async () => {
    mockGetUserAccessToken.mockResolvedValue([
      { tokenName: 'ai-profile-token', token: 'tid', jwtToken: 'jwt' },
    ]);
    mockPut.mockResolvedValue({});
    mockUpdateUserAccessToken.mockResolvedValue({
      tokenName: 'ai-profile-token',
      token: 'tid2',
      jwtToken: 'jwt2',
    });

    await act(async () => {
      render(<AccessTokenRow />);
    });

    await waitFor(() =>
      expect(screen.getByText('label.regenerate')).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByText('label.regenerate'));
    });

    expect(mockPut).toHaveBeenCalledWith('/users/security/token/revoke', {
      tokenIds: ['tid'],
    });
    expect(mockUpdateUserAccessToken).toHaveBeenCalledWith({
      JWTTokenExpiry: 'OneHour',
      tokenName: 'ai-profile-token',
    });
  });
});
