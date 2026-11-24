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
 * Editing a saved connection keeps its stored secret masked. The server returns secrets as
 * `*********`; the form must show that value in a password input. One connector per shape the
 * form reads a stored secret from: an `authType` oneOf, a flat field the form folds into a
 * synthesized `authType`, a top-level field, a non-database service, and a oneOf whose
 * branches share a top-level key (Datalake's Azure/GCS/S3 `securityConfig`).
 */
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { serveEntity } from '../../test/browser/fixtures/entityPage';
import {
  makeDashboardService,
  makeDatabaseService,
  makeMessagingService,
} from '../../test/browser/fixtures/services';
import { renderApp } from '../../test/browser/renderWithApp';
import { scaled } from '../../test/browser/timeouts';

// What the server returns for a stored secret to every non-bot user.
const MASKED = '*********';

interface ConnectorCase {
  serviceType: string;
  category: 'databaseServices' | 'dashboardServices' | 'messagingServices';
  service: { id: string; name: string };
  secretFieldId: string;
  config: Record<string, unknown>;
}

const CONNECTORS: ConnectorCase[] = [
  {
    serviceType: 'Redshift',
    category: 'databaseServices',
    service: makeDatabaseService(),
    secretFieldId: 'root/authType/password',
    config: {
      type: 'Redshift',
      username: 'pw_user',
      hostPort: 'pw-redshift.example.com:5439',
      database: 'dev',
      authType: { password: MASKED },
    },
  },
  {
    serviceType: 'Snowflake',
    category: 'databaseServices',
    service: makeDatabaseService(),
    // Stored flat, but the form synthesizes an `authType` oneOf for the Password / Key pair tabs.
    secretFieldId: 'root/authType/password',
    config: {
      type: 'Snowflake',
      username: 'pw_user',
      account: 'pw-account',
      warehouse: 'COMPUTE_WH',
      password: MASKED,
    },
  },
  {
    serviceType: 'Datalake',
    category: 'databaseServices',
    service: makeDatabaseService(),
    secretFieldId: 'root/configSource/securityConfig/awsSecretAccessKey',
    config: {
      type: 'Datalake',
      configSource: {
        securityConfig: {
          awsAccessKeyId: 'pw-access-key-id',
          awsSecretAccessKey: MASKED,
          awsRegion: 'us-east-1',
        },
      },
    },
  },
  {
    serviceType: 'Tableau',
    category: 'dashboardServices',
    service: makeDashboardService(),
    secretFieldId: 'root/authType/password',
    config: {
      type: 'Tableau',
      hostPort: 'http://localhost:8080',
      authType: { username: 'pw_user', password: MASKED },
    },
  },
  {
    serviceType: 'Kafka',
    category: 'messagingServices',
    service: makeMessagingService(),
    secretFieldId: 'root/saslPassword',
    config: {
      type: 'Kafka',
      bootstrapServers: 'localhost:9092',
      saslUsername: 'pw_user',
      saslPassword: MASKED,
    },
  },
];

const secretInput = (id: string) =>
  document.getElementById(id) as HTMLInputElement | null;

describe('Edit connection form secret masking', () => {
  test.each(CONNECTORS)(
    '$serviceType: the stored secret stays masked',
    async ({ serviceType, category, service, secretFieldId, config }) => {
      serveEntity(`services/${category}`, {
        ...service,
        serviceType,
        connection: { config },
      });

      await renderApp(
        `/service/${category}/${service.name}/connection/edit-connection`
      );

      await expect
        .poll(() => secretInput(secretFieldId)?.value, {
          timeout: scaled(60_000),
        })
        .toBe(MASKED);

      expect(secretInput(secretFieldId)?.type).toBe('password');
      await expect
        .element(page.getByTestId('test-connection-btn'))
        .toBeVisible();
    }
  );
});
