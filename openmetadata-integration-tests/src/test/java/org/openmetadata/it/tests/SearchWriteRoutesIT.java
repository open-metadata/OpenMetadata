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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.util.QueuedSearchWrites;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SearchDocuments;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexWriteRouteDAO;
import org.openmetadata.service.search.SearchRepository;

/**
 * A reindex running on another server registers the index it is building. Live writes this server
 * handles must reach that index while the registration is renewed, and stop once it is removed or
 * lapses; otherwise they are lost when the other server promotes its index. They keep reaching the
 * serving index too, so it stays current during the rebuild and loses nothing if the rebuild is
 * discarded.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated("Routes every live write for the entity type to a staged index")
@ExtendWith(TestNamespaceExtension.class)
class SearchWriteRoutesIT {
  private static final String OTHER_SERVER = "another-server";
  private static final Duration ROUTE_WAIT = Duration.ofSeconds(30);
  private static final long LEASE_MS = 60_000L;

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void writesReachTheServingIndexAndTheOneAnotherServerIsBuilding(final TestNamespace ns)
      throws Exception {
    final String topics = canonicalIndex(Entity.TOPIC);
    final String building = createStagedIndex(Entity.TOPIC);
    final Topic topic;
    try {
      routeTable().upsert(topics, building, OTHER_SERVER, System.currentTimeMillis() + LEASE_MS);
      awaitWritesGoTo(topics, List.of(topics, building));

      topic = TopicTestFactory.createSimple(ns);

      QueuedSearchWrites.await();
      Awaitility.await("Topic written to the index another server is building")
          .atMost(ROUTE_WAIT)
          .ignoreExceptions()
          .until(() -> SearchDocuments.find(building, topic.getId().toString()).isPresent());
      assertTrue(
          SearchDocuments.find(topics, topic.getId().toString()).isPresent(),
          "the serving index stays current while another index is built");
    } finally {
      routeTable().delete(topics, building);
      awaitWritesGoTo(topics, List.of(topics));
      searchRepository().getSearchClient().deleteIndex(building);
    }
    assertTrue(
        SearchDocuments.find(topics, topic.getId().toString()).isPresent(),
        "discarding the index being built loses no live write");
  }

  @Test
  void aRouteItsOwnerStoppedRenewingIsNotFollowed() {
    final String topics = canonicalIndex(Entity.TOPIC);
    final String dashboards = canonicalIndex(Entity.DASHBOARD);
    final String lapsed = createStagedIndex(Entity.TOPIC);
    final String renewed = createStagedIndex(Entity.DASHBOARD);
    try {
      final long now = System.currentTimeMillis();
      routeTable().upsert(topics, lapsed, OTHER_SERVER, now - 1);
      routeTable().upsert(dashboards, renewed, OTHER_SERVER, now + LEASE_MS);
      // Following the renewed route proves the server has read both rows since they were written.
      awaitWritesGoTo(dashboards, List.of(dashboards, renewed));

      assertEquals(List.of(topics), searchRepository().getDocumentWriteTargets(topics));
    } finally {
      routeTable().delete(topics, lapsed);
      routeTable().delete(dashboards, renewed);
      awaitWritesGoTo(dashboards, List.of(dashboards));
      searchRepository().getSearchClient().deleteIndex(lapsed);
      searchRepository().getSearchClient().deleteIndex(renewed);
    }
  }

  private static void awaitWritesGoTo(final String canonicalIndex, final List<String> targets) {
    Awaitility.await("Writes for " + canonicalIndex + " go to " + targets)
        .atMost(ROUTE_WAIT)
        .until(() -> targets.equals(searchRepository().getDocumentWriteTargets(canonicalIndex)));
  }

  private static String createStagedIndex(final String entityType) {
    final IndexMapping indexMapping = searchRepository().getIndexMapping(entityType);
    final String stagedIndex = canonicalIndex(entityType) + "_rebuild_" + System.nanoTime();
    searchRepository()
        .getSearchClient()
        .createIndex(stagedIndex, searchRepository().readIndexMapping(indexMapping));
    return stagedIndex;
  }

  private static String canonicalIndex(final String entityType) {
    return searchRepository()
        .getIndexMapping(entityType)
        .getIndexName(searchRepository().getClusterAlias());
  }

  private static SearchIndexWriteRouteDAO routeTable() {
    return Entity.getCollectionDAO().searchIndexWriteRouteDAO();
  }

  private static SearchRepository searchRepository() {
    return Entity.getSearchRepository();
  }
}
