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

import { renderHook } from '@testing-library/react';
import { useSelectedAlertSources } from './useObservabilityAlertResources';

const mockUseWatch = jest.fn();

jest.mock('antd', () => ({
  Form: { useWatch: (...args: unknown[]) => mockUseWatch(...args) },
}));

const FORM = {} as Parameters<typeof useSelectedAlertSources>[0];

describe('useSelectedAlertSources', () => {
  beforeEach(() => {
    mockUseWatch.mockReset();
  });

  // The AI alert form copies its sources into the form with no field for them, and a watch
  // without preserve sees only fields that are mounted.
  it('reads the chosen sources from the whole form store', () => {
    renderHook(() => useSelectedAlertSources(FORM));

    expect(mockUseWatch).toHaveBeenCalledWith(
      ['resources'],
      expect.objectContaining({ form: FORM, preserve: true })
    );
  });

  it('hands every chosen source and the choices so far to the caller', () => {
    const input = { filters: [{ name: 'filterByOwnerName' }] };
    mockUseWatch.mockImplementation((name) =>
      name === 'input' ? input : ['table', 'topic']
    );

    const { result } = renderHook(() => useSelectedAlertSources(FORM));

    expect(result.current).toEqual({ sources: ['table', 'topic'], input });
  });
});
