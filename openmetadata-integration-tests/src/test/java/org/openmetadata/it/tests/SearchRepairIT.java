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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SearchDocuments;
import org.openmetadata.it.util.SearchRepairPasses;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchReindexLockDAO;
import org.openmetadata.service.search.SearchIndexRetryQueue;
import org.openmetadata.service.search.SearchRepairJob;
import org.openmetadata.service.search.SearchRepairScope;
import org.openmetadata.service.search.SearchVersionGuard;

/**
 * The scheduled search repair and recorded repairs put back what live writes missed, from the
 * database: a document search lost, a document whose row is gone, a child that missed its
 * parent's propagation, and the documents an unfinished update-by-query matched.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated("A repair pass rewrites and sweeps documents of every type")
@ExtendWith(TestNamespaceExtension.class)
class SearchRepairIT {
  private static final Duration REPAIR_WAIT = Duration.ofMinutes(2);
  private static final long LONG_AGO = 1_000_000_000_000L;

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void aPassIsLeftToTheServerAlreadyRunningOne() {
    final SearchReindexLockDAO locks = Entity.getCollectionDAO().searchReindexLockDAO();
    final String otherServersPass = UUID.randomUUID().toString();
    Awaitility.await("another server starts a repair pass")
        .atMost(REPAIR_WAIT)
        .pollInterval(Duration.ofSeconds(1))
        .until(() -> startPassOnAnotherServer(locks, otherServersPass));
    try {
      assertFalse(SearchRepairPasses.tryRun());
    } finally {
      locks.releaseLock(SearchRepairJob.LOCK_KEY, otherServersPass);
    }
    // The scheduler may take the freed lock first; this server runs one once it is free again.
    SearchRepairPasses.run();
  }

  private static boolean startPassOnAnotherServer(
      final SearchReindexLockDAO locks, final String passId) {
    final long now = System.currentTimeMillis();
    return locks.tryAcquireLock(
        SearchRepairJob.LOCK_KEY, passId, "another-server", now, now + REPAIR_WAIT.toMillis());
  }

  @Test
  void aDocumentSearchLostIsRebuiltByTheNextPass(final TestNamespace ns) throws Exception {
    final Topic topic = TopicTestFactory.createSimple(ns);
    final String topics = servingIndex(Entity.TOPIC);
    assertTrue(SearchDocuments.find(topics, topic.getId().toString()).isPresent());

    Entity.getSearchRepository().getSearchClient().deleteEntity(topics, topic.getId().toString());
    assertTrue(SearchDocuments.find(topics, topic.getId().toString()).isEmpty());

    SearchRepairPasses.run();

    assertTrue(
        SearchDocuments.find(topics, topic.getId().toString()).isPresent(),
        "the pass rebuilt the document of a row changed in its window");
  }

  @Test
  void aDocumentWhoseRowIsGoneIsSweptAway() throws Exception {
    final String topics = servingIndex(Entity.TOPIC);
    final String orphan = UUID.randomUUID().toString();
    SearchDocuments.put(
        topics,
        orphan,
        Map.of(
            "id",
            orphan,
            "name",
            "orphan_" + orphan,
            "fullyQualifiedName",
            "nowhere.orphan_" + orphan,
            "entityType",
            Entity.TOPIC,
            "deleted",
            false,
            "updatedAt",
            LONG_AGO,
            SearchVersionGuard.SOURCE_READ_AT,
            LONG_AGO));

    SearchRepairPasses.run(true);

    assertTrue(SearchDocuments.find(topics, orphan).isEmpty(), "the sweep removed the orphan");
  }

  @Test
  void aChildReadJustBeforeItsParentChangedIsRebuilt(final TestNamespace ns) throws Exception {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    final User owner = UserTestFactory.createUser(ns, "schemaowner");
    schema.setOwners(List.of(owner.getEntityReference()));
    final DatabaseSchema owned =
        SdkClients.adminClient().databaseSchemas().update(schema.getId().toString(), schema);
    final String tables = servingIndex(Entity.TABLE);
    // The table document as a server would have left it had it applied the table's write after
    // the schema's propagation: read just before the schema changed, without the new owner.
    SearchDocuments.update(
        tables,
        table.getId().toString(),
        Map.of("owners", List.of(), SearchVersionGuard.SOURCE_READ_AT, owned.getUpdatedAt() - 1));

    SearchRepairPasses.run();

    assertEquals(
        List.of(owner.getId().toString()),
        ownerIds(SearchDocuments.find(tables, table.getId().toString()).orElseThrow()));
  }

  @Test
  void aRecordedRepairRebuildsTheDocumentsItStillMatches(final TestNamespace ns) throws Exception {
    final MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    final Topic first = TopicTestFactory.createSimple(ns, service.getFullyQualifiedName());
    final Topic second = TopicTestFactory.createSimple(ns, service.getFullyQualifiedName());
    final String topics = servingIndex(Entity.TOPIC);
    for (final Topic topic : List.of(first, second)) {
      SearchDocuments.update(
          topics,
          topic.getId().toString(),
          Map.of("displayName", "stale", SearchVersionGuard.SOURCE_READ_AT, LONG_AGO));
    }

    SearchIndexRetryQueue.enqueueRepair(
        new SearchRepairScope(
            List.of(topics),
            SearchRepairScope.anyFieldEquals(List.of("service.id"), service.getId().toString()),
            System.currentTimeMillis()),
        "an update-by-query on the service's topics did not finish");

    Awaitility.await("The retry worker rebuilt every topic of the service")
        .atMost(REPAIR_WAIT)
        .ignoreExceptions()
        .until(
            () ->
                !"stale".equals(displayName(topics, first))
                    && !"stale".equals(displayName(topics, second)));
  }

  private static String displayName(final String index, final Topic topic) throws Exception {
    return SearchDocuments.find(index, topic.getId().toString())
        .orElseThrow()
        .path("displayName")
        .asText();
  }

  private static List<String> ownerIds(final JsonNode document) {
    final List<String> ids = new ArrayList<>();
    document.path("owners").forEach(owner -> ids.add(owner.path("id").asText()));
    return ids;
  }

  private static String servingIndex(final String entityType) {
    return Entity.getSearchRepository()
        .getIndexMapping(entityType)
        .getIndexName(Entity.getSearchRepository().getClusterAlias());
  }
}
