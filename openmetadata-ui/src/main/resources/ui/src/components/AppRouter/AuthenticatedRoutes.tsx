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
import { Navigate, Route, Routes } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { APP_ROUTER_ROUTES } from '../../constants/router.constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import AccessNotAllowedPage from '../../pages/AccessNotAllowedPage/AccessNotAllowedPage';
import { LogoutPage } from '../../pages/LogoutPage/LogoutPage';
import PageNotFound from '../../pages/PageNotFound/PageNotFound';
import SamlCallback from '../../pages/SamlCallback';
import SignUpPage from '../../pages/SignUp/SignUpPage';
import AppContainer from '../AppContainer/AppContainer';
import { useApplicationsProvider } from '../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { RoutePosition } from '../Settings/Applications/plugins/AppPlugin';

export const AuthenticatedRoutes = () => {
  const { currentUser } = useApplicationStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
    }))
  );

  const { plugins = [] } = useApplicationsProvider() ?? {};

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

      {/* Render APP position plugin routes (they handle their own layouts) */}
      {plugins?.flatMap((plugin) => {
        const routes = plugin.getRoutes?.() || [];
        // Filter routes with APP position
        const appRoutes = routes.filter(
          (route) => route.position === RoutePosition.APP
        );

        return appRoutes.map((route, idx) => (
          <Route key={`${plugin.name}-app-${idx}`} {...route} />
        ));
      })}

      <Route element={<AppContainer />} path="*" />
    </Routes>
  );
};
