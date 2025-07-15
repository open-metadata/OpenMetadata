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

import { useOktaAuth } from '@okta/okta-react';
import { forwardRef, Fragment, ReactNode, useImperativeHandle } from 'react';

import { setOidcToken } from '../../../utils/LocalStorageUtils';
import { useAuthProvider } from '../AuthProviders/AuthProvider';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';

interface Props {
  children: ReactNode;
}

const OktaAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children }: Props, ref) => {
    const { oktaAuth } = useOktaAuth();
    const { handleSuccessfulLogout } = useAuthProvider();

    const login = async () => {
      oktaAuth.signInWithRedirect();
    };

    const logout = async () => {
      try {
        // Perform logout on Okta
        oktaAuth.tokenManager.clear();
      } finally {
        // Cleanup application state
        handleSuccessfulLogout();
      }
    };

    const renewToken = async () => {
      const renewToken = await oktaAuth.token.renewTokens();
      oktaAuth.tokenManager.setTokens(renewToken);
      const newToken =
        renewToken?.idToken?.idToken ?? oktaAuth.getIdToken() ?? '';
      setOidcToken(newToken);

      return newToken;
    };

    useImperativeHandle(ref, () => ({
      invokeLogin: login,
      invokeLogout: logout,
      renewIdToken: renewToken,
    }));

    return <Fragment>{children}</Fragment>;
  }
);

OktaAuthenticator.displayName = 'OktaAuthenticator';

export default OktaAuthenticator;
