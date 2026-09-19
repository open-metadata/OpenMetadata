/*
 *  Copyright 2024 Collate.
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
import { ROUTES } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { logoutUser, renewToken } from '../../../rest/LoginAPI';
import { authCoordinator, Renewer } from '../../../utils/Auth/AuthCoordinator';
import { extractDetailsFromToken } from '../../../utils/AuthProvider.util';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
import { useAuthProvider } from '../AuthProviders/AuthProvider';

export const GenericAuthenticator = forwardRef(
  ({ children }: { children: ReactNode }, ref) => {
    const { setIsAuthenticated, setIsSigningUp } = useApplicationStore();
    const { handleSuccessfulLogout } = useAuthProvider();

    const handleLogin = () => {
      setIsAuthenticated(false);
      setIsSigningUp(true);
      const redirectUri = `${window.location.origin}${ROUTES.AUTH_CALLBACK}`;
      window.location.assign(`api/v1/auth/login?redirectUri=${redirectUri}`);
    };

    const handleLogout = async () => {
      try {
        await logoutUser();
      } finally {
        // This will cleanup the application state and redirect to login page
        handleSuccessfulLogout();
      }
    };

    const handleSilentSignIn = async () => {
      const resp = await renewToken();
      await setOidcToken(resp.accessToken);

      return resp;
    };

    // Bridges to the AuthCoordinator Renewer contract (auth-coordinator-refactor
    // Task 8). Kept alongside handleSilentSignIn/renewIdToken until every
    // authenticator is migrated and the old TokenService path is deleted.
    const getRenewer = useCallback(
      (): Renewer => async () => {
        const response = await renewToken();
        if (!response?.accessToken) {
          throw new Error('Renew endpoint returned no accessToken');
        }
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
      invokeLogin: handleLogin,
    }));

    // Register the coordinator renewer directly from this authenticator's
    // own mount effect (avoids the ref-based race in the parent).
    useEffect(() => {
      authCoordinator.registerRenewer(getRenewer());

      return () => authCoordinator.registerRenewer(null);
    }, [getRenewer]);

    return <Fragment>{children}</Fragment>;
  }
);
