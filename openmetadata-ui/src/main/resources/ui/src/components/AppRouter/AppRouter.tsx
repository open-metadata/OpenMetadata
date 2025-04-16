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

import { isEmpty, isNil } from 'lodash';
import { useCallback, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAnalytics } from 'use-analytics';
import { ROUTES } from '../../constants/constants';
import { CustomEventTypes } from '../../generated/analytics/webAnalyticEventData';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import AccessNotAllowedPage from '../../pages/AccessNotAllowedPage/AccessNotAllowedPage';
import { LogoutPage } from '../../pages/LogoutPage/LogoutPage';
import PageNotFound from '../../pages/PageNotFound/PageNotFound';
import SamlCallback from '../../pages/SamlCallback';
import SignUpPage from '../../pages/SignUp/SignUpPage';
import AppContainer from '../AppContainer/AppContainer';
import Loader from '../common/Loader/Loader';
import { UnAuthenticatedAppRouter } from './UnAuthenticatedAppRouter';

const AppRouter = () => {
  const location = useCustomLocation();
  const analytics = useAnalytics();
  const { currentUser, isAuthenticated, isApplicationLoading } =
    useApplicationStore();

  useEffect(() => {
    const { pathname } = location;
    if (pathname !== '/' && !isNil(analytics)) {
      analytics.page();
    }
  }, [location.pathname]);

  const handleClickEvent = useCallback(
    (event: MouseEvent) => {
      const eventValue =
        (event.target as HTMLElement)?.textContent || CustomEventTypes.Click;
      if (eventValue && !isNil(analytics)) {
        analytics.track(eventValue);
      }
    },
    [analytics]
  );

  useEffect(() => {
    const targetNode = document.body;
    targetNode.addEventListener('click', handleClickEvent);

    return () => targetNode.removeEventListener('click', handleClickEvent);
  }, [handleClickEvent]);

  if (isApplicationLoading) {
    return <Loader fullScreen />;
  }

  return (
    <Routes>
      <Route element={<PageNotFound />} path={ROUTES.NOT_FOUND} />
      <Route element={<LogoutPage />} path={ROUTES.LOGOUT} />
      <Route element={<AccessNotAllowedPage />} path={ROUTES.UNAUTHORISED} />
      <Route
        element={
          !isEmpty(currentUser) ? (
            <Navigate replace to={ROUTES.HOME} />
          ) : (
            <SignUpPage />
          )
        }
        path={ROUTES.SIGNUP}
      />
      <Route element={<SamlCallback />} path={ROUTES.SAML_CALLBACK} />
      <Route element={<SamlCallback />} path={ROUTES.AUTH_CALLBACK} />
      {isAuthenticated ? (
        <Route element={<AppContainer />} path="*" />
      ) : (
        <Route element={<UnAuthenticatedAppRouter />} path="*" />
      )}
    </Routes>
  );
};

export default AppRouter;
