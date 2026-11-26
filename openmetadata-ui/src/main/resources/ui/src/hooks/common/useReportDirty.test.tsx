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
import { useReportDirty } from './useReportDirty';

describe('useReportDirty', () => {
  it('reports clean, then dirty, then clean again when the draft returns', () => {
    const onDirtyChange = jest.fn();
    const { rerender } = renderHook(
      ({ draft }) => useReportDirty(draft, onDirtyChange),
      { initialProps: { draft: 'a' } }
    );

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    rerender({ draft: 'ab' });

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    rerender({ draft: 'a' });

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('compares object drafts by value, not identity', () => {
    const onDirtyChange = jest.fn();
    const { rerender } = renderHook(
      ({ draft }) => useReportDirty(draft, onDirtyChange),
      { initialProps: { draft: { rows: [{ a: '1' }] } } }
    );

    rerender({ draft: { rows: [{ a: '1' }] } });

    expect(onDirtyChange).toHaveBeenCalledTimes(1);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    rerender({ draft: { rows: [{ a: '2' }] } });

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });
});
