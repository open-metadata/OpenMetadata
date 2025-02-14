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
import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
} from 'react';

import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { setOidcToken } from '../../../utils/LocalStorageUtils';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';

interface Props {
  children: ReactNode;
  onLogoutSuccess: () => void;
}

const OktaAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLogoutSuccess }: Props, ref) => {
    const { oktaAuth } = useOktaAuth();
    const { setIsAuthenticated } = useApplicationStore();

    const login = async () => {
      oktaAuth.signInWithRedirect();
    };

    const logout = async () => {
      setIsAuthenticated(false);
      oktaAuth.tokenManager.clear();
      onLogoutSuccess();
    };

    const renewToken = async () => {
      const renewToken = await oktaAuth.token.renewTokens();
      oktaAuth.tokenManager.setTokens(renewToken);
      const newToken =
        renewToken?.idToken?.idToken ?? oktaAuth.getIdToken() ?? '';
      setOidcToken(newToken);

      return Promise.resolve(newToken);
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
