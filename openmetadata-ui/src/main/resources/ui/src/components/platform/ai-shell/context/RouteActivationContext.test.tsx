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
import { render, screen } from '@testing-library/react';
import {
  createRouteActivationStore,
  RouteActivationProvider,
  useRouteActivationStore,
} from './RouteActivationContext';

const PATH = '/home';

describe('createRouteActivationStore', () => {
  it('starts with empty state', () => {
    const store = createRouteActivationStore();

    expect(store.getActivePath()).toBeUndefined();
    expect(store.getActivationEpoch(PATH)).toBe(0);
    expect(store.getFocusEpoch()).toBe(0);
    expect(store.getDirtyVersion(PATH)).toBe(0);
  });

  it('tracks the active path', () => {
    const store = createRouteActivationStore();

    store.setActivePath(PATH);

    expect(store.getActivePath()).toBe(PATH);

    store.setActivePath(undefined);

    expect(store.getActivePath()).toBeUndefined();
  });

  it('bumps the activation epoch and notifies path listeners only', () => {
    const store = createRouteActivationStore();
    const home = jest.fn();
    const other = jest.fn();
    store.subscribe(PATH, home);
    store.subscribe('/other', other);

    store.bumpEpoch(PATH);

    expect(store.getActivationEpoch(PATH)).toBe(1);
    expect(home).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it('bumps the focus epoch and notifies every listener', () => {
    const store = createRouteActivationStore();
    const home = jest.fn();
    const other = jest.fn();
    store.subscribe(PATH, home);
    store.subscribe('/other', other);

    store.bumpFocus();

    expect(store.getFocusEpoch()).toBe(1);
    expect(home).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it('marks a single route dirty as a counter', () => {
    const store = createRouteActivationStore();
    const listener = jest.fn();
    store.subscribe(PATH, listener);

    store.markRouteDirty(PATH);
    store.markRouteDirty(PATH);

    expect(store.getDirtyVersion(PATH)).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('marks every known route dirty, including unsubscribed active paths', () => {
    const store = createRouteActivationStore();
    const listener = jest.fn();
    store.subscribe(PATH, listener);
    store.setActivePath('/active');
    store.markRouteDirty('/marked');

    store.markAllRoutesDirty();

    expect(store.getDirtyVersion(PATH)).toBe(1);
    expect(store.getDirtyVersion('/active')).toBe(1);
    expect(store.getDirtyVersion('/marked')).toBe(2);
    expect(store.getDirtyVersion('/unknown')).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes a listener and keeps the others on the same path', () => {
    const store = createRouteActivationStore();
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = store.subscribe(PATH, first);
    store.subscribe(PATH, second);

    unsubscribeFirst();
    store.bumpEpoch(PATH);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('is safe to unsubscribe twice and after the last listener is gone', () => {
    const store = createRouteActivationStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(PATH, listener);

    unsubscribe();
    unsubscribe();
    store.bumpEpoch(PATH);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('RouteActivationProvider', () => {
  const Consumer = () => {
    const store = useRouteActivationStore();

    return <span data-testid="active">{store?.getActivePath() ?? 'none'}</span>;
  };

  it('exposes the store through context', () => {
    const store = createRouteActivationStore();
    store.setActivePath(PATH);

    render(
      <RouteActivationProvider store={store}>
        <Consumer />
      </RouteActivationProvider>
    );

    expect(screen.getByTestId('active')).toHaveTextContent(PATH);
  });

  it('returns null outside a provider', () => {
    render(<Consumer />);

    expect(screen.getByTestId('active')).toHaveTextContent('none');
  });
});
