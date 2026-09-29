/*
 *  Copyright 2026 Collate.
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

import { createContext, PropsWithChildren, useContext } from 'react';

// Whether the surrounding route is on-screen; only KeepAliveRoutes sets it false.
const RouteVisibilityContext = createContext<boolean>(true);

export const useIsRouteVisible = (): boolean =>
  useContext(RouteVisibilityContext);

export const RouteVisibilityProvider = ({
  isVisible,
  children,
}: PropsWithChildren<{ isVisible: boolean }>) => (
  <RouteVisibilityContext.Provider value={isVisible}>
    {children}
  </RouteVisibilityContext.Provider>
);
