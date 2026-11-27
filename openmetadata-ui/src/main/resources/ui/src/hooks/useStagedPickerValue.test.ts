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
import { useStagedPickerValue } from './useStagedPickerValue';

const setup = (committed: string | null = 'saved') => {
  const commit = jest.fn();
  const hook = renderHook(() => useStagedPickerValue(committed, commit));

  return { commit, hook };
};

describe('useStagedPickerValue', () => {
  it('shows a pick without committing it until Apply', () => {
    const { commit, hook } = setup();

    act(() => hook.result.current.onChange('picked'));

    expect(hook.result.current.value).toBe('picked');
    expect(commit).not.toHaveBeenCalled();

    act(() => hook.result.current.onApply());

    expect(commit).toHaveBeenCalledWith('picked');
  });

  it.each([
    [
      'Cancel',
      (h: ReturnType<typeof useStagedPickerValue<string | null>>) =>
        h.onCancel(),
    ],
    [
      'a dismissed popover',
      (h: ReturnType<typeof useStagedPickerValue<string | null>>) =>
        h.onOpenChange(false),
    ],
  ])('restores the saved value on %s', (_, close) => {
    const { commit, hook } = setup();

    act(() => hook.result.current.onChange('picked'));
    act(() => close(hook.result.current));

    expect(hook.result.current.value).toBe('saved');
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits a cleared pick', () => {
    const { commit, hook } = setup();

    act(() => hook.result.current.onChange(null));
    act(() => hook.result.current.onApply());

    expect(commit).toHaveBeenCalledWith(null);
  });

  it('does not commit when Apply is pressed with nothing picked', () => {
    const { commit, hook } = setup();

    act(() => hook.result.current.onApply());

    expect(commit).not.toHaveBeenCalled();
  });
});
