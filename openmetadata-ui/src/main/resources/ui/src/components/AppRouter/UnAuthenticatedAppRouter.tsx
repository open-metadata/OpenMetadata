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

import { lazy, useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { APP_ROUTER_ROUTES } from '../../constants/router.constants';
import { AuthProvider } from '../../generated/configuration/authenticationConfiguration';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import applicationRoutesClass from '../../utils/ApplicationRoutesClassBase';
import withSuspenseFallback from './withSuspenseFallback';

const SigninPage = withSuspenseFallback(
  lazy(() => import('../../pages/LoginPage/SignInPage'))
);

const ForgotPassword = withSuspenseFallback(
  lazy(() => import('../../pages/ForgotPassword/ForgotPassword.component'))
);

const ResetPassword = withSuspenseFallback(
  lazy(() => import('../../pages/ResetPassword/ResetPassword.component'))
);

const BasicSignupPage = withSuspenseFallback(
  lazy(() => import('../../pages/SignUp/BasicSignup.component'))
);

const PageNotFound = withSuspenseFallback(
  lazy(() => import('../../pages/PageNotFound/PageNotFound'))
);

const AccountActivationConfirmation = withSuspenseFallback(
  lazy(
    () => import('../../pages/SignUp/account-activation-confirmation.component')
  )
);

const Auth0Callback = withSuspenseFallback(
  lazy(() => import('../Auth/AppCallbacks/Auth0Callback/Auth0Callback'))
);

const LoginCallback = withSuspenseFallback(
  lazy(() =>
    import('@okta/okta-react').then((m) => ({ default: m.LoginCallback }))
  )
);

export const UnAuthenticatedAppRouter = () => {
  const location = useCustomLocation();
  const { authConfig, isSigningUp } = useApplicationStore(
    useShallow((state) => ({
      authConfig: state.authConfig,
      isSigningUp: state.isSigningUp,
    }))
  );

  const isBasicAuthProvider =
    authConfig &&
    (authConfig.provider === AuthProvider.Basic ||
      authConfig.provider === AuthProvider.LDAP);

  const CallbackComponent = useMemo(() => {
    switch (authConfig?.provider) {
      case AuthProvider.Okta: {
        return LoginCallback;
      }
      case AuthProvider.Auth0: {
        return Auth0Callback;
      }
      default: {
        return null;
      }
    }
  }, [authConfig?.provider]);

  if (applicationRoutesClass.isProtectedRoute(location.pathname)) {
    return <Navigate replace to={APP_ROUTER_ROUTES.SIGNIN} />;
  }

  return (
    <Routes>
      <Route element={<SigninPage />} path={APP_ROUTER_ROUTES.SIGNIN} />
      {CallbackComponent && (
        <Route
          element={<CallbackComponent />}
          path={APP_ROUTER_ROUTES.CALLBACK}
        />
      )}
      {!isSigningUp && (
        <Route
          element={<Navigate replace to={APP_ROUTER_ROUTES.SIGNIN} />}
          path={APP_ROUTER_ROUTES.HOME}
        />
      )}
      {/* keep this route before any conditional JSX.Element rendering */}
      <Route element={<PageNotFound />} path={APP_ROUTER_ROUTES.NOT_FOUND} />
      {isBasicAuthProvider && (
        <>
          <Route
            element={<BasicSignupPage />}
            path={APP_ROUTER_ROUTES.REGISTER}
          />
          <Route
            element={<ForgotPassword />}
            path={APP_ROUTER_ROUTES.FORGOT_PASSWORD}
          />
          <Route
            element={<ResetPassword />}
            path={APP_ROUTER_ROUTES.RESET_PASSWORD}
          />
          <Route
            element={<AccountActivationConfirmation />}
            path={APP_ROUTER_ROUTES.ACCOUNT_ACTIVATION}
          />
        </>
      )}
    </Routes>
  );
};
