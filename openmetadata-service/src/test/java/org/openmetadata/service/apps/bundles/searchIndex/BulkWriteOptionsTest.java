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

package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.search.SearchDocumentUpdate;
import org.openmetadata.service.search.SearchVersionGuard;

class BulkWriteOptionsTest {
  private static final long READ_AT = 1_700_000_000_000L;
  private static final Map<String, Object> LIVE_INDEX_BATCH =
      Map.of(BulkSink.SOURCE_READ_AT_CONTEXT_KEY, READ_AT);
  private static final Map<String, Object> DOCUMENT =
      Map.of("name", "sales", "description", "rebuilt");
  private static final TestSuite SUITE =
      new TestSuite().withId(UUID.randomUUID()).withName("orders_suite");

  private final Dashboard dashboard =
      new Dashboard()
          .withId(UUID.randomUUID())
          .withName("sales")
          .withVersion(0.3)
          .withUpdatedAt(1_600_000_000_000L);

  @Test
  void aBatchBoundForANewIndexIsIndexedAsBuilt() {
    assertNull(BulkWriteOptions.from(Map.of()).scriptedUpdate(dashboard, () -> DOCUMENT));
  }

  @Test
  void aBatchBoundForTheLiveIndexReplacesDocumentsAndCarriesItsReadTime() {
    final SearchDocumentUpdate update =
        BulkWriteOptions.from(LIVE_INDEX_BATCH).scriptedUpdate(dashboard, () -> DOCUMENT);

    assertTrue(update.scriptedUpsert(), "A row missing from the index must still be written");
    assertEquals("rebuilt", update.parameters().get("description"));
    assertEquals(READ_AT, update.parameters().get(SearchVersionGuard.SOURCE_READ_AT));
  }

  @Test
  void aRebuildFencesATestCasesSuitesWhateverItsLastChangeWas() {
    final TestCase testCase = testCaseLastChangedInItsDescription();
    final Map<String, Object> rebuild =
        Map.of(
            BulkSink.FENCED_RELATIONSHIPS_CONTEXT_KEY,
            true,
            BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY,
            Map.of(testCase.getId(), 17L));

    final SearchDocumentUpdate update =
        BulkWriteOptions.from(rebuild).scriptedUpdate(testCase, () -> DOCUMENT);

    assertEquals(17L, update.parameters().get("testSuitesRevision"));
    assertEquals(
        List.of(SUITE.getId().toString()),
        ((List<?>) update.parameters().get("testSuites"))
            .stream().map(suite -> ((Map<?, ?>) suite).get("id")).toList());
  }

  @Test
  void aLivePartialWriteOnlyFencesAChangeToTheSuitesAlone() {
    final TestCase testCase = testCaseLastChangedInItsDescription();
    final Map<String, Object> livePartial =
        Map.of(
            BulkSink.SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY,
            true,
            BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY,
            Map.of(testCase.getId(), 17L));

    final BulkWriteOptions options = BulkWriteOptions.from(livePartial);

    assertThrows(
        IllegalStateException.class, () -> options.scriptedUpdate(testCase, () -> DOCUMENT));
  }

  private static TestCase testCaseLastChangedInItsDescription() {
    return new TestCase()
        .withId(UUID.randomUUID())
        .withName("row_count")
        .withVersion(0.2)
        .withTestSuites(List.of(SUITE))
        .withChangeDescription(
            new ChangeDescription()
                .withPreviousVersion(0.1)
                .withFieldsUpdated(List.of(new FieldChange().withName("description"))));
  }

  @Test
  void onlyTimeSeriesDocumentsBoundForTheLiveIndexCarryTheirReadTime() {
    final Map<String, Object> live = new HashMap<>(DOCUMENT);
    final Map<String, Object> staged = new HashMap<>(DOCUMENT);

    BulkWriteOptions.from(LIVE_INDEX_BATCH).stampTimeSeriesDocument(live);
    BulkWriteOptions.from(Map.of()).stampTimeSeriesDocument(staged);

    assertEquals(READ_AT, live.get(SearchVersionGuard.SOURCE_READ_AT));
    assertFalse(staged.containsKey(SearchVersionGuard.SOURCE_READ_AT));
  }
}
