/*
 *  Copyright 2025 Collate.
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
import { expect, Page } from '@playwright/test';
import { startCase } from 'lodash';
import { FillSupersetFormProps } from '../support/interfaces/ServiceForm.interface';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getOneOfOptionLabels = (optionName: string) => {
  const spacedLabel = optionName.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

  return [...new Set([optionName, spacedLabel])];
};

export const selectOneOfOption = async (
  page: Page,
  fieldId: string,
  selectTestId: string,
  optionName: string
) => {
  const field = page.locator(`[data-field-id="${fieldId}"]`);

  for (const optionLabel of getOneOfOptionLabels(optionName)) {
    const tab = field.getByRole('tab', {
      name: new RegExp(`^${escapeRegExp(optionLabel)}$`, 'i'),
    });

    if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await tab.click();

      return;
    }
  }

  const selectWidget = page.getByTestId(selectTestId);

  if (await selectWidget.isVisible({ timeout: 1000 }).catch(() => false)) {
    const combobox = selectWidget.getByRole('combobox');

    if (await combobox.isVisible({ timeout: 1000 }).catch(() => false)) {
      await combobox.click({
        // eslint-disable-next-line playwright/no-force-option -- some oneOf selectors are partially covered by the field wrapper
        force: true,
      });
    } else {
      await selectWidget.click();
    }

    const option = page.getByRole('option', { name: optionName });

    if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
      await option.click();

      return;
    }

    await page
      .getByLabel(startCase(optionName), { exact: true })
      .getByText(startCase(optionName))
      .click();

    return;
  }

  throw new Error(
    `Unable to select oneOf option "${optionName}" for field "${fieldId}"`
  );
};

export const fillSupersetFormDetails = async ({
  page,
  hostPort,
  connectionType,
  connection: {
    username,
    password,
    provider,
    hostPort: connectionHostPort,
    database,
  },
}: FillSupersetFormProps) => {
  await page.locator(String.raw`#root\/hostPort`).clear();
  await page.fill(String.raw`#root\/hostPort`, hostPort);

  if (connectionType === 'SupersetApiConnection') {
    await selectOneOfOption(
      page,
      'root/connection',
      'select-widget-root/connection__oneof_select',
      connectionType
    );

    if (provider) {
      await page.getByRole('button', { name: 'db Provider *' }).click();
      await page
        .locator(`.core-select-widget-popover:visible`)
        .getByRole('option', { name: provider })
        .click();
    }
  } else if (
    connectionType === 'PostgresConnection' ||
    connectionType === 'MysqlConnection'
  ) {
    await selectOneOfOption(
      page,
      'root/connection',
      'select-widget-root/connection__oneof_select',
      connectionType
    );

    if (connectionHostPort) {
      await page.locator(String.raw`#root\/connection\/hostPort`).clear();
      await page.fill(
        String.raw`#root\/connection\/hostPort`,
        connectionHostPort,
        { force: true } // eslint-disable-line playwright/no-force-option -- form field overlay covers input
      );
    }

    if (database) {
      await page.locator(String.raw`#root\/connection\/database`).clear();
      await page.fill(String.raw`#root\/connection\/database`, database, {
        force: true, // eslint-disable-line playwright/no-force-option -- form field overlay covers input
      });
    }
  }

  await page.locator(String.raw`#root\/connection\/username`).clear();
  await page.fill(String.raw`#root\/connection\/username`, username, {
    force: true, // eslint-disable-line playwright/no-force-option -- form field overlay covers input
  });
  if (connectionType === 'SupersetApiConnection') {
    await page.locator(String.raw`#root\/connection\/password`).clear();
    await page.fill(String.raw`#root\/connection\/password`, password, {
      force: true, // eslint-disable-line playwright/no-force-option -- form field overlay covers input
    });
  } else {
    await page
      .locator(String.raw`#root\/connection\/authType\/password`)
      .clear();
    await page.fill(
      String.raw`#root\/connection\/authType\/password`,
      password,
      { force: true } // eslint-disable-line playwright/no-force-option -- form field overlay covers input
    );
  }

  // Select the ingestion runner if the selector is visible
  const runnerSelector = page.getByTestId('select-widget-root/ingestionRunner');

  if (await runnerSelector.isVisible()) {
    await runnerSelector.click();
    await page.locator('.ant-select-dropdown:visible').first().waitFor({
      state: 'visible',
    });

    // Search for the runner using the search input
    await runnerSelector.locator('input').fill('CollateSaaS');

    // Using data-key which relies on `name` which is more reliable data in AUTs
    // instead of data-testid which depends on the `displayName` which can change
    await page
      .locator('.ant-select-dropdown:visible [data-key="CollateSaaS"]')
      .waitFor({ state: 'visible' });
    await page
      .locator('.ant-select-dropdown:visible [data-key="CollateSaaS"]')
      .click();

    await expect(
      page.getByTestId('select-widget-root/ingestionRunner')
    ).toContainText('Collate SaaS');
  }
};
