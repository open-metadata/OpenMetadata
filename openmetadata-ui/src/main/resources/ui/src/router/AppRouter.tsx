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

import { AxiosError } from 'axios';
import { SlackChatConfig } from 'Models';
import React, { useEffect, useState } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { useAuthContext } from '../authentication/auth-provider/AuthProvider';
import { fetchSlackConfig } from '../axiosAPIs/miscAPI';
import Loader from '../components/Loader/Loader';
import SlackChat from '../components/SlackChat/SlackChat';
import { ROUTES } from '../constants/constants';
import { AuthTypes } from '../enums/signin.enum';
import AccountActivationConfirmation from '../pages/signup/account-activation-confirmation.component';
import withSuspenseFallback from './withSuspenseFallback';

const AuthenticatedAppRouter = withSuspenseFallback(
  React.lazy(() => import('./AuthenticatedAppRouter'))
);
const SigninPage = withSuspenseFallback(
  React.lazy(() => import('../pages/login'))
);
const PageNotFound = withSuspenseFallback(
  React.lazy(() => import('../pages/page-not-found'))
);

const ForgotPassword = withSuspenseFallback(
  React.lazy(() => import('../pages/forgot-password/forgot-password.component'))
);

const ResetPassword = withSuspenseFallback(
  React.lazy(() => import('../pages/reset-password/reset-password.component'))
);

const BasicSignupPage = withSuspenseFallback(
  React.lazy(() => import('../pages/signup/basic-signup.component'))
);

const AppRouter = () => {
  const {
    authConfig,
    isAuthDisabled,
    isAuthenticated,
    loading,
    isSigningIn,
    getCallBackComponent,
  } = useAuthContext();

  const [slackConfig, setSlackConfig] = useState<SlackChatConfig | undefined>();
  const callbackComponent = getCallBackComponent();
  const oidcProviders = [
    AuthTypes.GOOGLE,
    AuthTypes.AWS_COGNITO,
    AuthTypes.CUSTOM_OIDC,
  ];
  const isOidcProvider =
    authConfig?.provider && oidcProviders.includes(authConfig.provider);

  const fetchSlackChatConfig = () => {
    fetchSlackConfig()
      .then((res) => {
        if (res.data) {
          const { slackUrl } = res.data;
          const slackConfig = {
            slackUrl,
          };
          setSlackConfig(slackConfig);
        } else {
          throw '';
        }
      })
      .catch((err: AxiosError) => {
        // eslint-disable-next-line no-console
        console.error(err);
        setSlackConfig(undefined);
      });
  };

  useEffect(() => {
    fetchSlackChatConfig();
  }, []);

  const slackChat =
    slackConfig && slackConfig.slackUrl ? (
      <SlackChat slackConfig={slackConfig} />
    ) : null;

  return loading ? (
    <Loader />
  ) : (
    <>
      {isOidcProvider || isAuthenticated ? (
        <>
          <AuthenticatedAppRouter />
          {slackChat}
        </>
      ) : (
        <>
          {slackChat}
          <Switch>
            <Route exact component={BasicSignupPage} path={ROUTES.REGISTER} />

            {callbackComponent ? (
              <Route component={callbackComponent} path={ROUTES.CALLBACK} />
            ) : null}
            <Route exact path={ROUTES.HOME}>
              {!isAuthDisabled && !isAuthenticated && !isSigningIn ? (
                <>
                  <Redirect to={ROUTES.SIGNIN} />
                  <Route
                    exact
                    component={ForgotPassword}
                    path={ROUTES.FORGOT_PASSWORD}
                  />
                  <Route
                    exact
                    component={ResetPassword}
                    path={ROUTES.RESET_PASSWORD}
                  />
                  <Route
                    exact
                    component={AccountActivationConfirmation}
                    path={ROUTES.ACCOUNT_ACTIVATION}
                  />
                </>
              ) : (
                <Redirect to={ROUTES.MY_DATA} />
              )}
            </Route>
            {!isSigningIn ? (
              <>
                <Route exact component={SigninPage} path={ROUTES.SIGNIN} />
                <Route
                  exact
                  component={ForgotPassword}
                  path={ROUTES.FORGOT_PASSWORD}
                />
                <Route
                  exact
                  component={ResetPassword}
                  path={ROUTES.RESET_PASSWORD}
                />
                <Route
                  exact
                  component={AccountActivationConfirmation}
                  path={ROUTES.ACCOUNT_ACTIVATION}
                />
              </>
            ) : null}
            {isAuthDisabled || isAuthenticated ? (
              <AuthenticatedAppRouter />
            ) : (
              <>
                <Redirect to={ROUTES.SIGNIN} />
                <Route
                  exact
                  component={ForgotPassword}
                  path={ROUTES.FORGOT_PASSWORD}
                />
                <Route
                  exact
                  component={ResetPassword}
                  path={ROUTES.RESET_PASSWORD}
                />
                <Route
                  exact
                  component={AccountActivationConfirmation}
                  path={ROUTES.ACCOUNT_ACTIVATION}
                />
              </>
            )}
            <Route exact component={PageNotFound} path={ROUTES.NOT_FOUND} />
          </Switch>
        </>
      )}
    </>
  );
};

export default AppRouter;
