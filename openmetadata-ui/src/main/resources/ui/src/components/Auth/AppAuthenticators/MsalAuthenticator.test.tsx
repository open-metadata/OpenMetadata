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
import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { render, screen } from '@testing-library/react';
import React, { act } from 'react';
import { msalLoginRequest } from '../../../utils/AuthProvider.util';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import MsalAuthenticator from './MsalAuthenticator';

// Mock MSAL hooks and utilities
jest.mock('@azure/msal-react', () => ({
  useMsal: jest.fn(),
  useAccount: jest.fn(),
}));

jest.mock('../../../utils/AuthProvider.util', () => ({
  msalLoginRequest: {
    scopes: ['test.scope'],
  },
  parseMSALResponse: jest.fn().mockImplementation((response) => ({
    id_token: 'mock-id-token',
    ...response,
  })),
}));

const registerRenewer = jest.fn();

jest.mock('../../../utils/Auth/AuthCoordinator', () => ({
  authCoordinator: {
    registerRenewer: (renewer: unknown) => registerRenewer(renewer),
  },
}));

const mockInstance = {
  loginPopup: jest.fn(),
  loginRedirect: jest.fn(),
  handleRedirectPromise: jest.fn(),
  acquireTokenSilent: jest.fn(),
  acquireTokenPopup: jest.fn(),
  logout: jest.fn(),
};

const mockProps = {
  children: <div>Test Children</div>,
};

const mockHandleSuccessfulLogout = jest.fn();
const mockHandleFailedLogin = jest.fn();
const mockHandleSuccessfulLogin = jest.fn();

jest.mock('../AuthProviders/AuthProvider', () => ({
  useAuthProvider: jest.fn().mockImplementation(() => ({
    handleSuccessfulLogout: mockHandleSuccessfulLogout,
    handleFailedLogin: mockHandleFailedLogin,
    handleSuccessfulLogin: mockHandleSuccessfulLogin,
  })),
}));

