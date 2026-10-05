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
import { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useSettingsHash } from './useSettingsHash';

// Real MemoryRouter (no react-router mock): the hook drives navigation through
// react-router and reads the live URL hash from `globalThis.location`, so tests
// seed `globalThis.location.hash` and assert the resulting parsed state.
const makeWrapper =
  (initialEntry = '/explore') =>
  ({ children }: { children: ReactNode }) =>
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;

const wrapper = makeWrapper();

describe('useSettingsHash', () => {
  beforeEach(() => {
    // Reset the shared URL hash AND the module-level store between tests so a
    // prior test's hash cannot leak (the mount sync only adopts a non-empty hash).
    globalThis.location.hash = '';
    const { result, unmount } = renderHook(() => useSettingsHash(), {
      wrapper,
    });
    act(() => result.current.clearHash());
    unmount();
  });

  it('should return null tab when no hash', () => {
    const { result } = renderHook(() => useSettingsHash(), { wrapper });

    expect(result.current.state.tab).toBeNull();
    expect(result.current.state.subPath).toBe('');
    expect(result.current.state.params).toEqual({});
  });

  it('should parse #notification correctly', () => {
    globalThis.location.hash = '#notification';
    const { result } = renderHook(() => useSettingsHash(), { wrapper });

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.subPath).toBe('');
  });

  it('should parse #notification/subpath correctly', () => {
    globalThis.location.hash = '#notification/alerts';
    const { result } = renderHook(() => useSettingsHash(), { wrapper });

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.subPath).toBe('alerts');
  });

  it('should parse hash with query params', () => {
    globalThis.location.hash = '#notification?page=2&cursorType=after';
    const { result } = renderHook(() => useSettingsHash(), { wrapper });

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.params).toEqual({
      page: '2',
      cursorType: 'after',
    });
  });

  it('should set the hash via setHash', () => {
    const { result } = renderHook(() => useSettingsHash(), { wrapper });

    act(() => result.current.setHash('notification', 'my-alert'));

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.subPath).toBe('my-alert');
  });

  it('should set the hash with params', () => {
    const { result } = renderHook(() => useSettingsHash(), { wrapper });

    act(() => result.current.setHash('notification', undefined, { page: '2' }));

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.params).toEqual({ page: '2' });
  });

  it('should preserve the surrounding query string when setting a hash', () => {
    const { result } = renderHook(
      () => ({ location: useLocation(), settings: useSettingsHash() }),
      { wrapper: makeWrapper('/explore?search=foo&bar=1') }
    );

    act(() => result.current.settings.setHash('notification'));

    expect(result.current.location.search).toBe('?search=foo&bar=1');
    expect(result.current.location.hash).toBe('#notification');
  });

  it('should clear the hash via clearHash', () => {
    globalThis.location.hash = '#notification';
    const { result } = renderHook(() => useSettingsHash(), { wrapper });

    act(() => result.current.clearHash());

    expect(result.current.state.tab).toBeNull();
  });

  it('should keep setHash/clearHash stable across plain re-renders', () => {
    const { result, rerender } = renderHook(() => useSettingsHash(), {
      wrapper,
    });
    const first = result.current;

    rerender();
    rerender();

    expect(result.current.setHash).toBe(first.setHash);
    expect(result.current.clearHash).toBe(first.clearHash);
  });

  // Regression: when the surrounding page updates `location.search` (e.g. a
  // paginated table writing filters to the URL), `setHash` must NOT change
  // identity, or panels' onNavigate + header-injection effects re-fire every
  // render → "Maximum update depth exceeded".
  it('should keep setHash stable when location.search changes', () => {
    const { result } = renderHook(
      () => ({ navigate: useNavigate(), settings: useSettingsHash() }),
      { wrapper }
    );
    const firstSetHash = result.current.settings.setHash;

    act(() =>
      result.current.navigate({ pathname: '/explore', search: '?page=2' })
    );

    expect(result.current.settings.setHash).toBe(firstSetHash);
  });

  // Browser Back/Forward (and deep-link/refresh) must still drive the store.
  it('should adopt the hash from a browser popstate event', () => {
    const { result } = renderHook(() => useSettingsHash(), { wrapper });

    act(() => {
      globalThis.location.hash = '#members';
      globalThis.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.state.tab).toBe('members');
  });

  // Regression: an in-app setHash must NOT be reverted by a later render.
  it('should not revert an in-app setHash on re-render', () => {
    const { result, rerender } = renderHook(() => useSettingsHash(), {
      wrapper,
    });

    act(() => result.current.setHash('bots'));
    rerender();

    expect(result.current.state.tab).toBe('bots');
  });

  // A react-router navigation to a different route (pushState, no popstate) must
  // resync the store so PersonalSpaceModal closes instead of staying open.
  it('should clear the hash when the route pathname changes', () => {
    const { result } = renderHook(
      () => ({ navigate: useNavigate(), settings: useSettingsHash() }),
      { wrapper }
    );

    act(() => result.current.settings.setHash('members'));

    expect(result.current.settings.state.tab).toBe('members');

    act(() => {
      globalThis.location.hash = '';
      result.current.navigate('/other-page');
    });

    expect(result.current.settings.state.tab).toBeNull();
  });

  // Deep link opened in a new tab: an initial app/auth redirect can strip the
  // URL hash before the hook's mount sync runs. The captured hash must survive.
  it('keeps a captured deep-link hash when a later mount sees an empty URL hash', () => {
    globalThis.location.hash = '#access-control/roles-detail/Admin';
    const first = renderHook(() => useSettingsHash(), { wrapper });

    expect(first.result.current.state.tab).toBe('access-control');

    first.unmount();

    // Simulate the initial redirect having wiped the URL hash.
    globalThis.location.hash = '';
    const second = renderHook(() => useSettingsHash(), { wrapper });

    expect(second.result.current.state.tab).toBe('access-control');
    expect(second.result.current.state.subPath).toBe('roles-detail/Admin');

    act(() => second.result.current.clearHash());
  });
});
