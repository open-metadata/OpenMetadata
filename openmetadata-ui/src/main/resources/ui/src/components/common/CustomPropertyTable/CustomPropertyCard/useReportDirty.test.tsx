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
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { tablePropertyRenderer } from './renderers/TablePropertyValue';
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

  it('reports a table editor dirty after a cell edit and clean after reverting it', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onDirtyChange = jest.fn();
    const { Edit } = tablePropertyRenderer;

    render(
      <Edit
        formId="table-form"
        isSaving={false}
        property={
          {
            name: 'contacts',
            propertyType: { id: 't', name: 'table-cp', type: 'type' },
            customPropertyConfig: { config: { columns: ['name'] } },
          } as CustomProperty
        }
        value={{ columns: ['name'], rows: [{ name: 'Ann' }] }}
        onDirtyChange={onDirtyChange}
        onSave={jest.fn()}
      />
    );

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    const cell = screen.getByTestId('name-0');
    await user.type(cell, 'e');

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.type(cell, '{Backspace}');

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
