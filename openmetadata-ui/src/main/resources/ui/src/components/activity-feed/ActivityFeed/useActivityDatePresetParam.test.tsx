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
import { MemoryRouter, useLocation } from 'react-router-dom';
import { getInboxDateRange } from '../../discovery/personal-space/InboxPage/inbox.utils';
import { useActivityDatePresetParam } from './useActivityDatePresetParam';

const renderParam = (url: string) =>
  renderHook(
    () => ({ param: useActivityDatePresetParam(), location: useLocation() }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
      ),
    }
  );

describe('useActivityDatePresetParam', () => {
  it('reads the window from the URL', () => {
    const { result } = renderParam('/t?activityDate=last7days');

    expect(result.current.param[0]).toEqual({
      ...getInboxDateRange(7),
      key: 'last7days',
    });
  });

  // A missing or unknown value is the default, the last 30 days.
  it('reads the last 30 days when the URL has none or an unknown one', () => {
    expect(renderParam('/t').result.current.param[0].key).toBe('last30days');
    expect(
      renderParam('/t?activityDate=bogus').result.current.param[0].key
    ).toBe('last30days');
  });

  it('writes a choice to the URL, keeping its other parameters', () => {
    const { result } = renderParam('/t?taskStatus=all');

    act(() => result.current.param[1]('last7days'));

    expect(result.current.param[0].key).toBe('last7days');
    expect(result.current.location.search).toBe(
      '?taskStatus=all&activityDate=last7days'
    );
  });

  it('drops the parameter for the default window', () => {
    const { result } = renderParam('/t?activityDate=last7days');

    act(() => result.current.param[1]('last30days'));

    expect(result.current.location.search).toBe('');
  });

  // The label and the feed each read it; both must land on one query key.
  it('keeps the same window across renders', () => {
    const { result, rerender } = renderParam('/t');
    const first = result.current.param[0];

    rerender();

    expect(result.current.param[0]).toBe(first);
  });
});
