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
 * The add-service connection form across connector types: an empty submit names every
 * required field, and the secret input stays a password field while the user types.
 * Each connector keeps its secret in a different place (an `authType` oneOf, a flat field
 * the form folds into a synthesized `authType`, a top-level SASL password), so the masking
 * check covers each lookup. No test-connection workflow is mocked: an invalid form must not
 * start one, and an unmocked call would fail the test.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { worker } from '../../test/browser/msw';
import { renderApp } from '../../test/browser/renderWithApp';
import { scaled } from '../../test/browser/timeouts';

const SECRET = 'typed-secret-value';

interface ConnectorCase {
  connector: string;
  category: 'databaseServices' | 'dashboardServices' | 'messagingServices';
  secretFieldId: string;
  requiredFieldErrors: string[];
}

const CONNECTORS: ConnectorCase[] = [
  {
    connector: 'Redshift',
    category: 'databaseServices',
    secretFieldId: 'root/authType/password',
    requiredFieldErrors: ['Host Port', 'Username', 'Database'],
  },
  {
    connector: 'Postgres',
    category: 'databaseServices',
    secretFieldId: 'root/authType/password',
    requiredFieldErrors: ['Host Port', 'Username', 'Database'],
  },
  {
    connector: 'Mysql',
    category: 'databaseServices',
    secretFieldId: 'root/authType/password',
    requiredFieldErrors: ['Host Port', 'Username'],
  },
  {
    connector: 'Snowflake',
    category: 'databaseServices',
    secretFieldId: 'root/authType/password',
    requiredFieldErrors: ['Username', 'Account', 'Warehouse'],
  },
  {
    connector: 'Tableau',
    category: 'dashboardServices',
    secretFieldId: 'root/authType/password',
    requiredFieldErrors: ['Host Port'],
  },
  {
    connector: 'Kafka',
    category: 'messagingServices',
    secretFieldId: 'root/saslPassword',
    requiredFieldErrors: ['Bootstrap Servers'],
  },
];

const secretInput = (id: string) =>
  document.getElementById(id) as HTMLInputElement | null;

describe('Add service connection form', () => {
  test.each(CONNECTORS)(
    '$connector: empty submit lists required fields and the secret stays masked',
    async ({ connector, category, secretFieldId, requiredFieldErrors }) => {
      worker.use(
        http.get(`/api/v1/services/${category}/name/:name`, () =>
          HttpResponse.json({}, { status: 404 })
        )
      );
      await renderApp(`/${category}/add-service`);

      await expect
        .element(page.getByTestId(connector), { timeout: scaled(60_000) })
        .toBeVisible();

      await userEvent.click(page.getByTestId(connector));

      await expect
        .element(page.getByTestId('test-connection-btn'), {
          timeout: scaled(60_000),
        })
        .toBeVisible();

      await userEvent.click(page.getByTestId('test-connection-btn'));

      for (const field of requiredFieldErrors) {
        await expect
          .element(page.getByText(`${field} is required.`, { exact: true }))
          .toBeVisible();
      }

      await expect
        .poll(() => secretInput(secretFieldId)?.type)
        .toBe('password');

      const secret = secretInput(secretFieldId) as HTMLInputElement;
      await userEvent.fill(secret, SECRET);

      expect(secret.value).toBe(SECRET);
      expect(secret.type).toBe('password');
    }
  );
});
