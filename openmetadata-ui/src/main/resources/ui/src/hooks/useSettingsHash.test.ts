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
import { useSettingsHash } from './useSettingsHash';

const mockNavigate = jest.fn();
let mockHash = '';
let mockSearch = '';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({
    hash: mockHash,
    pathname: '/',
    search: mockSearch,
    state: null,
    key: 'default',
  }),
  useNavigate: () => mockNavigate,
}));

describe('useSettingsHash', () => {
  beforeEach(() => {
    mockHash = '';
    mockSearch = '';
    mockNavigate.mockClear();
    // The hook reads the live URL from `window.location` (not react-router's
    // useLocation), so drive it through the history API.
    window.history.replaceState(null, '', '/');
  });

  it('should return null tab when no hash', () => {
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBeNull();
    expect(result.current.state.subPath).toBe('');
    expect(result.current.state.params).toEqual({});
  });

  it('should parse #notification correctly', () => {
    window.history.replaceState(null, '', '#notification');
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.subPath).toBe('');
    expect(result.current.state.params).toEqual({});
  });

  it('should parse #notification/subpath correctly', () => {
    window.history.replaceState(null, '', '#notification/alerts');
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.subPath).toBe('alerts');
  });

  it('should parse hash with query params', () => {
    window.history.replaceState(
      null,
      '',
      '#notification?page=2&cursorType=after'
    );
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.params).toEqual({
      page: '2',
      cursorType: 'after',
    });
  });

  it('should set hash via setHash', () => {
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.setHash('notification', 'my-alert');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/', search: '', hash: 'notification/my-alert' },
      { replace: true }
    );
  });

  it('should set hash with params', () => {
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.setHash('notification', undefined, { page: '2' });
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/', search: '', hash: 'notification?page=2' },
      { replace: true }
    );
  });

  it('should preserve query string when setting hash', () => {
    window.history.replaceState(null, '', '/?search=foo&bar=1');
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.setHash('notification');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/', search: '?search=foo&bar=1', hash: 'notification' },
      { replace: true }
    );
  });

  it('should clear hash via clearHash', () => {
    mockHash = '#notification';
    window.location.hash = '#notification';
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.clearHash();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/', search: '', hash: '' },
      { replace: true }
    );
  });

  // Deep link opened in a new tab: an initial app/auth redirect can strip the
  // URL hash before the hook's mount sync runs. The captured hash must survive
  // so the personal-space modal still opens on the role/policy detail.
  it('keeps a captured deep-link hash when a later mount sees an empty URL hash', () => {
    window.location.hash = '#access-control/roles-detail/Admin';
    const first = renderHook(() => useSettingsHash());

    expect(first.result.current.state.tab).toBe('access-control');

    first.unmount();

    // Simulate the initial redirect having wiped the URL hash.
    window.location.hash = '';
    const second = renderHook(() => useSettingsHash());

    expect(second.result.current.state.tab).toBe('access-control');
    expect(second.result.current.state.subPath).toBe('roles-detail/Admin');

    // Reset the module-level store so later tests start clean.
    act(() => {
      second.result.current.clearHash();
    });
  });
});
