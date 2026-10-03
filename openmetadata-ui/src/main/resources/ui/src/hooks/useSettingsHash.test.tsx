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
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useSettingsHash } from './useSettingsHash';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/explore']}>{children}</MemoryRouter>
);

describe('useSettingsHash', () => {
  beforeEach(() => {
    // Reset the shared hash between tests; the store re-seeds from it on mount.
    globalThis.location.hash = '';
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
  // identity. An unstable `setHash` propagates into panels' `onNavigate`
  // callbacks and the header-injection effects depending on them, re-firing
  // those effects every render → "Maximum update depth exceeded".
  it('should keep setHash stable when location.search changes', () => {
    const { result } = renderHook(
      () => {
        const navigate = useNavigate();
        const settingsHash = useSettingsHash();

        return { navigate, settingsHash };
      },
      { wrapper }
    );

    const firstSetHash = result.current.settingsHash.setHash;

    act(() => {
      result.current.navigate({ pathname: '/explore', search: '?page=2' });
    });

    expect(result.current.settingsHash.setHash).toBe(firstSetHash);
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

  // Regression: an in-app setHash must NOT be reverted by a later render. The
  // old mirror effect echoed react-router's lagged location.hash back into the
  // store, flipping it to the previous tab/sub-path (infinite oscillation →
  // the custom-properties 'teams' 404 loop).
  it('should not revert an in-app setHash on re-render', () => {
    const { result, rerender } = renderHook(() => useSettingsHash(), {
      wrapper,
    });

    act(() => {
      result.current.setHash('bots');
    });
    rerender();

    expect(result.current.state.tab).toBe('bots');
  });
});
