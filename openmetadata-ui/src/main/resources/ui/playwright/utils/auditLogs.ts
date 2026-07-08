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
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { GlobalSettingOptions } from '../constant/settings';
import { settingClick } from './sidebar';

const AUDIT_LOG_POLL_TIMEOUT = 120000;

export const navigateToAuditLogsPage = async (page: Page) => {
  const logRequest = page.waitForResponse('/api/v1/audit/logs?*');
  await settingClick(page, GlobalSettingOptions.AUDIT_LOGS);
  await logRequest;
  await page.locator('.ant-skeleton').first().waitFor({ state: 'detached' });
  await page.getByTestId('audit-log-list').waitFor({ state: 'visible' });
};

export const waitForAuditLogEntry = async (
  apiContext: APIRequestContext,
  _page: Page,
  entityFqn: string,
  entityType: string,
  eventType: string
): Promise<Record<string, unknown> | null> => {
  let auditEntry: Record<string, unknown> | null = null;

  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/audit/logs?entityFQN=${encodeURIComponent(
            entityFqn
          )}&entityType=${entityType}&eventType=${eventType}&limit=10`
        );

        if (!response.ok()) {
          return false;
        }

        const data = await response.json();
        auditEntry = data.data?.[0] ?? null;

        return Boolean(auditEntry);
      },
      {
        intervals: [1000, 2000],
        message: `Timed out waiting for ${eventType} audit entry for ${entityType}:${entityFqn}`,
        timeout: AUDIT_LOG_POLL_TIMEOUT,
      }
    )
    .toBe(true);

  return auditEntry;
};

export const verifyAuditEntryHasValidUUIDs = (
  entry: Record<string, unknown>,
  expectedEntityId: string
) => {
  expect(entry.changeEventId).toBeTruthy();
  expect(typeof entry.changeEventId).toBe('string');
  expect((entry.changeEventId as string).length).toBeGreaterThan(0);
  expect(entry.entityId).toBeTruthy();
  expect(entry.entityId).toBe(expectedEntityId);
};
