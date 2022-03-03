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

import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { useAuthContext } from '../auth-provider/AuthProvider';
import Appbar from '../components/app-bar/Appbar';
import Loader from '../components/Loader/Loader';
import { ROUTES } from '../constants/constants';
import { AuthTypes } from '../enums/signin.enum';
import SigninPage from '../pages/login';
import PageNotFound from '../pages/page-not-found';
import AuthenticatedAppRouter from './AuthenticatedAppRouter';

const AppRouter = () => {
  const {
    authConfig,
    isAuthDisabled,
    isAuthenticated,
    loading,
    isSigningIn,
    getCallBackComponent,
  } = useAuthContext();
  const callbackComponent = getCallBackComponent();

  return loading ? (
    <Loader />
  ) : (
    <>
      {authConfig?.provider === AuthTypes.GOOGLE ? (
        <AuthenticatedAppRouter />
      ) : (
        <>
          <Appbar />
          <Switch>
            <Route exact path={ROUTES.HOME}>
              {!isAuthDisabled && !isAuthenticated && !isSigningIn ? (
                <Redirect to={ROUTES.SIGNIN} />
              ) : (
                <Redirect to={ROUTES.MY_DATA} />
              )}
            </Route>
            {!isSigningIn ? (
              <Route exact component={SigninPage} path={ROUTES.SIGNIN} />
            ) : null}
            {callbackComponent ? (
              <Route component={callbackComponent} path={ROUTES.CALLBACK} />
            ) : null}
            <Route exact component={PageNotFound} path={ROUTES.NOT_FOUND} />
            {isAuthDisabled || isAuthenticated ? (
              <AuthenticatedAppRouter />
            ) : (
              <Redirect to={ROUTES.SIGNIN} />
            )}
          </Switch>
        </>
      )}
    </>
  );
};

export default AppRouter;
