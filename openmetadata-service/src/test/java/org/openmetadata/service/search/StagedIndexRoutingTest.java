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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;
// Canonical names: these DAO interfaces were split out of CollectionDAO into SearchReindexDAOs.
// CollectionDAO still inherits them, so inline references compile, but JLS 7.5 requires an import to
// name the owning interface.
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexJobDAO.SearchIndexJobRecord;

/**
 * A reindex stages a new index and, on promotion, deletes the index the canonical alias used to
 * point at. Any node that does not know a staged index exists keeps writing through that alias, so
 * its writes are destroyed by the swap. Registration happens only in the JVM running the reindex —
 * a second API replica, or an API server running while {@code openmetadata-ops.sh} reindexes in its
 * own process, never sees it. These tests pin the cluster-wide routing that closes that hole.
 */
class StagedIndexRoutingTest {

  private static final String TABLE = "table";
  private static final String TABLE_INDEX = "openmetadata_table_search_index";
  private static final String STAGED_TABLE_INDEX = "openmetadata_table_search_index_rebuild_42";

  private CollectionDAO collectionDAO;
  private SearchIndexJobDAO jobDAO;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    jobDAO = mock(SearchIndexJobDAO.class);
    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
  }

  /** The regression test for the write-loss bug: this node never called register(). */
  @Test
  @DisplayName("routes writes to a staged index registered by a different node")
  void routesToStagedIndexRegisteredElsewhere() {
    givenInFlightJobStaging(Map.of(TABLE, STAGED_TABLE_INDEX));
    StagedIndexRouting routing = alwaysRefreshingRouting();

    assertEquals(STAGED_TABLE_INDEX, routing.resolve(TABLE_INDEX));
  }

  @Test
  @DisplayName("fan-out targets include staged indices owned by other nodes")
  void fanoutIncludesRemoteStagedIndices() {
    givenInFlightJobStaging(Map.of(TABLE, STAGED_TABLE_INDEX));
    StagedIndexRouting routing = alwaysRefreshingRouting();

    assertTrue(routing.stagedIndices().contains(STAGED_TABLE_INDEX));
  }

  @Test
  @DisplayName("local registration resolves without touching the database")
  void localRegistrationNeedsNoDatabase() {
    StagedIndexRouting routing = new StagedIndexRouting(this::canonicalIndexFor, () -> null, -1L);
    routing.register(TABLE_INDEX, STAGED_TABLE_INDEX);

    assertEquals(STAGED_TABLE_INDEX, routing.resolve(TABLE_INDEX));
  }

  @Test
  @DisplayName("unregistering a locally staged index stops routing to it")
  void unregisterStopsRouting() {
    givenNoInFlightJobs();
    StagedIndexRouting routing = alwaysRefreshingRouting();
    routing.register(TABLE_INDEX, STAGED_TABLE_INDEX);

    assertTrue(routing.unregister(TABLE_INDEX, STAGED_TABLE_INDEX));
    assertNull(routing.resolve(TABLE_INDEX));
  }

  @Test
  @DisplayName("no in-flight reindex means writes stay on the canonical index")
  void noStagingMeansNoRouting() {
    givenNoInFlightJobs();
    StagedIndexRouting routing = alwaysRefreshingRouting();

    assertNull(routing.resolve(TABLE_INDEX));
  }

  /**
   * Dropping the snapshot when the database is briefly unreachable would silently reinstate the
   * write loss, so the previous snapshot must survive a failed refresh.
   */
  @Test
  @DisplayName("keeps the last known routing when the database read fails")
  void keepsSnapshotWhenDatabaseFails() {
    givenInFlightJobStaging(Map.of(TABLE, STAGED_TABLE_INDEX));
    StagedIndexRouting routing = alwaysRefreshingRouting();
    assertEquals(STAGED_TABLE_INDEX, routing.resolve(TABLE_INDEX));

    when(jobDAO.findByStatusesWithLimit(anyList(), anyInt()))
        .thenThrow(new IllegalStateException("database unavailable"));

    assertEquals(STAGED_TABLE_INDEX, routing.resolve(TABLE_INDEX));
  }

  @Test
  @DisplayName("a job with no staged mapping yet is ignored")
  void ignoresJobWithoutStagedMapping() {
    when(jobDAO.findByStatusesWithLimit(anyList(), anyInt())).thenReturn(List.of(jobRecord(null)));
    StagedIndexRouting routing = alwaysRefreshingRouting();

    assertNull(routing.resolve(TABLE_INDEX));
  }

  @Test
  @DisplayName("unparseable staged mapping is ignored rather than failing the write")
  void ignoresUnparseableStagedMapping() {
    when(jobDAO.findByStatusesWithLimit(anyList(), anyInt()))
        .thenReturn(List.of(jobRecord("not json at all")));
    StagedIndexRouting routing = alwaysRefreshingRouting();

    assertNull(routing.resolve(TABLE_INDEX));
  }

  @Test
  @DisplayName("only in-flight job statuses are consulted")
  void queriesOnlyInFlightStatuses() {
    givenNoInFlightJobs();
    alwaysRefreshingRouting().resolve(TABLE_INDEX);

    org.mockito.ArgumentCaptor<List<String>> statuses =
        org.mockito.ArgumentCaptor.forClass(List.class);
    org.mockito.Mockito.verify(jobDAO).findByStatusesWithLimit(statuses.capture(), anyInt());
    assertEquals(List.of("INITIALIZING", "READY", "RUNNING"), statuses.getValue());
  }

  private StagedIndexRouting alwaysRefreshingRouting() {
    return new StagedIndexRouting(this::canonicalIndexFor, () -> collectionDAO, -1L);
  }

  private void givenInFlightJobStaging(Map<String, String> stagedByEntityType) {
    String mappingJson = org.openmetadata.schema.utils.JsonUtils.pojoToJson(stagedByEntityType);
    when(jobDAO.findByStatusesWithLimit(anyList(), anyInt()))
        .thenReturn(List.of(jobRecord(mappingJson)));
  }

  private void givenNoInFlightJobs() {
    when(jobDAO.findByStatusesWithLimit(anyList(), anyInt())).thenReturn(List.of());
  }

  private String canonicalIndexFor(String entityType) {
    return TABLE.equals(entityType) ? TABLE_INDEX : null;
  }

  private SearchIndexJobRecord jobRecord(String stagedIndexMapping) {
    return new SearchIndexJobRecord(
        "job-1",
        "RUNNING",
        null,
        null,
        stagedIndexMapping,
        0L,
        0L,
        0L,
        0L,
        null,
        "admin",
        0L,
        null,
        null,
        0L,
        null,
        null,
        null);
  }
}
