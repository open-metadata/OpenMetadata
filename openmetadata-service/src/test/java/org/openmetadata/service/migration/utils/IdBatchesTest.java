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

package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.migration.utils.IdBatches.BATCH_SIZE;

import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;

class IdBatchesTest {

  private static final String IDS_AFTER =
      "SELECT id FROM some_entity WHERE id > :afterId ORDER BY id LIMIT :limit";

  @Test
  void foldsEveryBatchReadThroughTheKeysetCursor() {
    final Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    final List<String> firstBatch = ids(0, BATCH_SIZE);
    stubBatch(handle, "", firstBatch);
    stubBatch(handle, firstBatch.getLast(), ids(BATCH_SIZE, 1));

    final int seen = IdBatches.fold(handle, "some_entity", 0, (sum, batch) -> sum + batch.size());

    assertEquals(BATCH_SIZE + 1, seen);
  }

  @Test
  void anEmptyTableNeverReachesTheStep() {
    final Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    stubBatch(handle, "", List.of());

    final int calls = IdBatches.fold(handle, "some_entity", 0, (sum, batch) -> sum + 1);

    assertEquals(0, calls);
  }

  private void stubBatch(final Handle handle, final String afterId, final List<String> ids) {
    when(handle
            .createQuery(IDS_AFTER)
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
