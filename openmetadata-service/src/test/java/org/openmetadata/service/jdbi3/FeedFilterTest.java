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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.resources.databases.DatasourceConfig;

/** Unit tests for {@link FeedFilter#buildDomainCondition} used to scope thread/task counts. */
class FeedFilterTest {

  @BeforeAll
  static void setUp() {
    // One-shot, idempotent: ensures the MySQL/Postgres branch has a connection type to read.
    DatasourceConfig.initialize("org.postgresql.Driver");
  }

  @Test
  @DisplayName("no condition when domain filtering is off")
  void testNoDomainFilter() {
    assertEquals("", FeedFilter.buildDomainCondition("domains", List.of(UUID.randomUUID()), false));
  }

  @Test
  @DisplayName("empty user domains restricts to domainless threads, honoring the column name")
  void testEmptyDomains() {
    assertEquals("domains IS NULL", FeedFilter.buildDomainCondition("domains", List.of(), true));
    assertEquals(
        "combined.domains IS NULL",
        FeedFilter.buildDomainCondition("combined.domains", List.of(), true));
  }

  @Test
  @DisplayName("populated domains produce an EXISTS check against the given column")
  void testPopulatedDomains() {
    UUID domainId = UUID.randomUUID();
    String condition = FeedFilter.buildDomainCondition("combined.domains", List.of(domainId), true);

    assertTrue(condition.contains("EXISTS"), "should be an EXISTS membership check");
    assertTrue(condition.contains("combined.domains"), "should reference the provided column");
    assertTrue(condition.contains(domainId.toString()), "should inline the user's domain id");
  }

  @Test
  @DisplayName("startTs and endTs bound the thread query on createdAt")
  void testTimeRangeBothBounds() {
    FeedFilter filter = FeedFilter.builder().startTs(1000L).endTs(2000L).build();
    assertEquals("WHERE createdAt >= 1000 AND createdAt <= 2000", filter.getCondition(false));
  }

  @Test
  @DisplayName("startTs alone lower-bounds createdAt")
  void testTimeRangeStartOnly() {
    String condition = FeedFilter.builder().startTs(1000L).build().getCondition(false);
    assertTrue(condition.contains("createdAt >= 1000"), condition);
    assertFalse(condition.contains("createdAt <="), condition);
  }

  @Test
  @DisplayName("endTs alone upper-bounds createdAt")
  void testTimeRangeEndOnly() {
    String condition = FeedFilter.builder().endTs(2000L).build().getCondition(false);
    assertTrue(condition.contains("createdAt <= 2000"), condition);
    assertFalse(condition.contains("createdAt >="), condition);
  }

  @Test
  @DisplayName("no time range leaves the thread query unfiltered")
  void testTimeRangeAbsent() {
    assertEquals("WHERE TRUE", FeedFilter.builder().build().getCondition(false));
  }
}
