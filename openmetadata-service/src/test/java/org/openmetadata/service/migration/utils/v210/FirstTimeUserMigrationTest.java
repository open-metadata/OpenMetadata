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

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.migration.utils.IdBatches.BATCH_SIZE;

import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Per-batch behavior of the backfill; the keyset walk itself is {@code IdBatchesTest}'s. Real SQL
 * behavior in both dialects is covered by {@code FirstTimeUserMigrationIT}.
 */
class FirstTimeUserMigrationTest {

  private static final String USER_IDS =
      "SELECT id FROM user_entity WHERE id > :afterId ORDER BY id LIMIT :limit";

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void eachBatchOfUsersGetsOneUpdateBoundToItsIds(final ConnectionType connectionType) {
    final Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    final Update update = mock(Update.class, RETURNS_DEEP_STUBS);
    final List<String> firstBatch = ids(0, BATCH_SIZE);
    final List<String> lastBatch = ids(BATCH_SIZE, 3);
    stubIdBatch(handle, "", firstBatch);
    stubIdBatch(handle, firstBatch.getLast(), lastBatch);
    when(handle.createUpdate(argThat(this::isGuardedBatchUpdate))).thenReturn(update);

    FirstTimeUserMigration.backfillFirstTimeUser(handle, connectionType);

    verify(update).bindList("ids", firstBatch);
    verify(update).bindList("ids", lastBatch);
    verify(handle, times(2)).createUpdate(anyString());
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void anEmptyUserTableIssuesNoUpdate(final ConnectionType connectionType) {
    final Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    stubIdBatch(handle, "", List.of());

    FirstTimeUserMigration.backfillFirstTimeUser(handle, connectionType);

    verify(handle, never()).createUpdate(anyString());
  }

  /** The statement is restricted to the batch and skips users already marked, so it can resume. */
  private boolean isGuardedBatchUpdate(final String sql) {
    return sql.startsWith("UPDATE user_entity ")
        && sql.contains("id IN (<ids>)")
        && (sql.contains("'$.isFirstTimeUser') IS NULL")
            || sql.contains("json->'isFirstTimeUser' IS NULL"));
  }

  private void stubIdBatch(final Handle handle, final String afterId, final List<String> ids) {
    when(handle
            .createQuery(USER_IDS)
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
