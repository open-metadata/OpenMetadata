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

import { isEmpty } from 'lodash';
import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { APP_ROUTER_ROUTES } from '../../constants/router.constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import applicationRoutesClass from '../../utils/ApplicationRoutesClassBase';
import Loader from '../common/Loader/Loader';
import withSuspenseFallback from './withSuspenseFallback';

const AuthenticatedApp = withSuspenseFallback(
  lazy(() => import('./AuthenticatedApp'))
);

const AuthenticatedRoutes = withSuspenseFallback(
  lazy(() =>
    import('./AuthenticatedRoutes').then((m) => ({
      default: m.AuthenticatedRoutes,
    }))
  )
);

// Lazy-load infrequently-visited unauthenticated pages
const AccessNotAllowedPage = withSuspenseFallback(
  lazy(() => import('../../pages/AccessNotAllowedPage/AccessNotAllowedPage'))
);

const LogoutPage = withSuspenseFallback(
  lazy(() =>
    import('../../pages/LogoutPage/LogoutPage').then((m) => ({
      default: m.LogoutPage,
    }))
  )
);

const PageNotFound = withSuspenseFallback(
  lazy(() => import('../../pages/PageNotFound/PageNotFound'))
);

const SamlCallback = withSuspenseFallback(
  lazy(() => import('../../pages/SamlCallback'))
);

const SignUpPage = withSuspenseFallback(
  lazy(() => import('../../pages/SignUp/SignUpPage'))
);

const AppRouter = () => {
  const UnAuthenticatedAppRouter =
    applicationRoutesClass.getUnAuthenticatedRouteElements();

  const {
    currentUser,
    isAuthenticated,
    isApplicationLoading,
    isAuthenticating,
  } = useApplicationStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      isAuthenticated: state.isAuthenticated,
      isApplicationLoading: state.isApplicationLoading,
      isAuthenticating: state.isAuthenticating,
    }))
  );

  /**
   * isApplicationLoading is true when the application is loading in AuthProvider
   * and is false when the application is loaded.
   * isAuthenticating is true when determining auth state and false when complete.
   * If the application is loading or authenticating, show the loader.
   * If the user is authenticated, show the AppContainer.
   * If the user is not authenticated, show the UnAuthenticatedAppRouter.
   */
  if (isApplicationLoading || isAuthenticating) {
    return <Loader fullScreen />;
  }

  if (isAuthenticated) {
    return (
      <AuthenticatedApp>
        <AuthenticatedRoutes />
      </AuthenticatedApp>
    );
  }

  return (
    <Routes>
      <Route element={<PageNotFound />} path={APP_ROUTER_ROUTES.NOT_FOUND} />
      <Route element={<LogoutPage />} path={APP_ROUTER_ROUTES.LOGOUT} />
      <Route
        element={<AccessNotAllowedPage />}
        path={APP_ROUTER_ROUTES.UNAUTHORISED}
      />
      <Route
        element={
          isEmpty(currentUser) ? (
            <SignUpPage />
          ) : (
            <Navigate replace to={APP_ROUTER_ROUTES.HOME} />
          )
        }
        path={APP_ROUTER_ROUTES.SIGNUP}
      />
      <Route
        element={<SamlCallback />}
        path={APP_ROUTER_ROUTES.AUTH_CALLBACK}
      />
      <Route element={<UnAuthenticatedAppRouter />} path="*" />
    </Routes>
  );
};

export default AppRouter;
