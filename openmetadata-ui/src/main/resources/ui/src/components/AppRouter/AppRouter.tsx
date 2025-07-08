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
import applicationRoutesClass from '../../utils/ApplicationRoutesClassBase';
import AppContainer from '../AppContainer/AppContainer';
import Loader from '../common/Loader/Loader';

const AppRouter = () => {
  const location = useCustomLocation();
  const UnAuthenticatedAppRouter =
    applicationRoutesClass.getUnAuthenticatedRouteElements();

  // web analytics instance
  const analytics = useAnalytics();
  const { currentUser, isAuthenticated, isApplicationLoading } =
    useApplicationStore();

  useEffect(() => {
    const { pathname } = location;

    /**
     * Ignore the slash path because we are treating my data as
     * default path.
     * And check if analytics instance is available
     */
    if (pathname !== '/' && !isNil(analytics)) {
      // track page view on route change
      analytics.page();
    }
  }, [location.pathname]);

  const handleClickEvent = useCallback(
    (event: MouseEvent) => {
      const eventValue =
        (event.target as HTMLElement)?.textContent || CustomEventTypes.Click;
      /**
       * Ignore the click event if the event value is undefined
       * And analytics instance is not available
       */
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

  /**
   * isApplicationLoading is true when the application is loading in AuthProvider
   * and is false when the application is loaded.
   * If the application is loading, show the loader.
   * If the user is authenticated, show the AppContainer.
   * If the user is not authenticated, show the UnAuthenticatedAppRouter.
   */
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
      {/* When authenticating from an SSO provider page (e.g., SAML Apps), if the user is already logged in,
       * the callbacks should be available. This ensures consistent behavior across different authentication scenarios.
       */}
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
