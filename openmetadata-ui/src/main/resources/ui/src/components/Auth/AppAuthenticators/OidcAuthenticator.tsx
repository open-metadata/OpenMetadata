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

import { User, UserManager, WebStorageStateStore } from 'oidc-client';
import {
  ComponentType,
  forwardRef,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
} from 'react';
import { Callback, makeAuthenticator, makeUserManager } from 'react-oidc';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import SignInPage from '../../../pages/LoginPage/SignInPage';
import { authCoordinator, Renewer } from '../../../utils/Auth/AuthCoordinator';
import { setOidcToken } from '../../../utils/SwTokenStorageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import { useAuthProvider } from '../AuthProviders/AuthProvider';
import {
  AuthenticatorRef,
  OidcUser,
} from '../AuthProviders/AuthProvider.interface';

interface Props {
  childComponentType: ComponentType;
  children: ReactNode;
  userConfig: Record<string, string | boolean | WebStorageStateStore>;
}

const getAuthenticator = (type: ComponentType, userManager: UserManager) => {
  return makeAuthenticator({
    userManager: userManager,
    signinArgs: {
      app: 'openmetadata',
    },
  })(type);
};

// Safari ITP blocks third-party cookies inside the silent-renew iframe, so the
// postMessage callback never reaches the parent window and oidc-client's
// IFrameWindow rejects with a plain Error naming the frame itself (e.g.
// "Frame window timed out", "Invalid response from frame") rather than an
// ErrorResponse carrying an IdP authorization decision (login_required,
// consent_required, ...). Only that class of failure should fall back to a
// visible signinPopup — any other rejection is rethrown untouched.
const isFrameError = (error: unknown): boolean =>
  error instanceof Error && /frame/i.test(error.message);

const OidcCallbackWrapper = ({
  userManager,
  onError,
  onSuccess,
}: {
  userManager: UserManager;
  onError: (error: Error) => void;
  onSuccess: (user: User) => void;
}) => {
  const CallbackComponent = Callback as unknown as ComponentType<{
    userManager: UserManager;
    onError: (error: Error) => void;
    onSuccess: (user: User) => void;
  }>;

  return (
    <CallbackComponent
      userManager={userManager}
      onError={onError}
      onSuccess={onSuccess}
    />
  );
};

const OidcAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ childComponentType, children, userConfig }: Props, ref) => {
    const {
      isAuthenticated,
      isSigningUp,
      setIsSigningUp,
      isApplicationLoading,
    } = useApplicationStore();
    const {
      handleFailedLogin,
      handleSuccessfulLogin,
      handleSuccessfulLogout,
      updateAxiosInterceptors,
    } = useAuthProvider();

    const location = useCustomLocation();
    const userManager = useMemo(
      () => makeUserManager({ ...userConfig, silentRequestTimeout: 20000 }),
      [userConfig]
    );

    const login = () => {
      // Clear any stale state in the user manager before starting the sign in flow
      // Remove the existing user configuration for the user who is different from the user trying to log in
      userManager.clearStaleState();
      // Remove the existing user configuration for the same user who is trying to log
      userManager.removeUser();
      setIsSigningUp(true);
    };

    const logout = async () => {
      return new Promise<void>((resolve, reject) => {
        userManager.metadataService.getEndSessionEndpoint().then((endpoint) => {
          if (endpoint) {
            // Perform singout from sso if endSessionEndpointAvailable
            userManager
              .signoutRedirect({
                post_logout_redirect_uri:
                  window.location.origin + ROUTES.SIGNIN,
              })
              .then(() => {
                // Cleanup application state
                handleSuccessfulLogout();
                resolve();
              })
              .catch((error) => {
                reject(error);
              });
          } else {
            try {
              // If signout fails, still clean up local state
              userManager.removeUser().then(resolve);
            } finally {
              // Cleanup application state
              handleSuccessfulLogout();
            }
          }
        });
      });
    };

    // Performs silent signIn and returns with IDToken
    const signInSilently = async () => {
      try {
        // Token will be coming as silent-callback via an iframe
        await userManager.signinSilent();
      } catch (error) {
        // Silent iframe renewal failed (e.g., Safari ITP blocking third-party cookies)
        // Fall back to popup which is a visible first-party navigation
        const user = await userManager.signinPopup();
        await setOidcToken(user.id_token);
        updateAxiosInterceptors();
      }
    };

    // Silent-callback iframe onSuccess handler. Intentionally does NOT
    // write the id_token to storage — the parent-tab AuthCoordinator owns
    // that mirror (via its Renewer contract) after `userManager.signinSilent()`
    // resolves on the parent side. Writing here would double-write the
    // same id_token, run inside the iframe's React tree, and re-register
    // an axios interceptor inside a hidden iframe context. oidc-client
    // still requires an onSuccess callback to be passed to <Callback>, so
    // we keep this handler as a no-op placeholder.
    const handleSilentSignInSuccess = async (_user: User) => {
      void _user;
    };

    const handleSilentSignInFailure = (error: unknown) => {
      // eslint-disable-next-line no-console
      console.error(error);

      try {
        userManager.removeUser();
      } finally {
        // If silent sign in fails, we need to logout the user
        handleSuccessfulLogout();
      }
    };

    // Bridges to the AuthCoordinator Renewer contract (auth-coordinator-refactor
    // Task 9). Kept alongside signInSilently/renewIdToken until every
    // authenticator is migrated and the old TokenService path is deleted
    // (Task 14). Unlike signInSilently, this does not write to storage itself
    // — the coordinator mirrors the returned {idToken, expiresAt} via
    // setOidcToken once it has driven the refresh.
    const getRenewer = useCallback(
      (): Renewer => async () => {
        let user: User | undefined;
        try {
          user = await userManager.signinSilent();
        } catch (error) {
          if (!isFrameError(error)) {
            throw error;
          }
          user = await userManager.signinPopup();
        }

        if (!user?.id_token) {
          throw new Error('signinSilent returned no id_token');
        }

        return {
          idToken: user.id_token,
          expiresAt: (user.expires_at ?? 0) * 1000,
        };
      },
      [userManager]
    );

    useImperativeHandle(ref, () => ({
      invokeLogin: login,
      invokeLogout: logout,
      renewIdToken: signInSilently,
    }));

    // Register the coordinator renewer directly from this authenticator's
    // own mount effect (avoids the ref-based race in the parent).
    useEffect(() => {
      authCoordinator.registerRenewer(getRenewer());

      return () => authCoordinator.registerRenewer(null);
    }, [getRenewer]);

    const AppWithAuth = getAuthenticator(
      childComponentType,
      userManager
    ) as unknown as ComponentType;

    return (
      <>
        <Routes>
          {/* render the sign in route only if user is not signing up */}
          <Route
            element={isSigningUp ? <AppWithAuth /> : <SignInPage />}
            path={ROUTES.SIGNIN}
          />
          {/* callback route to handle the auth flow after user has successfully provided their consent */}
          <Route
            element={
              <OidcCallbackWrapper
                userManager={userManager}
                onError={(error: Error) => {
                  showErrorToast(error?.message);
                  handleFailedLogin();
                }}
                onSuccess={(user: User) => {
                  (async () => {
                    await setOidcToken(user.id_token);
                    handleSuccessfulLogin(user as OidcUser);
                  })();
                }}
              />
            }
            path={ROUTES.CALLBACK}
          />
          {/* silent callback route to handle the silent auth flow */}
          <Route
            element={
              <OidcCallbackWrapper
                userManager={userManager}
                onError={handleSilentSignInFailure}
                onSuccess={handleSilentSignInSuccess}
              />
            }
            path={ROUTES.SILENT_CALLBACK}
          />

          <Route
            element={
              !location.pathname.includes(ROUTES.SILENT_CALLBACK) &&
              // render the children only if user is authenticated
              (isAuthenticated ? (
                !location.pathname.includes(ROUTES.SILENT_CALLBACK) && (
                  <Fragment>{children}</Fragment>
                )
              ) : (
                <Navigate to={ROUTES.SIGNIN} />
              ))
            }
            path="*"
          />
        </Routes>

        {/* show loader when application is loading and user is signing up*/}
        {isApplicationLoading && isSigningUp && (
          <Fragment>
            <Loader fullScreen />
          </Fragment>
        )}
      </>
    );
  }
);

OidcAuthenticator.displayName = 'OidcAuthenticator';

export default OidcAuthenticator;
