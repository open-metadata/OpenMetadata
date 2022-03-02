/*
 *  Copyright 2021 Collate
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
import { useHistory } from 'react-router-dom';
import { useAuthContext } from '../auth-provider/AuthProvider';
import { AuthenticatorRef } from '../auth-provider/AuthProvider.interface';
import { ROUTES } from '../constants/constants';

interface Props {
  children: ReactNode;
  onLogoutSuccess: () => void;
}

export type Ref = ReactNode | HTMLElement | string;

const OktaAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLogoutSuccess }: Props, ref) => {
    const { oktaAuth } = useOktaAuth();
    const { setIsAuthenticated } = useAuthContext();
    const history = useHistory();

    const login = async () => {
      oktaAuth.signInWithRedirect();
    };

    const logout = async () => {
      const basename =
        window.location.origin +
        history.createHref({ pathname: ROUTES.SIGNIN });
      setIsAuthenticated(false);
      try {
        if (localStorage.getItem('okta-token-storage')) {
          await oktaAuth.signOut({ postLogoutRedirectUri: basename });
        }
        localStorage.removeItem('okta-token-storage');
        onLogoutSuccess();
      } catch (err) {
        // TODO: Handle error on logout failure
        // eslint-disable-next-line no-console
        console.log(err);
      }
    };

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        login();
      },
      invokeLogout() {
        logout();
      },
    }));

    return <Fragment>{children}</Fragment>;
  }
);

OktaAuthenticator.displayName = 'OktaAuthenticator';

export default OktaAuthenticator;
