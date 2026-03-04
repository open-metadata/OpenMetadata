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
import '@testing-library/jest-dom/extend-expect';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AuthType,
  JWTTokenExpiry,
} from '../../../../generated/entity/teams/user';
import {
  createUserWithPut,
  generateUserToken,
  getAuthMechanismForBotUser,
  revokeAccessToken,
} from '../../../../rest/userAPI';
import { mockAccessData } from '../mocks/User.mocks';
import AccessTokenCard from './AccessTokenCard.component';

const mockOnSave = jest.fn();

jest.mock('../../Bot/BotDetails/AuthMechanism', () => {
  return jest.fn().mockImplementation(({ onTokenRevoke, onEdit }) => (
    <p>
      AuthMechanism{' '}
      <button data-testid="open-modal-button" onClick={onTokenRevoke}>
        open
      </button>
      <button data-testid="edit-auth-button" onClick={onEdit}>
        edit
      </button>
    </p>
  ));
});

jest.mock('../../Bot/BotDetails/AuthMechanismForm', () => {
  return jest.fn().mockImplementation(({ onSave }) => {
    // Store onSave so tests can trigger it
    mockOnSave.mockImplementation(onSave);

    return (
      <p>
        AuthMechanismForm{' '}
        <button
          data-testid="trigger-save-jwt"
          onClick={() =>
            onSave({
              authType: 'JWT',
              config: { JWTTokenExpiry: 'Seven' },
            })
          }>
          Save JWT
        </button>
        <button
          data-testid="trigger-save-sso"
          onClick={() =>
            onSave({
              authType: 'SSO',
              config: {
                ssoServiceType: 'google',
                authConfig: { secretKey: 'test' },
              },
            })
          }>
          Save SSO
        </button>
      </p>
    );
  });
});

jest.mock('../../../Modals/ConfirmationModal/ConfirmationModal', () => {
  return jest.fn().mockImplementation(({ onConfirm, onCancel, visible }) =>
    visible ? (
      <div data-testid="confirmation-modal">
        <button data-testid="cancel-button" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="confirm-button" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : (
      <div data-testid="closed-confirmation-modal" />
    )
  );
});

jest.mock('../../../../rest/userAPI', () => {
  return {
    getUserAccessToken: jest
      .fn()
      .mockImplementation(() => Promise.resolve([mockAccessData])),
    updateUserAccessToken: jest.fn().mockImplementation(() =>
      Promise.resolve({
        JWTTokenExpiry: 'tesst',
        tokenName: 'test',
      })
    ),
    revokeAccessToken: jest.fn().mockImplementation(() => Promise.resolve()),
    generateUserToken: jest.fn().mockImplementation(() =>
      Promise.resolve({
        JWTToken: 'mock-jwt-token',
        JWTTokenExpiry: JWTTokenExpiry.The7,
        JWTTokenExpiresAt: 1234567890,
      })
    ),
    createUserWithPut: jest.fn().mockImplementation(() =>
      Promise.resolve({
        id: 'bot-user-id',
        name: 'test-bot',
        email: 'test-bot@email.com',
      })
    ),
    getAuthMechanismForBotUser: jest.fn().mockImplementation(() =>
      Promise.resolve({
        authType: AuthType.Jwt,
        config: {
          JWTToken: 'existing-jwt-token',
          JWTTokenExpiry: JWTTokenExpiry.Unlimited,
        },
      })
    ),
  };
});

const mockBotUserData = {
  id: 'bot-user-id-123',
  name: 'test-bot-user',
  displayName: 'Test Bot User',
  email: 'test-bot@email.com',
  isBot: true,
  isAdmin: false,
  timezone: 'UTC',
  description: 'A test bot user',
  profile: { images: {} },
  authenticationMechanism: {
    authType: AuthType.Jwt,
    config: {
      JWTToken: 'existing-token',
      JWTTokenExpiry: JWTTokenExpiry.Unlimited,
    },
  },
};

const mockBotData = {
  id: 'bot-id-123',
  name: 'test-bot',
  displayName: 'Test Bot',
  botUser: { id: 'bot-user-id-123', type: 'user', name: 'test-bot-user' },
};

describe('AccessTokenCard Component', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render initial state with AuthMechanism', async () => {
    render(<AccessTokenCard isBot={false} />);

    expect(await screen.findByText('AuthMechanism')).toBeInTheDocument();
  });

  it('should render AuthMechanism when isAuthMechanismEdit is false', async () => {
    await act(async () => {
      render(<AccessTokenCard isBot={false} />);
    });

    expect(await screen.findByText('AuthMechanism')).toBeInTheDocument();
  });

  it('should call onConfirm when Confirm button is clicked', async () => {
    const mockRevokeAccessToken = revokeAccessToken as jest.Mock;
    render(<AccessTokenCard isBot={false} />);
    const isModalClose = await screen.findByTestId('closed-confirmation-modal');

    expect(isModalClose).toBeInTheDocument();

    const openModalButton = await screen.findByTestId('open-modal-button');
    await act(async () => {
      fireEvent.click(openModalButton);
    });

    const confirmButton = await screen.findByTestId('confirm-button');
    fireEvent.click(confirmButton);

    expect(mockRevokeAccessToken).toHaveBeenCalled();
  });

  it('should call onCancel when Cancel button is clicked', async () => {
    await render(<AccessTokenCard isBot={false} />);
    const isModalClose = await screen.findByTestId('closed-confirmation-modal');

    expect(isModalClose).toBeInTheDocument();

    const openModalButton = await screen.findByTestId('open-modal-button');
    await act(async () => {
      fireEvent.click(openModalButton);
    });
    const cancelButton = await screen.findByTestId('cancel-button');
    fireEvent.click(cancelButton);
    const closedModal = await screen.findByTestId('closed-confirmation-modal');

    expect(closedModal).toBeInTheDocument();
  });
});

