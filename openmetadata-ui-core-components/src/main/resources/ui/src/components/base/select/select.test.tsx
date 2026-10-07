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
import { Button, Dialog, DialogTrigger, Modal } from 'react-aria-components';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './select';

describe('Select in a modal', () => {
  it.each(['pointer', 'keyboard'] as const)(
    'commits a selection from an unfocused trigger using %s',
    async (interaction) => {
      const user = userEvent.setup();
      render(
        <DialogTrigger>
          <Button>Open editor</Button>
          <Modal>
            <Dialog aria-label="Test definition">
              <Button autoFocus>Cancel</Button>
              <Select
                aria-label="Entity type"
                items={[{ id: 'TABLE', label: 'TABLE' }]}>
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
              </Select>
            </Dialog>
          </Modal>
        </DialogTrigger>
      );
      await user.click(screen.getByRole('button', { name: 'Open editor' }));
      const trigger = screen.getByRole('button', { name: /Entity type/ });
      expect(trigger).not.toHaveFocus();

      if (interaction === 'pointer') {
        await user.click(trigger);
        await user.click(await screen.findByRole('option', { name: 'TABLE' }));
      } else {
        await user.tab();
        await user.keyboard('{ArrowDown}{Enter}');
      }

      await waitFor(() => expect(trigger).toHaveTextContent('TABLE'));
      expect(
        screen.getByRole('dialog', { name: 'Test definition' })
      ).toBeVisible();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      await waitFor(() => expect(trigger).toHaveFocus());
    }
  );
});

describe('Select dismissal', () => {
  const renderSelect = () =>
    render(
      <>
        <div data-testid="outside">outside</div>
        <Select
          aria-label="Entity type"
          items={[{ id: 'TABLE', label: 'TABLE' }]}>
          {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
        </Select>
      </>
    );

  it('closes the listbox when pressing outside', async () => {
    const user = userEvent.setup();
    renderSelect();

    await user.click(screen.getByRole('button', { name: /Entity type/ }));
    expect(await screen.findByRole('listbox')).toBeVisible();

    await user.click(screen.getByTestId('outside'));

    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    );
  });

  // jsdom has no PointerEvent, so react-aria falls back to mouse events and
  // `user.click` would reopen from the mousedown our handler does not see.
  // Dispatching the press the browser would send keeps the assertion honest.
  it('closes when pressing the trigger of an open popup', async () => {
    const user = userEvent.setup();
    renderSelect();

    const trigger = screen.getByRole('button', { name: /Entity type/ });
    await user.click(trigger);
    expect(await screen.findByRole('listbox')).toBeVisible();

    const press = new Event('pointerdown', { bubbles: true });
    const reachedTrigger = vi.fn();
    trigger.addEventListener('pointerdown', reachedTrigger);
    trigger.dispatchEvent(press);

    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    );
    // Stopped in the capture phase, so the press cannot reopen the popup.
    expect(reachedTrigger).not.toHaveBeenCalled();
  });
});
