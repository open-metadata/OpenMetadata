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
import { useTaskStatusParam } from './useTaskStatusParam';

jest.mock('../../discovery/personal-space/InboxPage/useTaskQueue', () => ({
  STATUS_FILTERS: [{ id: 'all' }, { id: 'open' }, { id: 'closed' }],
}));

const renderParam = (url: string) =>
  renderHook(() => ({ param: useTaskStatusParam(), location: useLocation() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
    ),
  });

describe('useTaskStatusParam', () => {
  it('reads the Status from the URL', () => {
    const { result } = renderParam(
      '/table/t/activity_feed/tasks?taskStatus=closed'
    );

    expect(result.current.param[0]).toBe('closed');
  });

  // A missing or unknown value is the default, Open.
  it('reads Open when the URL has none or an unknown one', () => {
    expect(renderParam('/t').result.current.param[0]).toBe('open');
    expect(renderParam('/t?taskStatus=bogus').result.current.param[0]).toBe(
      'open'
    );
  });

  it('writes a choice to the URL, keeping its other parameters', () => {
    const { result } = renderParam('/t?tab=x');

    act(() => result.current.param[1]('all'));

    expect(result.current.param[0]).toBe('all');
    expect(result.current.location.search).toBe('?tab=x&taskStatus=all');
  });

  // Open is the default, so choosing it leaves no parameter behind.
  it('drops the parameter for Open', () => {
    const { result } = renderParam('/t?taskStatus=closed');

    act(() => result.current.param[1]('open'));

    expect(result.current.location.search).toBe('');
  });
});
