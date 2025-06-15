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
import { LoginCallback } from '@okta/okta-react';
import { lazy, useMemo } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { AuthProvider } from '../../generated/configuration/authenticationConfiguration';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import PageNotFound from '../../pages/PageNotFound/PageNotFound';
import AccountActivationConfirmation from '../../pages/SignUp/account-activation-confirmation.component';
import applicationRoutesClass from '../../utils/ApplicationRoutesClassBase';
import Auth0Callback from '../Auth/AppCallbacks/Auth0Callback/Auth0Callback';
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

export const UnAuthenticatedAppRouter = () => {
  const location = useCustomLocation();
  const { authConfig, isSigningUp } = useApplicationStore();

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
    return <Navigate replace to={ROUTES.SIGNIN} />;
  }

  return (
    <Routes>
      <Route element={<SigninPage />} path={ROUTES.SIGNIN} />
      {CallbackComponent && (
        <Route element={<CallbackComponent />} path={ROUTES.CALLBACK} />
      )}
      {!isSigningUp && (
        <Route
          element={<Navigate replace to={ROUTES.SIGNIN} />}
          path={ROUTES.HOME}
        />
      )}
      {/* keep this route before any conditional JSX.Element rendering */}
      <Route element={<PageNotFound />} path={ROUTES.NOT_FOUND} />
      {isBasicAuthProvider && (
        <>
          <Route element={<BasicSignupPage />} path={ROUTES.REGISTER} />
          <Route element={<ForgotPassword />} path={ROUTES.FORGOT_PASSWORD} />
          <Route element={<ResetPassword />} path={ROUTES.RESET_PASSWORD} />
          <Route
            element={<AccountActivationConfirmation />}
            path={ROUTES.ACCOUNT_ACTIVATION}
          />
        </>
      )}
    </Routes>
  );
};
