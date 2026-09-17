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

import React, { PropsWithChildren, useState } from 'react';
import { useRouteActivation } from '../context/useRouteActivation';

/**
 * Live-refresh wrapper for kept-alive pages that don't own a fetch hook — primarily embedded
 * app-mode surfaces (Observability, Governance, Marketplace, Context Center) whose internal data
 * loading we can't reach. On a websocket {@code 'dirty'} signal (a change to an entity type this
 * route shows, routed via the invalidation registry → {@code markRouteDirty}) or {@code 'maxAge'},
 * it remounts the child via a key bump, forcing a fresh fetch.
 *
 * <p>Plain navigate-back / tab-focus does NOT remount — keep-alive deliberately preserves the
 * page's state (scroll, filters); only an actual change (or reconnect catch-up) reloads it.
 */
export const LiveRefreshBoundary = ({ children }: PropsWithChildren) => {
  const [reloadKey, setReloadKey] = useState(0);

  useRouteActivation(
    (reason) => {
      if (reason === 'dirty' || reason === 'maxAge') {
        setReloadKey((key) => key + 1);
      }
    },
    { revalidateOnFocus: false }
  );

  return <React.Fragment key={reloadKey}>{children}</React.Fragment>;
};
