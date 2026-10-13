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
import { render, screen } from '@testing-library/react';
import { OktaCallbackError } from './OktaCallback';

const mockHandleFailedLogin = jest.fn();

jest.mock('@okta/okta-react', () => ({
  LoginCallback: () => null,
}));

jest.mock('../../AuthProviders/AuthProvider', () => ({
  useAuthProvider: () => ({ handleFailedLogin: mockHandleFailedLogin }),
}));

describe('OktaCallbackError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends the user to sign in when a silent re-authentication finds the Okta session ended', () => {
    const { container } = render(
      <OktaCallbackError
        error={Object.assign(new Error('The user is not logged in.'), {
          errorCode: 'login_required',
        })}
      />
    );

    expect(mockHandleFailedLogin).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows any other callback error instead of signing the user out', () => {
    render(
      <OktaCallbackError
        error={Object.assign(new Error('PKCE verifier mismatch'), {
          name: 'AuthSdkError',
          errorCode: 'INTERNAL',
        })}
      />
    );

    expect(
      screen.getByText('AuthSdkError: PKCE verifier mismatch')
    ).toBeInTheDocument();
    expect(mockHandleFailedLogin).not.toHaveBeenCalled();
  });
});
