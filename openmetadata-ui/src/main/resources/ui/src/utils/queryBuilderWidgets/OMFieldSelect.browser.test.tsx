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
/**
 * The real react-aria ComboBox behind a query builder Field control (the Jest
 * suites stub it): the box must never show a field the rule does not hold.
 */
import type { Config, FieldProps } from '@react-awesome-query-builder/ui';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import OMFieldSelect from './OMFieldSelect';

const FIELDS = [
  { key: 'owners', path: 'owners', label: 'Owners' },
  { key: 'name', path: 'name', label: 'Name' },
  { key: 'displayName', path: 'displayName', label: 'Display Name' },
];

const renderOwnersSelect = async () => {
  const setField = vi.fn();
  await render(
    <>
      <OMFieldSelect
        {...({
          config: {} as Config,
          items: FIELDS,
          readonly: false,
          selectedKey: 'owners',
          setField,
        } as unknown as FieldProps)}
      />
      <button type="button">elsewhere</button>
    </>
  );

  return setField;
};

describe('OMFieldSelect', () => {
  // Typing "Name" filters Owners out of the list, so React Aria commits the
  // selection it can no longer find as `null` — the box kept "Name" while the
  // rule still filtered on Owners.
  test.each([
    ['leaves the box', () => userEvent.tab()],
    ['presses Escape', () => userEvent.keyboard('{Escape}')],
  ])(
    'a filter the user %s without picking gives way to the selected field',
    async (_, leave) => {
      const setField = await renderOwnersSelect();
      const input = page.getByRole('combobox');

      await userEvent.fill(input, 'Name');

      await expect.element(page.getByRole('listbox')).toBeVisible();

      await leave();

      await expect.element(input).toHaveValue('Owners');
      expect(setField).not.toHaveBeenCalled();
    }
  );
});
