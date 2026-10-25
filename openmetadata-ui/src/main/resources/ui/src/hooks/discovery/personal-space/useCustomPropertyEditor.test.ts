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
import { EntityType } from '../../../enums/entity.enum';
import { CustomProperty } from '../../../generated/type/customProperty';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useCustomPropertyEditor } from './useCustomPropertyEditor';

jest.mock('../../useEntityTypeCustomProperties', () => ({
  useEntityTypeCustomProperties: () => ({
    customProperties: [],
    isLoading: false,
  }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const property = (name: string) =>
  ({
    name,
    propertyType: { id: name, name: 'string', type: 'type' },
  } as CustomProperty);

const A = property('a');
const B = property('b');

const deferred = () => {
  let resolve: (saved: boolean) => void = () => undefined;
  const promise = new Promise<boolean>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

describe('useCustomPropertyEditor', () => {
  it('keeps a row opened during another save open when that save lands', async () => {
    const pending = deferred();
    const onUpdate = jest.fn().mockReturnValue(pending.promise);
    const { result } = renderHook(() =>
      useCustomPropertyEditor({
        entityType: EntityType.USER,
        extension: { a: 'old' },
        onUpdate,
      })
    );

    act(() => result.current.startEditing(A));
    let save: Promise<void> = Promise.resolve();
    act(() => {
      save = result.current.saveValue('new');
    });
    act(() => result.current.startEditing(B));

    await act(async () => {
      pending.resolve(true);
      await save;
    });

    expect(onUpdate).toHaveBeenCalledWith({ a: 'new' });
    expect(result.current.editingProperty).toBe(B);
    expect(result.current.isSaving).toBe(false);
  });

  it('closes the saved row on success', async () => {
    const { result } = renderHook(() =>
      useCustomPropertyEditor({
        entityType: EntityType.USER,
        onUpdate: jest.fn().mockResolvedValue(true),
      })
    );

    act(() => result.current.startEditing(A));
    await act(() => result.current.saveValue('x'));

    expect(result.current.editingProperty).toBeUndefined();
  });

  it('clears saving, keeps the editor open and shows a toast when onUpdate rejects', async () => {
    const error = new Error('boom');
    const { result } = renderHook(() =>
      useCustomPropertyEditor({
        entityType: EntityType.USER,
        onUpdate: jest.fn().mockRejectedValue(error),
      })
    );

    act(() => result.current.startEditing(A));
    await act(() => result.current.saveValue('x'));

    expect(result.current.isSaving).toBe(false);
    expect(result.current.editingProperty).toBe(A);
    expect(showErrorToast).toHaveBeenCalledWith(error);
  });
});
