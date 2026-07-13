/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.ChangeEventRepository.Page;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.util.RestUtil;

class ChangeEventRepositoryPaginationTest {

  private static List<ChangeEventRecord> records(long... offsets) {
    List<ChangeEventRecord> records = new ArrayList<>();
    for (long offset : offsets) {
      records.add(new ChangeEventRecord(offset, "{\"offset\":" + offset + "}"));
    }
    return records;
  }

  private static long decodeOffset(String afterCursor) {
    return Long.parseLong(RestUtil.decodeCursor(afterCursor));
  }

  @Test
  void mergePageSortsByOffsetAcrossEventTypes() {
    Page page = ChangeEventRepository.mergePage(records(9, 2, 7, 1, 5), 10);

    List<Long> offsets = page.records().stream().map(ChangeEventRecord::offset).toList();
    assertEquals(List.of(1L, 2L, 5L, 7L, 9L), offsets, "records must be ordered by offset");
    assertNull(page.afterCursor(), "no next page when everything fits in the limit");
  }

  @Test
  void mergePageBoundsResultsToLimitAndEmitsCursor() {
    Page page = ChangeEventRepository.mergePage(records(10, 20, 30, 40, 50), 3);

    List<Long> offsets = page.records().stream().map(ChangeEventRecord::offset).toList();
    assertEquals(List.of(10L, 20L, 30L), offsets, "page is capped at the requested limit");
    assertNotNull(page.afterCursor(), "cursor is returned when more records remain");
    assertEquals(30L, decodeOffset(page.afterCursor()), "cursor points at the last kept offset");
  }

  @Test
  void mergePageWithExactlyLimitHasNoCursor() {
    Page page = ChangeEventRepository.mergePage(records(1, 2, 3), 3);

    assertEquals(3, page.records().size());
    assertNull(page.afterCursor(), "no cursor when the result set exactly equals the limit");
  }

  @Test
  void nextPageCursorContinuesWithoutGapsOrDuplicates() {
    List<Long> allOffsets = new ArrayList<>();
    for (long offset = 1; offset <= 25; offset++) {
      allOffsets.add(offset);
    }

    int limit = 10;
    long after = 0;
    List<Long> paged = new ArrayList<>();
    String cursor;
    do {
      List<ChangeEventRecord> fetched = new ArrayList<>();
      for (long offset : allOffsets) {
        if (offset > after && fetched.size() < limit + 1) {
          fetched.add(new ChangeEventRecord(offset, "{}"));
        }
      }
      Page page = ChangeEventRepository.mergePage(fetched, limit);
      page.records().forEach(record -> paged.add(record.offset()));
      cursor = page.afterCursor();
      if (cursor != null) {
        after = decodeOffset(cursor);
      }
    } while (cursor != null);

    assertEquals(allOffsets, paged, "paging through the cursor visits every offset exactly once");
    assertEquals(
        paged.size(), paged.stream().distinct().count(), "no duplicate offsets across pages");
    assertTrue(after > 0);
  }
}
