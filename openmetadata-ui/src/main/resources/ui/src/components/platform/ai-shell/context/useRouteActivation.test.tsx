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
import { act, renderHook } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import {
  createRouteActivationStore,
  RouteActivationProvider,
  RouteActivationStore,
} from './RouteActivationContext';
import {
  RouteActivationReason,
  useRouteActivation,
} from './useRouteActivation';

const PATH = '/home';

const renderRouteActivation = (
  store: RouteActivationStore,
  onActivate: (reason: RouteActivationReason) => void,
  maxAgeMs?: number
) => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <RouteActivationProvider store={store}>{children}</RouteActivationProvider>
  );

  return renderHook(
    () => useRouteActivation(onActivate, { path: PATH, maxAgeMs }),
    { wrapper }
  );
};

describe('useRouteActivation reason branch', () => {
  it('fires the activation reason on a plain re-activation', () => {
    const store = createRouteActivationStore();
    const onActivate = jest.fn();
    renderRouteActivation(store, onActivate);

    expect(onActivate).not.toHaveBeenCalled();

    act(() => {
      store.bumpEpoch(PATH);
    });

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith('activation');
  });

  it('upgrades the reason to dirty when a dirty signal is pending on re-activation', () => {
    const store = createRouteActivationStore();
    const onActivate = jest.fn();
    renderRouteActivation(store, onActivate);

    // Marked dirty while the page is not the active route: no immediate fire.
    act(() => {
      store.markRouteDirty(PATH);
    });

    expect(onActivate).not.toHaveBeenCalled();

    act(() => {
      store.bumpEpoch(PATH);
    });

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith('dirty');
  });

  it('upgrades the reason to maxAge when the page has aged past maxAgeMs', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const store = createRouteActivationStore();
    const onActivate = jest.fn();
    renderRouteActivation(store, onActivate, 500);

    nowSpy.mockReturnValue(2000);

    act(() => {
      store.bumpEpoch(PATH);
    });

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith('maxAge');

    nowSpy.mockRestore();
  });
});
