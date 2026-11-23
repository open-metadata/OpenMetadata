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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { usePersonalSpaceStore } from '../../../../../../hooks/usePersonalSpaceStore';
import SettingsFormLayout from './SettingsFormLayout';

const Harness = ({ onCancel }: { onCancel: () => void }) => {
  const form = useForm({ defaultValues: { depth: '' } });

  return (
    <SettingsFormLayout
      form={form}
      isSaving={false}
      showHint={false}
      testId="harness-form"
      onCancel={onCancel}
      onSubmit={jest.fn()}>
      <input data-testid="depth" {...form.register('depth')} />
    </SettingsFormLayout>
  );
};

const makeDirty = () =>
  fireEvent.change(screen.getByTestId('depth'), { target: { value: '5' } });

describe('SettingsFormLayout unsaved changes', () => {
  afterEach(() => usePersonalSpaceStore.getState().setExitGuard(null));

  it('cancels straight away when nothing changed', () => {
    const onCancel = jest.fn();
    render(<Harness onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('asks before Cancel drops changes, and leaves only on Discard', async () => {
    const onCancel = jest.fn();
    render(<Harness onCancel={onCancel} />);
    makeDirty();

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        await screen.findByTestId('unsaved-changes-popover-confirm')
      );
    });

    expect(onCancel).toHaveBeenCalled();
  });

  it('holds a sidebar switch or Esc while dirty', () => {
    render(<Harness onCancel={jest.fn()} />);
    makeDirty();
    const leave = jest.fn();

    let tookOver = false;
    act(() => {
      tookOver = Boolean(usePersonalSpaceStore.getState().exitGuard?.(leave));
    });

    expect(tookOver).toBe(true);
    expect(leave).not.toHaveBeenCalled();
  });
});
