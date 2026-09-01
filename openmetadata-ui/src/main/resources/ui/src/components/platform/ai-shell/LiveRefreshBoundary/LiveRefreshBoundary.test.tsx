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

import { act, render } from '@testing-library/react';
import React, { useEffect } from 'react';
import { LiveRefreshBoundary } from './LiveRefreshBoundary';
import {
  createRouteActivationStore,
  RouteActivationProvider,
  RouteActivationStore,
} from '../context/RouteActivationContext';

const ROUTE = '/domain';

let mountCount = 0;
const MountCounter = () => {
  useEffect(() => {
    mountCount += 1;
  }, []);

  return <div data-testid="oss-page" />;
};

const renderInRoute = (store: RouteActivationStore) =>
  render(
    <RouteActivationProvider store={store}>
      <LiveRefreshBoundary>
        <MountCounter />
      </LiveRefreshBoundary>
    </RouteActivationProvider>
  );

describe('LiveRefreshBoundary', () => {
  beforeEach(() => {
    mountCount = 0;
  });

  it('remounts the child on a websocket dirty signal', () => {
    const store = createRouteActivationStore();
    store.setActivePath(ROUTE);
    renderInRoute(store);

    expect(mountCount).toBe(1);

    act(() => store.markRouteDirty(ROUTE));

    expect(mountCount).toBe(2); // child remounted → fresh fetch
  });

  it('does NOT remount on plain re-activation or focus (keep-alive preserves state)', () => {
    const store = createRouteActivationStore();
    store.setActivePath(ROUTE);
    renderInRoute(store);

    expect(mountCount).toBe(1);

    act(() => store.bumpEpoch(ROUTE)); // navigate back
    act(() => store.bumpFocus()); // tab refocus

    expect(mountCount).toBe(1);
  });

  it('remounts on reconnect catch-up (markAllRoutesDirty)', () => {
    const store = createRouteActivationStore();
    store.setActivePath(ROUTE);
    renderInRoute(store);

    expect(mountCount).toBe(1);

    act(() => store.markAllRoutesDirty());

    expect(mountCount).toBe(2);
  });
});
