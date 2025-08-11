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
  forwardRef,
  Fragment,
  ReactNode,
  useCallback,
  useImperativeHandle,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../../../generated/settings/settings';
import {
  AccessTokenResponse,
  getAccessTokenOnExpiry,
} from '../../../rest/auth-API';

import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getRefreshToken,
  setOidcToken,
  setRefreshToken,
} from '../../../utils/LocalStorageUtils';
import Loader from '../../common/Loader/Loader';
import { useBasicAuth } from '../AuthProviders/BasicAuthProvider';

interface BasicAuthenticatorInterface {
  children: ReactNode;
}

const BasicAuthenticator = forwardRef(
  ({ children }: BasicAuthenticatorInterface, ref) => {
    const { handleLogout } = useBasicAuth();
    const { t } = useTranslation();
    const { authConfig, isApplicationLoading } = useApplicationStore();

    const handleSilentSignIn =
      useCallback(async (): Promise<AccessTokenResponse> => {
        const refreshToken = getRefreshToken();

        if (
          authConfig?.provider !== AuthProvider.Basic &&
          authConfig?.provider !== AuthProvider.LDAP
        ) {
          return Promise.reject(
            new Error(t('message.authProvider-is-not-basic'))
          );
        }

        if (!refreshToken) {
          return Promise.reject(new Error(t('message.no-token-available')));
        }

        const response = await getAccessTokenOnExpiry({
          refreshToken: refreshToken as string,
        });

        setRefreshToken(response.refreshToken);
        setOidcToken(response.accessToken);

        return Promise.resolve(response);
      }, [authConfig, getRefreshToken, setOidcToken, setRefreshToken, t]);

    useImperativeHandle(ref, () => ({
      invokeLogout: handleLogout,
      renewIdToken: handleSilentSignIn,
    }));

    /**
     * isApplicationLoading is true when the application is loading in AuthProvider
     * and is false when the application is loaded.
     * If the application is loading, show the loader.
     * If the user is authenticated, show the AppContainer.
     * If the user is not authenticated, show the UnAuthenticatedAppRouter.
     * */
    if (isApplicationLoading) {
      return <Loader fullScreen />;
    }

    return <Fragment>{children}</Fragment>;
  }
);

export default BasicAuthenticator;
