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
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  Dialog,
  DialogTrigger,
  ListBoxItem,
  Modal,
} from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Select } from './select';
import { SelectListBox } from './select-list-box';

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

  // Pins react-aria's internal `data-react-aria-top-layer` contract (see select-list-box.tsx): a listbox
  // inserted outside the modal while the modal's ariaHideOutside observer is active must stay exposed.
  // If react-aria renames or drops the attribute, the listbox is aria-hidden and this fails.
  it('keeps a listbox inserted outside the modal accessible', async () => {
    const PortaledListBox = () => {
      const [isOpen, setIsOpen] = useState(false);

      return (
        <>
          <Button onPress={() => setIsOpen(true)}>Show options</Button>
          {isOpen &&
            createPortal(
              <SelectListBox
                aria-label="Dimension"
                items={[{ id: 'accuracy', label: 'Accuracy' }]}
                size="sm"
                virtualize={false}>
                {(item) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>}
              </SelectListBox>,
              document.body
            )}
        </>
      );
    };
    const user = userEvent.setup();
    render(
      <DialogTrigger>
        <Button>Open editor</Button>
        <Modal>
          <Dialog aria-label="Test definition">
            <PortaledListBox />
          </Dialog>
        </Modal>
      </DialogTrigger>
    );
    await user.click(screen.getByRole('button', { name: 'Open editor' }));
    await user.click(screen.getByRole('button', { name: 'Show options' }));

    // Role queries skip aria-hidden subtrees.
    expect(
      await screen.findByRole('option', { name: 'Accuracy' })
    ).toBeInTheDocument();
  });
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

describe('Select with a large collection', () => {
  beforeEach(() => {
    vi.stubEnv('VIRT_ON', 'true');
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 40,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => 320,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 256,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 320,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
    Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
    Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  it('windows the options and selects the last item with the keyboard', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const items = Array.from({ length: 250 }, (_, index) => ({
      id: `column-${index}`,
      label: `Column ${index}`,
    }));
    render(
      <Select
        aria-label="Columns"
        items={items}
        onSelectionChange={onSelectionChange}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select>
    );
    await user.click(screen.getByRole('button', { name: /Columns/ }));
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option').length).toBeLessThan(items.length);
    await user.keyboard('{End}{Enter}');
    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenCalledWith('column-249')
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates a windowed ComboBox with arrows and PageDown and commits', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const items = Array.from({ length: 250 }, (_, index) => ({
      id: `column-${index}`,
      label: `Column ${index}`,
    }));
    render(
      <Select.ComboBox
        aria-label="Columns"
        items={items}
        onSelectionChange={onSelectionChange}>
        {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
      </Select.ComboBox>
    );
    const input = screen.getByRole('combobox', { name: /Columns/ });
    await user.click(input);
    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option').length).toBeLessThan(items.length);

    await user.keyboard('{ArrowDown}{ArrowDown}');
    await waitFor(() =>
      expect(input.getAttribute('aria-activedescendant')).toBeTruthy()
    );
    const activeText = () =>
      document.getElementById(input.getAttribute('aria-activedescendant') ?? '')
        ?.textContent;
    await waitFor(() => expect(activeText()).toBe('Column 1'));

    for (let i = 0; i < 60; i++) {
      await user.keyboard('{PageDown}');
    }
    await waitFor(() => expect(activeText()).toBe('Column 249'));
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenCalledWith('column-249')
    );
  });

  describe('keyboard navigation', () => {
    const items = Array.from({ length: 250 }, (_, index) => ({
      id: `column-${index}`,
      label: `Column ${index}`,
    }));
    const openSelect = async (onSelectionChange = vi.fn()) => {
      const user = userEvent.setup();
      render(
        <Select
          aria-label="Columns"
          items={items}
          onSelectionChange={onSelectionChange}>
          {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
        </Select>
      );
      await user.click(screen.getByRole('button', { name: /Columns/ }));
      await screen.findByRole('listbox');

      return { user, onSelectionChange };
    };
    const activeLabel = () => document.activeElement?.textContent;

    it('moves the active option with arrows, Home, End and PageDown', async () => {
      const { user } = await openSelect();
      await user.keyboard('{Home}');
      await waitFor(() => expect(activeLabel()).toBe('Column 0'));

      await user.keyboard('{ArrowDown}{ArrowDown}');
      await waitFor(() => expect(activeLabel()).toBe('Column 2'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(activeLabel()).toBe('Column 1'));

      await user.keyboard('{End}');
      await waitFor(() => expect(activeLabel()).toBe('Column 249'));

      await user.keyboard('{Home}{PageDown}');
      await waitFor(() => {
        const label = activeLabel() ?? '';
        expect(Number(label.replace('Column ', ''))).toBeGreaterThan(1);
      });
    });

    it('reaches options past the 100th by repeated PageDown and commits', async () => {
      const { user, onSelectionChange } = await openSelect();
      await user.keyboard('{Home}');
      await waitFor(() => expect(activeLabel()).toBe('Column 0'));

      for (let i = 0; i < 60; i++) {
        await user.keyboard('{PageDown}');
      }
      await waitFor(() => expect(activeLabel()).toBe('Column 249'));
      await user.keyboard('{Enter}');

      await waitFor(() =>
        expect(onSelectionChange).toHaveBeenCalledWith('column-249')
      );
    });

    it('jumps to a late option by typeahead and commits it', async () => {
      const { user, onSelectionChange } = await openSelect();
      await user.keyboard('Column 17');
      await waitFor(() => expect(activeLabel()).toBe('Column 17'));
      await user.keyboard('{Enter}');

      await waitFor(() =>
        expect(onSelectionChange).toHaveBeenCalledWith('column-17')
      );
    });

    it('closes on Escape without committing and returns focus to the trigger', async () => {
      const { user, onSelectionChange } = await openSelect();
      await user.keyboard('{End}{Escape}');

      await waitFor(() =>
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      );
      expect(onSelectionChange).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Columns/ })).toHaveFocus()
      );
    });
  });
});
