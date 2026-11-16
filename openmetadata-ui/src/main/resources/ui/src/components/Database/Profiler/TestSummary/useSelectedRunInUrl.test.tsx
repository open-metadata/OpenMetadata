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
import { useTestCaseStore } from '../../../DataQuality/IncidentManager/useTestCase.store';
import { useSelectedRunInUrl } from './useSelectedRunInUrl';

const renderSync = (url: string) =>
  renderHook(
    () => {
      useSelectedRunInUrl();

      return useLocation();
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
      ),
    }
  );

describe('useSelectedRunInUrl', () => {
  afterEach(() => {
    act(() => useTestCaseStore.getState().reset());
  });

  it('opens on the run the URL names, as after a reload or from a shared link', () => {
    renderSync('/test-case/fqn?run=1786001601000');

    expect(useTestCaseStore.getState().selectedRunTimestamp).toBe(
      1_786_001_601_000
    );
  });

  it('keeps the URL on the selected run, and drops it for the latest', () => {
    const { result } = renderSync('/test-case/fqn?tab=results');

    act(() => useTestCaseStore.getState().setSelectedRunTimestamp(42));

    expect(result.current.search).toBe('?tab=results&run=42');

    act(() => useTestCaseStore.getState().setSelectedRunTimestamp(undefined));

    expect(result.current.search).toBe('?tab=results');
  });

  it('ignores a run the URL does not name as a number', () => {
    renderSync('/test-case/fqn?run=latest');

    expect(useTestCaseStore.getState().selectedRunTimestamp).toBeUndefined();
  });
});
