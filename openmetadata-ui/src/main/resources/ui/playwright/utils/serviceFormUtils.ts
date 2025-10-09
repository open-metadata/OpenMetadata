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
  await page.locator('#root\\/hostPort').clear();
  await page.fill('#root\\/hostPort', hostPort);

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
      await page.locator('#root\\/connection\\/hostPort').clear();
      await page.fill('#root\\/connection\\/hostPort', connectionHostPort, {
        force: true,
      });
    }

    if (database) {
      await page.locator('#root\\/connection\\/database').clear();
      await page.fill('#root\\/connection\\/database', database, {
        force: true,
      });
    }
  }

  await page.locator('#root\\/connection\\/username').clear();
  await page.fill('#root\\/connection\\/username', username, { force: true });
  if (connectionType === 'SupersetApiConnection') {
    await page.locator('#root\\/connection\\/password').clear();
    await page.fill('#root\\/connection\\/password', password, {
      force: true,
    });
  } else {
    await page.locator('#root\\/connection\\/authType\\/password').clear();
    await page.fill('#root\\/connection\\/authType\\/password', password, {
      force: true,
    });
  }
};