describe('AccessTokenCard Bot Token Generation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch auth mechanism for bot user on mount', async () => {
    const mockGetAuthMechanism = getAuthMechanismForBotUser as jest.Mock;

    await act(async () => {
      render(
        <AccessTokenCard
          isBot
          botData={mockBotData}
          botUserData={mockBotUserData}
        />
      );
    });

    expect(mockGetAuthMechanism).toHaveBeenCalledWith('bot-user-id-123');
  });

  it('should call generateUserToken for JWT auth type when saving bot token', async () => {
    const mockGenerateUserToken = generateUserToken as jest.Mock;

    await act(async () => {
      render(
        <AccessTokenCard
          isBot
          botData={mockBotData}
          botUserData={mockBotUserData}
        />
      );
    });

    // Click edit to show the AuthMechanismForm
    const editButton = await screen.findByTestId('edit-auth-button');
    await act(async () => {
      fireEvent.click(editButton);
    });

    // Trigger JWT save from the form
    const saveJwtButton = await screen.findByTestId('trigger-save-jwt');
    await act(async () => {
      fireEvent.click(saveJwtButton);
    });

    expect(mockGenerateUserToken).toHaveBeenCalledWith({
      id: 'bot-user-id-123',
      JWTTokenExpiry: 'Seven',
    });
  });

  it('should fall back to createUserWithPut for non-JWT auth type', async () => {
    const mockCreateUserWithPut = createUserWithPut as jest.Mock;
    const mockGenerateUserToken = generateUserToken as jest.Mock;

    await act(async () => {
      render(
        <AccessTokenCard
          isBot
          botData={mockBotData}
          botUserData={mockBotUserData}
        />
      );
    });

    // Click edit to show the AuthMechanismForm
    const editButton = await screen.findByTestId('edit-auth-button');
    await act(async () => {
      fireEvent.click(editButton);
    });

    // Trigger SSO save from the form
    const saveSsoButton = await screen.findByTestId('trigger-save-sso');
    await act(async () => {
      fireEvent.click(saveSsoButton);
    });

    expect(mockGenerateUserToken).not.toHaveBeenCalled();
    expect(mockCreateUserWithPut).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-bot-user',
        email: 'test-bot@email.com',
        isBot: true,
        botName: 'test-bot',
        authenticationMechanism: expect.objectContaining({
          authType: 'SSO',
          config: expect.objectContaining({
            ssoServiceType: 'google',
          }),
        }),
      })
    );
  });

  it('should handle generateUserToken error gracefully', async () => {
    const mockGenerateUserToken = generateUserToken as jest.Mock;
    mockGenerateUserToken.mockRejectedValueOnce(new Error('Token error'));

    await act(async () => {
      render(
        <AccessTokenCard
          isBot
          botData={mockBotData}
          botUserData={mockBotUserData}
        />
      );
    });

    // Click edit to show the AuthMechanismForm
    const editButton = await screen.findByTestId('edit-auth-button');
    await act(async () => {
      fireEvent.click(editButton);
    });

    // Trigger JWT save which will fail
    const saveJwtButton = await screen.findByTestId('trigger-save-jwt');
    await act(async () => {
      fireEvent.click(saveJwtButton);
    });

    // Should have been called but failed
    expect(mockGenerateUserToken).toHaveBeenCalled();
  });

  it('should call revokeTokenHandlerBot when revoking bot token', async () => {
    const mockRevokeHandler = jest.fn().mockResolvedValue(undefined);

    await act(async () => {
      render(
        <AccessTokenCard
          isBot
          botData={mockBotData}
          botUserData={mockBotUserData}
          revokeTokenHandlerBot={mockRevokeHandler}
        />
      );
    });

    // Open the confirmation modal
    const openModalButton = await screen.findByTestId('open-modal-button');
    await act(async () => {
      fireEvent.click(openModalButton);
    });

    // Confirm the revoke
    const confirmButton = await screen.findByTestId('confirm-button');
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(mockRevokeHandler).toHaveBeenCalled();
  });

  it('should not fetch auth mechanism when disabled', async () => {
    const mockGetAuthMechanism = getAuthMechanismForBotUser as jest.Mock;

    await act(async () => {
      render(
        <AccessTokenCard
          disabled
          isBot
          botData={mockBotData}
          botUserData={mockBotUserData}
        />
      );
    });

    expect(mockGetAuthMechanism).not.toHaveBeenCalled();
  });
});
