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
 * Regression for the selective-reindex refactor (StoredProcedure search docs
 * missing `service`):
 *
 * StoredProcedure strips `service` from its stored JSON
 * (StoredProcedureRepository.getFieldsStrippedFromStorageJson -> ["service"])
 * and re-derives it from the parent schema. On the bulk path
 * (`setFieldsInBulk`) that hydration was gated behind the requested fields
 * containing `service`/`databaseSchema`/`database`. Once reindex switched from
 * `"*"` to a selective field list (#27876), none of those were requested, so
 * the gate never fired and the rebuilt search doc lost `service`.
 *
 * The reindex bulk path and the list endpoint both go through
 * `setFieldsInBulk`; the single-entity GET and live indexing go through
 * `setFields` (singular, ungated) and CANNOT reproduce the bug. So this test
 * exercises the list endpoint with a minimal field set that deliberately omits
 * `service` — the same condition reindex hit — and asserts `service` is still
 * populated. Before the fix this list entry had no `service`.
 */

import test, { expect } from '@playwright/test';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { createNewPage } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('Stored procedure carries service via the bulk field path even when service is not requested', async ({
  browser,
}) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  const storedProcedure = new StoredProcedureClass();

  try {
    const { service, schema, entity } = await storedProcedure.create(
      apiContext
    );

    // fields=owners deliberately omits service/databaseSchema/database, matching the reindex
    // selective field set. databaseSchema filter isolates the list to just this procedure.
    const res = await apiContext.get(
      `/api/v1/storedProcedures?databaseSchema=${encodeURIComponent(
        schema.fullyQualifiedName
      )}&fields=owners&limit=50`
    );

    expect(res.status()).toBe(200);

    const body = await res.json();
    const listed = (body?.data ?? []).find(
      (sp: { id?: string }) => sp.id === entity.id
    );

    expect(listed).toBeDefined();
    expect(listed?.service?.id).toBe(service.id);
  } finally {
    await storedProcedure.delete(apiContext);
    await afterAction();
  }
});
