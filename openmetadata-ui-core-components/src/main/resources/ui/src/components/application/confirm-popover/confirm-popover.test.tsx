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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/base/buttons/button';
import { ConfirmPopover } from './confirm-popover';

const renderWithTrigger = (
  props: Partial<React.ComponentProps<typeof ConfirmPopover>> = {}
) =>
  render(
    <ConfirmPopover
      description="This can't be undone."
      title="Delete policy?"
      onConfirm={vi.fn()}
      {...props}>
      <Button>Trash</Button>
    </ConfirmPopover>
  );

describe('ConfirmPopover', () => {
  it('opens from its trigger and shows title, description and default labels', async () => {
    renderWithTrigger();

    expect(screen.queryByTestId('confirm-popover')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Trash' }));

    expect(screen.getByText('Delete policy?')).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.cancel' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.delete' })
    ).toBeInTheDocument();
    // The popover hides the rest of the page from assistive tech while open.
    expect(
      screen.getByRole('button', { hidden: true, name: 'Trash' })
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes after an async confirm resolves', async () => {
    let resolve: () => void = () => undefined;
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    renderWithTrigger({ onConfirm });

    await userEvent.click(screen.getByRole('button', { name: 'Trash' }));
    await userEvent.click(screen.getByRole('button', { name: 'label.delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'label.cancel' })).toBeDisabled();

    resolve();

    await waitFor(() =>
      expect(screen.queryByTestId('confirm-popover')).toBeNull()
    );
  });

  it('stays open when confirm rejects or returns false', async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockReturnValueOnce(false);
    renderWithTrigger({ onConfirm });

    await userEvent.click(screen.getByRole('button', { name: 'Trash' }));
    await userEvent.click(screen.getByRole('button', { name: 'label.delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'label.delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('confirm-popover')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'label.cancel' })).toBeEnabled();
  });

  it('calls onCancel on Cancel and on Escape', async () => {
    const onCancel = vi.fn();
    renderWithTrigger({ onCancel });

    await userEvent.click(screen.getByRole('button', { name: 'Trash' }));
    await userEvent.click(screen.getByRole('button', { name: 'label.cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Trash' }));
    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('confirm-popover')).toBeNull();
  });

  it('runs extra actions and shows loading only on the pressed one', async () => {
    const onSoft = vi.fn().mockResolvedValue(undefined);
    renderWithTrigger({
      actions: [{ key: 'soft', label: 'Soft delete', onPress: onSoft }],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Trash' }));
    await userEvent.click(screen.getByRole('button', { name: 'Soft delete' }));

    expect(onSoft).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByTestId('confirm-popover')).toBeNull()
    );
  });

  it('anchors to triggerRef when controlled without a child trigger', async () => {
    const onConfirm = vi.fn();
    const Controlled = () => {
      const ref = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);

      return (
        <>
          <button ref={ref} type="button" onClick={() => setOpen(true)}>
            Menu
          </button>
          <ConfirmPopover
            isOpen={open}
            title="Uninstall?"
            triggerRef={ref}
            variant="primary"
            onConfirm={onConfirm}
            onOpenChange={setOpen}
          />
        </>
      );
    };
    render(<Controlled />);

    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'label.ok' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Uninstall?')).toBeNull());
  });

  it('disables confirm when isConfirmDisabled', async () => {
    renderWithTrigger({ isConfirmDisabled: true });

    await userEvent.click(screen.getByRole('button', { name: 'Trash' }));

    expect(screen.getByRole('button', { name: 'label.delete' })).toBeDisabled();
  });

  it('names the dialog after its title', async () => {
    renderWithTrigger();

    await userEvent.click(screen.getByRole('button', { name: 'Trash' }));

    expect(
      screen.getByRole('dialog', { name: 'Delete policy?' })
    ).toBeInTheDocument();
  });

  it('submits on Enter in a field when rendered as a form', async () => {
    const onConfirm = vi.fn();
    renderWithTrigger({
      asForm: true,
      content: <input aria-label="Email" />,
      onConfirm,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Trash' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'a{Enter}'
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByTestId('confirm-popover')).toBeNull()
    );
  });

  it('runs confirm once from the submit button in form mode', async () => {
    const onConfirm = vi.fn().mockReturnValue(false);
    renderWithTrigger({ asForm: true, onConfirm });

    await userEvent.click(screen.getByRole('button', { name: 'Trash' }));
    await userEvent.click(screen.getByRole('button', { name: 'label.delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('confirm-popover')).toBeInTheDocument();
  });
});
