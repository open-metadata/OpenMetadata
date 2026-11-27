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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useUnsavedChangesPrompt } from '../../../../../hooks/discovery/personal-space/useUnsavedChangesPrompt';
import UnsavedChangesPrompt from './UnsavedChangesPrompt';

const Harness = ({
  isDirty,
  onLeave,
  onSave,
}: {
  isDirty: boolean;
  onLeave: () => void;
  onSave?: () => Promise<boolean>;
}) => {
  const { runGuarded, promptProps } = useUnsavedChangesPrompt(isDirty, onSave);

  return (
    <>
      <button data-testid="cancel" onClick={() => runGuarded(onLeave)}>
        Cancel
      </button>
      <UnsavedChangesPrompt {...promptProps} />
    </>
  );
};

describe('UnsavedChangesPrompt with useUnsavedChangesPrompt', () => {
  it('leaves a clean form without asking', () => {
    const onLeave = jest.fn();
    render(<Harness isDirty={false} onLeave={onLeave} />);

    fireEvent.click(screen.getByTestId('cancel'));

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId('unsaved-changes-popover')
    ).not.toBeInTheDocument();
  });

  it('asks before a dirty form leaves, and Discard leaves', async () => {
    const onLeave = jest.fn();
    render(<Harness isDirty onLeave={onLeave} />);

    fireEvent.click(screen.getByTestId('cancel'));

    expect(onLeave).not.toHaveBeenCalled();

    fireEvent.click(
      await screen.findByTestId('unsaved-changes-popover-confirm')
    );

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('Continue editing keeps the form open', async () => {
    const onLeave = jest.fn();
    render(<Harness isDirty onLeave={onLeave} />);

    fireEvent.click(screen.getByTestId('cancel'));
    fireEvent.click(
      await screen.findByTestId('unsaved-changes-popover-cancel')
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId('unsaved-changes-popover')
      ).not.toBeInTheDocument()
    );

    expect(onLeave).not.toHaveBeenCalled();
  });

  it('Save & go saves first, then leaves', async () => {
    const onLeave = jest.fn();
    const onSave = jest.fn().mockResolvedValue(true);
    render(<Harness isDirty onLeave={onLeave} onSave={onSave} />);

    fireEvent.click(screen.getByTestId('cancel'));
    fireEvent.click(
      await screen.findByTestId('unsaved-changes-popover-confirm')
    );

    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('stays when the save fails', async () => {
    const onLeave = jest.fn();
    // The editor has already shown the failure toast.
    const onSave = jest.fn().mockResolvedValue(false);
    render(<Harness isDirty onLeave={onLeave} onSave={onSave} />);

    fireEvent.click(screen.getByTestId('cancel'));
    fireEvent.click(
      await screen.findByTestId('unsaved-changes-popover-confirm')
    );

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    expect(onLeave).not.toHaveBeenCalled();
  });

  it('Discard & go leaves without saving when a save is offered', async () => {
    const onLeave = jest.fn();
    const onSave = jest.fn();
    render(<Harness isDirty onLeave={onLeave} onSave={onSave} />);

    fireEvent.click(screen.getByTestId('cancel'));
    fireEvent.click(
      await screen.findByTestId('unsaved-changes-popover-discard')
    );

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
