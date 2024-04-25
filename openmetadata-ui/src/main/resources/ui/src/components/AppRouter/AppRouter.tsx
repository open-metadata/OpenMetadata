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
import { useLocation } from 'react-router-dom';
import { useAnalytics } from 'use-analytics';
import { CustomEventTypes } from '../../generated/analytics/webAnalyticEventData';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import AppContainer from '../AppContainer/AppContainer';
import { UnAuthenticatedAppRouter } from './UnAuthenticatedAppRouter';
import withSuspenseFallback from './withSuspenseFallback';

const PageNotFound = withSuspenseFallback(
  React.lazy(() => import('../../pages/PageNotFound/PageNotFound'))
);

const AppRouter = () => {
  const location = useLocation();

  // web analytics instance
  const analytics = useAnalytics();

  const { isAuthenticated } = useApplicationStore();

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

  return isAuthenticated ? <AppContainer /> : <UnAuthenticatedAppRouter />;
};

export default AppRouter;