describe('MsalAuthenticator', () => {
  let authenticatorRef: AuthenticatorRef | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation for useMsal
    (useMsal as jest.Mock).mockReturnValue({
      instance: mockInstance,
      accounts: [{ username: 'test@example.com' }],
      inProgress: InteractionStatus.None,
    });
  });

  it('should handle login in iframe using popup', async () => {
    // Mock window.self !== window.top for iframe detection
    Object.defineProperty(globalThis, 'self', {
      value: { location: {} },
      writable: true,
    });
    Object.defineProperty(globalThis, 'top', {
      value: { location: {} },
      writable: true,
    });

    mockInstance.loginPopup.mockResolvedValueOnce({
      account: { username: 'test@example.com' },
    });

    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    await act(async () => {
      authenticatorRef?.invokeLogin();
    });

    expect(mockInstance.loginPopup).toHaveBeenCalledWith(msalLoginRequest);
    expect(mockHandleSuccessfulLogin).toHaveBeenCalled();
  });

  it('should handle login in normal window using redirect', async () => {
    // Mock window.self === window.top for normal window detection
    Object.defineProperty(globalThis, 'self', {
      value: globalThis,
      writable: true,
    });
    Object.defineProperty(globalThis, 'top', {
      value: globalThis,
      writable: true,
    });

    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    await act(async () => {
      authenticatorRef?.invokeLogin();
    });

    expect(mockInstance.loginRedirect).toHaveBeenCalledWith(msalLoginRequest);
  });

  it('should handle logout', async () => {
    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    await act(async () => {
      authenticatorRef?.invokeLogout();
    });

    expect(mockHandleSuccessfulLogout).toHaveBeenCalled();
  });

  it('should handle renewIdToken successfully with forceRefresh', async () => {
    mockInstance.acquireTokenSilent.mockResolvedValueOnce({
      account: { username: 'test@example.com' },
      idToken: 'new-token',
    });

    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    const result = await authenticatorRef?.renewIdToken();

    expect(mockInstance.acquireTokenSilent).toHaveBeenCalledWith(
      expect.objectContaining({ forceRefresh: true })
    );
    expect(result).toBe('mock-id-token');
  });

  it('should fall back to acquireTokenPopup when renewIdToken encounters InteractionRequiredAuthError', async () => {
    const interactionError = new InteractionRequiredAuthError(
      'interaction_required'
    );
    mockInstance.acquireTokenSilent.mockRejectedValueOnce(interactionError);
    mockInstance.acquireTokenPopup.mockResolvedValueOnce({
      account: { username: 'test@example.com' },
      idToken: 'popup-token',
    });

    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    const result = await authenticatorRef?.renewIdToken();

    expect(mockInstance.acquireTokenSilent).toHaveBeenCalled();
    expect(mockInstance.acquireTokenPopup).toHaveBeenCalled();
    expect(result).toBe('mock-id-token');
  });

  it('should throw when acquireTokenPopup also fails', async () => {
    const interactionError = new InteractionRequiredAuthError(
      'interaction_required'
    );
    const popupError = new Error('popup_failed');
    mockInstance.acquireTokenSilent.mockRejectedValueOnce(interactionError);
    mockInstance.acquireTokenPopup.mockRejectedValueOnce(popupError);

    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    await expect(authenticatorRef?.renewIdToken()).rejects.toThrow(
      'popup_failed'
    );
    expect(mockInstance.acquireTokenSilent).toHaveBeenCalled();
    expect(mockInstance.acquireTokenPopup).toHaveBeenCalled();
  });

  it('getRenewer normalizes msal response to Renewer contract on the silent path', async () => {
    const expiresOn = new Date(Date.now() + 5 * 60_000);
    mockInstance.acquireTokenSilent.mockResolvedValueOnce({
      idToken: 'azure-fresh',
      expiresOn,
    });

    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    const renewer = registerRenewer.mock.calls.at(-1)?.[0];

    expect(renewer).toBeDefined();

    const result = await renewer?.();

    expect(mockInstance.acquireTokenSilent).toHaveBeenCalledWith(
      expect.objectContaining({ forceRefresh: true })
    );
    expect(mockInstance.acquireTokenPopup).not.toHaveBeenCalled();
    expect(result).toEqual({
      idToken: 'azure-fresh',
      expiresAt: expiresOn.getTime(),
    });
  });

  it('getRenewer falls back to acquireTokenPopup on InteractionRequiredAuthError', async () => {
    const expiresOn = new Date(Date.now() + 5 * 60_000);
    const interactionError = new InteractionRequiredAuthError(
      'interaction_required'
    );
    mockInstance.acquireTokenSilent.mockRejectedValueOnce(interactionError);
    mockInstance.acquireTokenPopup.mockResolvedValueOnce({
      idToken: 'azure-popup-fresh',
      expiresOn,
    });

    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    const renewer = registerRenewer.mock.calls.at(-1)?.[0];
    const result = await renewer?.();

    expect(mockInstance.acquireTokenSilent).toHaveBeenCalled();
    expect(mockInstance.acquireTokenPopup).toHaveBeenCalled();
    expect(result).toEqual({
      idToken: 'azure-popup-fresh',
      expiresAt: expiresOn.getTime(),
    });
  });

  it('getRenewer propagates the error when the popup fallback also fails', async () => {
    const interactionError = new InteractionRequiredAuthError(
      'interaction_required'
    );
    const popupError = new Error('popup_failed');
    mockInstance.acquireTokenSilent.mockRejectedValueOnce(interactionError);
    mockInstance.acquireTokenPopup.mockRejectedValueOnce(popupError);

    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    const renewer = registerRenewer.mock.calls.at(-1)?.[0];

    await expect(renewer?.()).rejects.toThrow('popup_failed');
    expect(mockInstance.acquireTokenSilent).toHaveBeenCalled();
    expect(mockInstance.acquireTokenPopup).toHaveBeenCalled();
  });

  it('getRenewer throws when the msal response has no expiresOn', async () => {
    mockInstance.acquireTokenSilent.mockResolvedValueOnce({
      idToken: 'azure-fresh',
      expiresOn: null,
    });

    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    const renewer = registerRenewer.mock.calls.at(-1)?.[0];

    await expect(renewer?.()).rejects.toThrow(
      'MSAL renewal returned no idToken or expiresOn'
    );
  });

  it('should show loader when interaction is in progress', () => {
    (useMsal as jest.Mock).mockReturnValue({
      instance: mockInstance,
      accounts: [{ username: 'test@example.com' }],
      inProgress: InteractionStatus.Login,
    });

    render(
      <MsalAuthenticator
        {...mockProps}
        ref={(ref) => (authenticatorRef = ref)}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('handleRedirect ref-guard blocks the StrictMode double effect invocation', async () => {
    // React.StrictMode fires mount effects twice in dev, which used to
    // send two concurrent instance.handleRedirectPromise() calls for the
    // same OAuth redirect. Rendering inside <StrictMode> reproduces that
    // shape without a real MSAL instance, and the ref-guard means only
    // the first call actually hits the SDK. Regressing this brings the
    // double /users/loggedInUser fetch back.
    mockInstance.handleRedirectPromise.mockResolvedValueOnce({
      account: { username: 'test@example.com' },
    });

    await act(async () => {
      render(
        <React.StrictMode>
          <MsalAuthenticator
            {...mockProps}
            ref={(ref) => (authenticatorRef = ref)}
          />
        </React.StrictMode>
      );
    });

    expect(mockInstance.handleRedirectPromise).toHaveBeenCalledTimes(1);
    expect(mockHandleSuccessfulLogin).toHaveBeenCalledTimes(1);
  });
});
