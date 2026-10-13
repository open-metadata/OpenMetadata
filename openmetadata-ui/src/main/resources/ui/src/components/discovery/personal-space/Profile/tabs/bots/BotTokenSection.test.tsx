/*
 *  Copyright 2026 Collate.
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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { User } from '../../../../../../generated/entity/teams/user';
import {
  generateUserToken,
  revokeUserToken,
} from '../../../../../../rest/userAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import BotTokenSection from './BotTokenSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../../../../rest/userAPI', () => ({
  generateUserToken: jest.fn().mockResolvedValue({}),
  revokeUserToken: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/BotsUtils', () => ({
  getTokenExpiry: jest.fn().mockReturnValue({
    tokenExpiryDate: '2026-01-01',
    isTokenExpired: false,
  }),
  getTokenIssuedAtMs: jest.fn().mockReturnValue(1704067200000),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// Native mocks avoid react-aria provider requirements and make onPress => onClick.
jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
  Button: ({
    children,
    onPress,
    'data-testid': testId,
    isLoading,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
    isLoading?: boolean;
  }) => (
    <button
      data-loading={isLoading}
      data-testid={testId}
      type="button"
      onClick={onPress}>
      {children}
    </button>
  ),
  Input: ({
    value,
    'data-testid': testId,
  }: {
    value?: string;
    'data-testid'?: string;
  }) => (
    <input readOnly aria-label={testId} data-testid={testId} value={value} />
  ),
  Select: ({ 'data-testid': testId }: { 'data-testid'?: string }) => (
    <div data-testid={testId} />
  ),
  Typography: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span {...props}>{children}</span>
  ),
}));

const mockOnTokenUpdate = jest.fn().mockResolvedValue(undefined);

const mockBotUserDataWithToken: User = {
  id: 'user-1',
  name: 'test-bot-user',
  email: 'test@bot.com',
  authenticationMechanism: {
    config: {
      JWTToken: 'mock-jwt-token-value',
      JWTTokenExpiresAt: 1735689600000,
    },
  },
};

const mockBotUserDataWithoutToken: User = {
  id: 'user-1',
  name: 'test-bot-user',
  email: 'test@bot.com',
};

describe('BotTokenSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn() },
    });
  });

  it('should render JWT token label', () => {
    render(
      <BotTokenSection
        botUserData={mockBotUserDataWithToken}
        onTokenUpdate={mockOnTokenUpdate}
      />
    );

    expect(screen.getByTestId('center-panel')).toBeInTheDocument();
  });

  it('should show revoke button when token exists', () => {
    render(
      <BotTokenSection
        botUserData={mockBotUserDataWithToken}
        onTokenUpdate={mockOnTokenUpdate}
      />
    );

    expect(screen.getByTestId('revoke-button')).toBeInTheDocument();
  });

  it('should show generate button when no token', () => {
    render(
      <BotTokenSection
        botUserData={mockBotUserDataWithoutToken}
        onTokenUpdate={mockOnTokenUpdate}
      />
    );

    expect(screen.getByTestId('auth-mechanism')).toBeInTheDocument();
  });

  it('should show no-token message when no token', () => {
    render(
      <BotTokenSection
        botUserData={mockBotUserDataWithoutToken}
        onTokenUpdate={mockOnTokenUpdate}
      />
    );

    expect(screen.getByTestId('no-token')).toBeInTheDocument();
  });

  it('should display the token created-on timestamp when a token exists', () => {
    render(
      <BotTokenSection
        botUserData={mockBotUserDataWithToken}
        onTokenUpdate={mockOnTokenUpdate}
      />
    );

    expect(screen.getByTestId('token-created-on')).toBeInTheDocument();
  });

  it('should copy the token to the clipboard', () => {
    render(
      <BotTokenSection
        botUserData={mockBotUserDataWithToken}
        onTokenUpdate={mockOnTokenUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('copy-token'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'mock-jwt-token-value'
    );
  });

  it('should revoke the token and refresh on revoke click', async () => {
    render(
      <BotTokenSection
        botUserData={mockBotUserDataWithToken}
        onTokenUpdate={mockOnTokenUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('revoke-button'));

    await waitFor(() => expect(revokeUserToken).toHaveBeenCalledWith('user-1'));

    expect(mockOnTokenUpdate).toHaveBeenCalled();
  });

  it('should generate a token and refresh on generate', async () => {
    render(
      <BotTokenSection
        botUserData={mockBotUserDataWithoutToken}
        onTokenUpdate={mockOnTokenUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('auth-mechanism'));
    fireEvent.click(screen.getByTestId('save-edit'));

    await waitFor(() =>
      expect(generateUserToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' })
      )
    );

    expect(mockOnTokenUpdate).toHaveBeenCalled();
  });

  it('should show an error toast when generation fails', async () => {
    (generateUserToken as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    render(
      <BotTokenSection
        botUserData={mockBotUserDataWithoutToken}
        onTokenUpdate={mockOnTokenUpdate}
      />
    );

    fireEvent.click(screen.getByTestId('auth-mechanism'));
    fireEvent.click(screen.getByTestId('save-edit'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });
});
