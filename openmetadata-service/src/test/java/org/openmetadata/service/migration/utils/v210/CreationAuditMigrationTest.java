/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.migration.utils.v210;

import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.migration.utils.v210.CreationAuditMigration.BATCH_SIZE;

import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;

/**
 * The backfill walks each audited table in keyset-paged batches so no single statement grows with
 * the table. Real SQL behavior in both dialects is covered by {@code CreationAuditMigrationIT}.
 */
class CreationAuditMigrationTest {

  private static final String TABLE_IDS =
      "SELECT id FROM table_entity WHERE id > :afterId ORDER BY id LIMIT :limit";
  private static final String TABLE_IDS_MISSING_AUDIT =
      "SELECT e.id FROM table_entity e WHERE e.id IN (<ids>) AND (JSON_EXTRACT(e.json,"
          + " '$.createdAt') IS NULL OR JSON_TYPE(JSON_EXTRACT(e.json, '$.createdAt')) = 'NULL')";
  // Only table_entity is stubbed; the other audited tables get deep-stub lists that are not
  // empty, so assertions about writes are scoped to table_entity's statements.
  private static final String TABLE_UPDATE = "UPDATE table_entity ";

  @Test
  void readsEveryBatchOfIdsThroughTheKeysetCursor() {
    final Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    final List<String> firstBatch = ids(0, BATCH_SIZE);
    final List<String> secondBatch = ids(BATCH_SIZE, 1);
    stubIdBatch(handle, "", firstBatch);
    stubIdBatch(handle, firstBatch.getLast(), secondBatch);

    CreationAuditMigration.backfillCreationAudit(handle, MYSQL);

    verify(handle.createQuery(TABLE_IDS_MISSING_AUDIT)).bindList("ids", secondBatch);
  }

  @Test
  void aBatchWithNothingMissingNeverReadsVersionHistory() {
    final Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    final List<String> batch = ids(0, 1);
    stubIdBatch(handle, "", batch);
    when(handle
            .createQuery(TABLE_IDS_MISSING_AUDIT)
            .bindList("ids", batch)
            .mapTo(String.class)
            .list())
        .thenReturn(List.of());

    CreationAuditMigration.backfillCreationAudit(handle, MYSQL);

    verify(handle, never()).createUpdate(startsWith(TABLE_UPDATE));
  }

  @Test
  void anEmptyTableIssuesNoBatchStatement() {
    final Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    stubIdBatch(handle, "", List.of());

    CreationAuditMigration.backfillCreationAudit(handle, MYSQL);

    verify(handle, never()).createQuery(TABLE_IDS_MISSING_AUDIT);
    verify(handle, never()).createUpdate(startsWith(TABLE_UPDATE));
  }

  private void stubIdBatch(final Handle handle, final String afterId, final List<String> ids) {
    when(handle
            .createQuery(TABLE_IDS)
            .bind("afterId", afterId)
            .bind("limit", BATCH_SIZE)
            .mapTo(String.class)
            .list())
        .thenReturn(ids);
  }

  private List<String> ids(final int from, final int count) {
    final List<String> ids = new ArrayList<>();
    for (int index = from; index < from + count; index++) {
      ids.add("00000000-0000-0000-0000-%012d".formatted(index));
    }
    return ids;
  }
}
