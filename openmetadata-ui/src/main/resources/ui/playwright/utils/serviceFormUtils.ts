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
import { expect } from '@playwright/test';
import { FillSupersetFormProps } from '../support/interfaces/ServiceForm.interface';

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
    await page
      .getByTestId('select-widget-root/connection__oneof_select')
      .click();
    await page.click(
      `.ant-select-dropdown:visible [title="${connectionType}"]`
    );

    if (provider) {
      await page.getByTestId('select-widget-root/connection/provider').click();
      await page.click(`.ant-select-dropdown:visible [title="${provider}"]`);
    }
  } else if (
    connectionType === 'PostgresConnection' ||
    connectionType === 'MysqlConnection'
  ) {
    await page
      .getByTestId('select-widget-root/connection__oneof_select')
      .click();
    await page.click(
      `.ant-select-dropdown:visible [title="${connectionType}"]`
    );

    if (connectionHostPort) {
      await page.locator(String.raw`#root\/connection\/hostPort`).clear();
      await page.fill(
        String.raw`#root\/connection\/hostPort`,
        connectionHostPort,
        {
          force: true,
        }
      );
    }

    if (database) {
      await page.locator(String.raw`#root\/connection\/database`).clear();
      await page.fill(String.raw`#root\/connection\/database`, database, {
        force: true,
      });
    }
  }

  await page.locator(String.raw`#root\/connection\/username`).clear();
  await page.fill(String.raw`#root\/connection\/username`, username, {
    force: true,
  });
  if (connectionType === 'SupersetApiConnection') {
    await page.locator(String.raw`#root\/connection\/password`).clear();
    await page.fill(String.raw`#root\/connection\/password`, password, {
      force: true,
    });
  } else {
    await page
      .locator(String.raw`#root\/connection\/authType\/password`)
      .clear();
    await page.fill(
      String.raw`#root\/connection\/authType\/password`,
      password,
      {
        force: true,
      }
    );
  }

  // Select the ingestion runner if the selector is visible
  const runnerSelector = page.getByTestId('select-widget-root/ingestionRunner');

  if (await runnerSelector.isVisible()) {
    await runnerSelector.click();
    await page.waitForSelector('.ant-select-dropdown:visible', {
      state: 'visible',
    });

    // Search for the runner using the search input
    await runnerSelector.locator('input').fill('CollateSaaS');

    // Using data-key which relies on `name` which is more reliable data in AUTs
    // instead of data-testid which depends on the `displayName` which can change
    await page.waitForSelector(
      '.ant-select-dropdown:visible [data-key="CollateSaaS"]',
      { state: 'visible' }
    );
    await page
      .locator('.ant-select-dropdown:visible [data-key="CollateSaaS"]')
      .click();

    await expect(
      page.getByTestId('select-widget-root/ingestionRunner')
    ).toContainText('Collate SaaS');
  }
};
