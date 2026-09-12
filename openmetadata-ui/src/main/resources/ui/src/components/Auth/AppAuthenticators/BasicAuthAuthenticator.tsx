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
  useEffect,
  useImperativeHandle,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../../../generated/settings/settings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  AccessTokenResponse,
  getAccessTokenOnExpiry,
} from '../../../rest/auth-API';
import { authCoordinator, Renewer } from '../../../utils/Auth/AuthCoordinator';
import { extractDetailsFromToken } from '../../../utils/AuthProvider.util';
import {
  setOidcToken,
  setRefreshToken,
} from '../../../utils/SwTokenStorageUtils';
import Loader from '../../common/Loader/Loader';
import { useBasicAuth } from '../AuthProviders/BasicAuthContext';

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
        if (
          authConfig?.provider !== AuthProvider.Basic &&
          authConfig?.provider !== AuthProvider.LDAP
        ) {
          return Promise.reject(
            new Error(t('message.authProvider-is-not-basic'))
          );
        }

        const response = await getAccessTokenOnExpiry();

        await setOidcToken(response.accessToken);

        return Promise.resolve(response);
      }, [authConfig, setOidcToken, setRefreshToken, t]);

    // Bridges to the AuthCoordinator Renewer contract (auth-coordinator-refactor
    // Task 7). Kept alongside handleSilentSignIn/renewIdToken until every
    // authenticator is migrated and the old TokenService path is deleted.
    const getRenewer = useCallback(
      (): Renewer => async () => {
        const response = await getAccessTokenOnExpiry();
        const decoded = extractDetailsFromToken(response.accessToken);

        return {
          idToken: response.accessToken,
          expiresAt: (decoded.exp ?? 0) * 1000,
        };
      },
      []
    );

    useImperativeHandle(ref, () => ({
      invokeLogout: handleLogout,
      renewIdToken: handleSilentSignIn,
    }));

    // Register this authenticator's renewer with the AuthCoordinator as soon
    // as the wrapper mounts (which is after the async config fetch + lazy
    // chunk load). Doing it here — instead of via a parent-side effect that
    // reads authenticatorRef.current?.getRenewer — avoids a race: a ref
    // change does not schedule a re-render, so a parent-side dep on it can
    // register late (or never, on some render paths).
    useEffect(() => {
      authCoordinator.registerRenewer(getRenewer());

      return () => authCoordinator.registerRenewer(null);
    }, [getRenewer]);

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
