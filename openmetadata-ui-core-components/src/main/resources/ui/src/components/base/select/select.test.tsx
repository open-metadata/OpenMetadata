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

  it('closes when pressing the trigger of an open popup', async () => {
    const user = userEvent.setup();
    renderSelect();

    const trigger = screen.getByRole('button', { name: /Entity type/ });
    await user.click(trigger);
    expect(await screen.findByRole('listbox')).toBeVisible();

    // `useMenuTrigger` only ever opens on press, so the press must not reopen
    // what this dismissal closes.
    await user.click(trigger);

    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    );
  });

  it('keeps the list open when pressing inside a ComboBox trigger', async () => {
    const user = userEvent.setup();
    render(
      <Select.ComboBox
        aria-label="Entity type"
        items={[{ id: 'TABLE', label: 'TABLE' }]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select.ComboBox>
    );

    const input = screen.getByRole('combobox', { name: /Entity type/ });
    await user.click(input);
    expect(await screen.findByRole('listbox')).toBeVisible();

    // Pressing the input only moves the caret, and `menuTrigger="focus"` would
    // not reopen an already focused input.
    await user.click(input);

    expect(screen.getByRole('listbox')).toBeVisible();
  });

  it('leaves an unrelated element its own press', async () => {
    const user = userEvent.setup();
    const pressed = vi.fn();
    render(
      <>
        <button type="button" onClick={pressed}>
          Elsewhere
        </button>
        <Select
          aria-label="Entity type"
          items={[{ id: 'TABLE', label: 'TABLE' }]}>
          {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
        </Select>
      </>
    );

    await user.click(screen.getByRole('button', { name: /Entity type/ }));
    expect(await screen.findByRole('listbox')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));

    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    );
    expect(pressed).toHaveBeenCalled();
  });
});

describe('Select with no items', () => {
  it('opens and shows the empty state instead of staying closed', async () => {
    const user = userEvent.setup();
    render(
      <Select aria-label="Teams" items={[]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
    );

    await user.click(screen.getByRole('button', { name: /Teams/ }));

    expect(await screen.findByRole('listbox')).toHaveTextContent(
      /no-data-found|No data found/
    );
  });

  it('renders a custom empty state', async () => {
    const user = userEvent.setup();
    render(
      <Select aria-label="Teams" emptyState="Nothing to map" items={[]}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
    );

    await user.click(screen.getByRole('button', { name: /Teams/ }));

    expect(await screen.findByText('Nothing to map')).toBeInTheDocument();
  });
});
