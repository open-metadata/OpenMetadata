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

import { useAuth0 } from '@auth0/auth0-react';
import { forwardRef, Fragment, ReactNode, useImperativeHandle } from 'react';
import { setOidcToken } from '../../../utils/LocalStorageUtils';
import { useAuthProvider } from '../AuthProviders/AuthProvider';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';

interface Props {
  children: ReactNode;
}

const Auth0Authenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children }: Props, ref) => {
    const { handleSuccessfulLogout } = useAuthProvider();
    const {
      loginWithRedirect,
      getAccessTokenSilently,
      getIdTokenClaims,
      logout,
    } = useAuth0();

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        loginWithRedirect().catch((error) => {
          // eslint-disable-next-line no-console
          console.error(error);
        });
      },
      async invokeLogout() {
        try {
          logout({
            localOnly: true,
          });
        } finally {
          // This will cleanup the application state
          handleSuccessfulLogout();
        }
      },
      async renewIdToken(): Promise<string> {
        let idToken = '';

        // Need to emmit error if this fails
        await getAccessTokenSilently();

        const claims = await getIdTokenClaims();
        if (claims) {
          idToken = claims.__raw;
          setOidcToken(idToken);
        }

        return idToken;
      },
    }));

    return <Fragment>{children}</Fragment>;
  }
);

Auth0Authenticator.displayName = 'Auth0Authenticator';

export default Auth0Authenticator;
