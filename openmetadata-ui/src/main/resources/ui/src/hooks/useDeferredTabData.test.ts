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
import { renderHook } from '@testing-library/react-hooks';
import { useDeferredTabData } from './useDeferredTabData';

describe('useDeferredTabData', () => {
  it('does not fire when the activated tab does not match the gated key', () => {
    const fetcher = jest.fn();
    renderHook(() => useDeferredTabData('queries', 'overview', fetcher));

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fires once when the gated tab is already active on first render', () => {
    const fetcher = jest.fn();
    renderHook(() => useDeferredTabData('queries', 'queries', fetcher));

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fires when the user activates the gated tab from a different tab', () => {
    const fetcher = jest.fn();
    const { rerender } = renderHook(
      ({ activeTab }: { activeTab: string }) =>
        useDeferredTabData('queries', activeTab, fetcher),
      { initialProps: { activeTab: 'overview' } }
    );

    expect(fetcher).not.toHaveBeenCalled();

    rerender({ activeTab: 'queries' });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire on subsequent re-renders while the gated tab stays active', () => {
    const fetcher = jest.fn();
    const { rerender } = renderHook(
      ({ activeTab }: { activeTab: string }) =>
        useDeferredTabData('queries', activeTab, fetcher),
      { initialProps: { activeTab: 'queries' } }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ activeTab: 'queries' });
    rerender({ activeTab: 'queries' });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire when toggling away from the gated tab and back without a reset', () => {
    const fetcher = jest.fn();
    const { rerender } = renderHook(
      ({ activeTab }: { activeTab: string }) =>
        useDeferredTabData('queries', activeTab, fetcher),
      { initialProps: { activeTab: 'queries' } }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ activeTab: 'overview' });
    rerender({ activeTab: 'queries' });

    // Same entity, same fetched data — caller already has the result in state.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('re-arms when a reset dep changes and fires again on the next activation', () => {
    const fetcher = jest.fn();
    const { rerender } = renderHook(
      ({ activeTab, fqn }: { activeTab: string; fqn: string }) =>
        useDeferredTabData('queries', activeTab, fetcher, [fqn]),
      { initialProps: { activeTab: 'queries', fqn: 'svc.db.tbl1' } }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);

    // Move off the tab, then change the entity — counter stays at 1 because the
    // tab is no longer the active one.
    rerender({ activeTab: 'overview', fqn: 'svc.db.tbl1' });
    rerender({ activeTab: 'overview', fqn: 'svc.db.tbl2' });

    expect(fetcher).toHaveBeenCalledTimes(1);

    // Activate the gated tab on the new entity — re-armed, so it fires.
    rerender({ activeTab: 'queries', fqn: 'svc.db.tbl2' });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('fires immediately when a reset dep changes while the gated tab is already active', () => {
    const fetcher = jest.fn();
    const { rerender } = renderHook(
      ({ fqn }: { fqn: string }) =>
        useDeferredTabData('queries', 'queries', fetcher, [fqn]),
      { initialProps: { fqn: 'svc.db.tbl1' } }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);

    // Same active tab, different entity — the badge needs to update without the
    // user toggling the tab off and back on.
    rerender({ fqn: 'svc.db.tbl2' });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not double-fire when a reset dep changes while the gated tab is active', () => {
    const fetcher = jest.fn();
    const { rerender } = renderHook(
      ({ fqn }: { fqn: string }) =>
        useDeferredTabData('queries', 'queries', fetcher, [fqn]),
      { initialProps: { fqn: 'svc.db.tbl1' } }
    );

    rerender({ fqn: 'svc.db.tbl2' });

    // Reset-effect fires (once for new fqn) but the activation effect must NOT
    // also fire in the same render — the reset path sets the once-flag first.
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('with empty reset deps, never re-arms even when the tab is toggled', () => {
    const fetcher = jest.fn();
    const { rerender } = renderHook(
      ({ activeTab }: { activeTab: string }) =>
        useDeferredTabData('queries', activeTab, fetcher),
      { initialProps: { activeTab: 'queries' } }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ activeTab: 'overview' });
    rerender({ activeTab: 'queries' });
    rerender({ activeTab: 'overview' });
    rerender({ activeTab: 'queries' });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('uses the latest fetcher closure on each invocation', () => {
    const firstFetcher = jest.fn();
    const secondFetcher = jest.fn();

    const { rerender } = renderHook(
      ({
        fetcher,
        activeTab,
        fqn,
      }: {
        fetcher: () => void;
        activeTab: string;
        fqn: string;
      }) => useDeferredTabData('queries', activeTab, fetcher, [fqn]),
      {
        initialProps: {
          fetcher: firstFetcher,
          activeTab: 'queries',
          fqn: 'svc.db.tbl1',
        },
      }
    );

    expect(firstFetcher).toHaveBeenCalledTimes(1);
    expect(secondFetcher).not.toHaveBeenCalled();

    // Swap the closure (this is what consumers do every render — useCallback or
    // an inline arrow). The hook must call the latest one when it re-fires.
    rerender({
      fetcher: secondFetcher,
      activeTab: 'queries',
      fqn: 'svc.db.tbl2',
    });

    expect(firstFetcher).toHaveBeenCalledTimes(1);
    expect(secondFetcher).toHaveBeenCalledTimes(1);
  });

  it('does not fire when activeTab is undefined', () => {
    const fetcher = jest.fn();
    renderHook(() => useDeferredTabData('queries', undefined, fetcher));

    expect(fetcher).not.toHaveBeenCalled();
  });
});
