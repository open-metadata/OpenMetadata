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

import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
} from 'react';
import { oidcTokenKey } from '../../../constants/constants';
import { postSamlLogout } from '../../../rest/miscAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { SamlSSOClientConfig } from '../../generated/security/client/samlSSOClientConfig';
import { useAuthContext } from '../auth-provider/AuthProvider';
import { AuthenticatorRef } from '../auth-provider/AuthProvider.interface';

interface Props {
  children: ReactNode;
  onLogoutSuccess: () => void;
}

const SamlAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLogoutSuccess }: Props, ref) => {
    const { setIsAuthenticated, authConfig } = useAuthContext();
    const config: SamlSSOClientConfig = authConfig.samlConfiguration;

    const login = async () => {
      if (config.idp.authorityUrl) {
        window.location.href = config.idp.authorityUrl;
      } else {
        showErrorToast('SAML IDP Authority URL is not configured.');
      }
    };

    const logout = () => {
      const token = localStorage.getItem(oidcTokenKey);
      if (token) {
        postSamlLogout({ token })
          .then(() => {
            setIsAuthenticated(false);
            try {
              onLogoutSuccess();
            } catch (err) {
              // TODO: Handle error on logout failure
              // eslint-disable-next-line no-console
              console.log(err);
            }
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.log('Error while logging out', err);
          });
      }
    };

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        login();
      },
      invokeLogout() {
        logout();
      },
      async renewIdToken() {
        return Promise.resolve('');
      },
    }));

    return <Fragment>{children}</Fragment>;
  }
);

SamlAuthenticator.displayName = 'SamlAuthenticator';

export default SamlAuthenticator;
