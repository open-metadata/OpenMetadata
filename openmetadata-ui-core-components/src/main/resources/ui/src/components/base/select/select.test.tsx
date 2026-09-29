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
import { describe, expect, it } from 'vitest';
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

describe('Select sections', () => {
  it('groups options under their section headers', async () => {
    const user = userEvent.setup();
    render(
      <Select aria-label="Landing page">
        <Select.Section aria-label="General">
          <Select.SectionHeader>General</Select.SectionHeader>
          <Select.Item id="home" label="Home" />
        </Select.Section>
        <Select.Section aria-label="Govern">
          <Select.SectionHeader>Govern</Select.SectionHeader>
          <Select.Item id="glossary" label="Glossary" />
        </Select.Section>
      </Select>
    );

    await user.click(screen.getByRole('button', { name: /Landing page/ }));

    const govern = await screen.findByRole('group', { name: 'Govern' });

    expect(govern).toHaveTextContent('Govern');
    expect(govern).toContainElement(
      screen.getByRole('option', { name: 'Glossary' })
    );
    expect(govern).not.toContainElement(
      screen.getByRole('option', { name: 'Home' })
    );
  });
});
