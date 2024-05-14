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

import { isNil } from 'lodash';
import React, { useCallback, useEffect } from 'react';
import { Switch, useLocation } from 'react-router-dom';
import { useAnalytics } from 'use-analytics';
import { CustomEventTypes } from '../../generated/analytics/webAnalyticEventData';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import AppContainer from '../AppContainer/AppContainer';
import Loader from '../common/Loader/Loader';
import { UnAuthenticatedAppRouter } from './UnAuthenticatedAppRouter';

const AppRouter = () => {
  const location = useLocation();

  // web analytics instance
  const analytics = useAnalytics();

  const { isAuthenticated, isApplicationLoading } = useApplicationStore();

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
   * */
  if (isApplicationLoading) {
    return <Loader fullScreen />;
  }

  return (
    <Switch>
      {isAuthenticated ? <AppContainer /> : <UnAuthenticatedAppRouter />}
    </Switch>
  );
};

export default AppRouter;
