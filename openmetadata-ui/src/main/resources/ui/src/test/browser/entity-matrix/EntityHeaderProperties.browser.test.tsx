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
 * The entity header shows its first five properties and the rest behind Show
 * more; an empty property the user can edit offers Add, which opens its
 * editor, and one the user cannot edit shows a dash. Real Table page, only the
 * network is mocked.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { Table } from '../../../generated/entity/data/table';
import { ADMIN, DATA_CONSUMER } from '../fixtures/personas';
import { scaled, suiteTimeout } from '../timeouts';
import { entityConfig, EntityPage, mountEntityPage } from './entityMatrix';

const metadata = () => page.getByTestId('data-asset-header-metadata');
const cell = (id: string) => metadata().getByTestId(`header-property-${id}`);

describe('Entity header properties', suiteTimeout(60_000), () => {
  describe('for an admin', () => {
    let entity: EntityPage;

    beforeEach(async () => {
      entity = await mountEntityPage(entityConfig('Table'), ADMIN);
    }, scaled(90_000));

    test('shows five properties and the rest behind Show more', async () => {
      const toggle = metadata().getByTestId('header-properties-toggle');

      await expect.element(cell('domains')).toBeVisible();
      await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect.element(cell('type')).not.toBeInTheDocument();

      await userEvent.click(toggle);

      await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect.element(cell('type')).toHaveTextContent('Regular');

      await userEvent.click(toggle);

      await expect.element(cell('type')).not.toBeInTheDocument();
    });

    test('sets an empty property from Add and edits it from its pencil', async () => {
      const trigger = cell('retentionPeriod').getByTestId(
        'edit-retention-period-button'
      );
      const save = async (value: string) => {
        const dialog = page.getByTestId('retention-period-modal');
        await userEvent.fill(
          dialog.getByTestId('retention-period-input'),
          value
        );
        await userEvent.click(dialog.getByTestId('save-button'));

        await expect
          .poll(() => (entity.server.current() as Table).retentionPeriod)
          .toBe(value);
      };

      await expect.element(trigger).toHaveTextContent('Add');

      await userEvent.click(trigger);
      await save('P0Y0M4D');

      await expect.element(cell('retentionPeriod')).toHaveTextContent('4 days');
      await expect.element(trigger).not.toHaveTextContent('Add');

      await userEvent.click(trigger);
      await save('P0Y0M2W');

      await expect
        .element(cell('retentionPeriod'))
        .toHaveTextContent('2 weeks');
    });
  });

  describe('for a Data Consumer', () => {
    beforeEach(async () => {
      await mountEntityPage(entityConfig('Table'), DATA_CONSUMER);
    }, scaled(90_000));

    test('shows a dash, not Add, on a property it cannot edit', async () => {
      await expect.element(cell('retentionPeriod')).toHaveTextContent('--');
      await expect
        .element(
          cell('retentionPeriod').getByTestId('edit-retention-period-button')
        )
        .not.toBeInTheDocument();
    });
  });
});
