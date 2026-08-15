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

import React from 'react';
import { ErrorBoundary as ErrorBoundaryWrapper } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import ErrorFallback from './ErrorFallback';

interface Props {
  children: React.ReactNode;
}

const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const location = useLocation();

  /*
   * Retry renders the URL the user is actually on — sending them to the landing
   * page instead silently discarded whatever they were looking at. `resetKeys`
   * additionally clears a stuck boundary on any route change, so a failure on
   * one page does not swallow the rest of the app.
   */
  return (
    <ErrorBoundaryWrapper
      FallbackComponent={ErrorFallback}
      resetKeys={[location.pathname, location.search]}>
      {children}
    </ErrorBoundaryWrapper>
  );
};

export default ErrorBoundary;
