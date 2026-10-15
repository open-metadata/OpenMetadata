/*
 *  Copyright 2024 Collate
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.QueuedSearchWrites;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;
import os.org.opensearch.client.opensearch.OpenSearchClient;

/**
 * Search-index read-your-write contract: a write commits the DB transaction, applies the sync cache
 * write-through, then indexes the entity in Elasticsearch synchronously post-commit before the
 * request returns. An entity is therefore searchable as soon as its create/update returns — there is
 * no eventual-consistency window for search.
 *
 * <ul>
 *   <li><b>Read-your-write</b>: GET /entity/&#123;id&#125; (DB + sync cache) is immediately
 *       consistent after create/update.
 *   <li><b>Search read-your-write</b>: the document is searchable immediately after the write
 *       returns (polled with Awaitility only to stay robust to Elasticsearch's own refresh latency).
 *   <li><b>Same-entity ordering</b>: a create immediately followed by an update is reflected in
 *       search as the FINAL value (never the stale create-time value, never a 404).
 * </ul>
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class AsyncSearchIndexConsistencyIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String TABLE_SEARCH_INDEX = "table_search_index";
  private static final Duration SEARCH_AT_MOST = Duration.ofSeconds(60);
  private static final Duration SEARCH_POLL = Duration.ofMillis(500);

  @Test
  void writeReturnsImmediatelyThenBecomesSearchable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, "async_visible", "first description");
    String tableId = table.getId().toString();

    Table byId = client.tables().get(tableId, "");
    assertNotNull(byId, "GET by id must be immediately consistent (DB + sync cache)");
    assertEquals(table.getId(), byId.getId());

    // Search indexing runs synchronously post-commit, so the entity is searchable as soon as the
    // write returns. We still poll with Awaitility to stay robust to Elasticsearch's own refresh
    // latency rather than asserting on the very first sample.
    awaitSearchHit(client, tableId);
  }

  @Test
  void sameEntityCreateThenUpdateConvergesToFinalValueInSearch(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(ns, "async_ordering", "stale description");

    String finalDescription = "FINAL description " + ns.shortPrefix();
    table.setDescription(finalDescription);
    Table updated = client.tables().update(table.getId().toString(), table);
    assertEquals(finalDescription, updated.getDescription(), "Update must be read-your-write");

    Awaitility.await("search converges to the final description, never the stale create-time value")
        .pollInterval(SEARCH_POLL)
        .atMost(SEARCH_AT_MOST)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              JsonNode source = searchSourceById(client, table.getId().toString());
              assertNotNull(source, "Doc not yet indexed");
              assertEquals(
                  finalDescription,
                  source.path("description").asText(""),
                  "Same-entity ordering must apply the update after the create");
            });
  }

  private void awaitSearchHit(OpenMetadataClient client, String entityId) {
    Awaitility.await("entity " + entityId + " becomes searchable")
        .pollInterval(SEARCH_POLL)
        .atMost(SEARCH_AT_MOST)
        .ignoreExceptions()
        .untilAsserted(
            () -> assertNotNull(searchSourceById(client, entityId), "Doc not yet searchable"));
  }

  @Test
  void nonVersionedVotesRefreshDerivedCounts(final TestNamespace namespace) {
    final Table table = ShortStackFactory.table(namespace);
    vote(table, VoteRequest.VoteType.VOTED_UP);
    assertIndexedVotes(table, 1, 0, 1);
    vote(table, VoteRequest.VoteType.VOTED_DOWN);
    assertIndexedVotes(table, 0, 1, 0);
    vote(table, VoteRequest.VoteType.UN_VOTED);
    assertIndexedVotes(table, 0, 0, 0);
  }

  @Test
  void followerDeltasPreserveOtherFollowers(final TestNamespace namespace) {
    final Table table = ShortStackFactory.table(namespace);
    final UUID first = UserTestFactory.createUser(namespace, "first_follower").getId();
    final UUID second = UserTestFactory.createUser(namespace, "second_follower").getId();
    addFollower(table, first);
    addFollower(table, second);
    awaitSource(table, source -> assertEquals(2, source.path("followers").size()));
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.DELETE,
            "/v1/tables/" + table.getId() + "/followers/" + first,
            null,
            ChangeEvent.class);
    awaitSource(
        table,
        source ->
            assertEquals(
                JsonUtils.readTree(JsonUtils.pojoToJson(List.of(second.toString()))),
                source.path("followers")));
  }

  @Test
  void descriptionDeletionClearsLiveSearchAndBulkReconstruction(final TestNamespace namespace)
      throws Exception {
    final Table table = ShortStackFactory.table(namespace);
    table.setDescription("Description to remove");
    SdkClients.adminClient().tables().update(table.getId().toString(), table);
    awaitSource(
        table,
        source -> assertEquals("Description to remove", source.path("description").asText()));
    SdkClients.adminClient()
        .tables()
        .patch(
            table.getId(), JsonUtils.readTree("[{\"op\":\"remove\",\"path\":\"/description\"}]"));
    assertNoDescription(table);
    rebuildMissingDocument(table);
    assertNoDescription(table);
  }

  @Test
  void patchRetainsAllSearchFieldsAndClearsRemovedRelationships(final TestNamespace namespace) {
    final var client = SdkClients.adminClient();
    final var owner = UserTestFactory.createUser(namespace, "patch_owner");
    final var domain =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("patch_domain"))
                    .withDescription("PATCH projection coverage")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));
    final Table table = ShortStackFactory.table(namespace);
    table.setOwners(List.of(new EntityReference().withId(owner.getId()).withType(Entity.USER)));
    table.setDomains(List.of(new EntityReference().withId(domain.getId()).withType(Entity.DOMAIN)));
    table.setDescription("Description survives PATCH");
    client.tables().update(table.getId().toString(), table);
    addFollower(table, owner.getId());
    vote(table, VoteRequest.VoteType.VOTED_UP);
    client
        .tables()
        .patch(
            table.getId(),
            JsonUtils.readTree(
                "[{\"op\":\"add\",\"path\":\"/displayName\",\"value\":\"Patched display name\"}]"));
    awaitSource(
        table,
        source -> {
          assertEquals("Patched display name", source.path("displayName").asText());
          assertEquals("Description survives PATCH", source.path("description").asText());
          assertEquals(owner.getId().toString(), source.path("owners").get(0).path("id").asText());
          assertEquals(
              domain.getId().toString(), source.path("domains").get(0).path("id").asText());
          assertEquals(owner.getId().toString(), source.path("followers").get(0).asText());
          assertEquals(1, source.path("totalVotes").asInt());
          assertEquals(table.getColumns().size(), source.path("columns").size());
        });
    client
        .tables()
        .patch(
            table.getId(),
            JsonUtils.readTree(
                "[{\"op\":\"remove\",\"path\":\"/owners\"},{\"op\":\"remove\",\"path\":\"/domains\"}]"));
    awaitSource(
        table,
        source -> {
          assertEquals(0, source.path("owners").size());
          assertEquals(0, source.path("domains").size());
          assertEquals(1, source.path("totalVotes").asInt());
          assertEquals(owner.getId().toString(), source.path("followers").get(0).asText());
          assertEquals("Description survives PATCH", source.path("description").asText());
        });
  }

  private void assertNoDescription(final Table table) {
    awaitSource(
        table,
        source -> {
          assertEquals("", source.path("description").asText(""));
          assertEquals("INCOMPLETE", source.path("descriptionStatus").asText());
        });
  }

  @Test
  void bulkReconstructionRestoresTheSameDocumentFieldsAsLiveWrites(final TestNamespace namespace)
      throws Exception {
    final Table table = ShortStackFactory.table(namespace);
    table.setDescription("Description from the database");
    SdkClients.adminClient().tables().update(table.getId().toString(), table);
    vote(table, VoteRequest.VoteType.VOTED_UP);
    addFollower(table, UserTestFactory.createUser(namespace, "rebuild_follower").getId());
    QueuedSearchWrites.await();
    final JsonNode live = searchSourceById(SdkClients.adminClient(), table.getId().toString());
    assertNotNull(live);
    rebuildMissingDocument(table);
    awaitSource(
        table,
        rebuilt -> {
          assertEquals("Description from the database", rebuilt.path("description").asText());
          assertEquals(1, rebuilt.path("totalVotes").asInt());
          assertEquals(1, rebuilt.path("followers").size());
          assertEquals(table.getColumns().size(), rebuilt.path("columns").size());
          for (String field :
              List.of(
                  "id",
                  "name",
                  "description",
                  "descriptionStatus",
                  "descriptionSources",
                  "votes",
                  "totalVotes",
                  "followers",
                  "columns",
                  "domains",
                  "owners",
                  "tags")) {
            assertEquals(
                live.path(field), rebuilt.path(field), "Field changed during rebuild: " + field);
          }
        });
  }

  private void rebuildMissingDocument(final Table table) throws Exception {
    final SearchRepository search = Entity.getSearchRepository();
    search
        .getSearchClient()
        .deleteEntity(
            search.getWriteIndexName(search.getIndexMapping(Entity.TABLE)),
            table.getId().toString());
    Awaitility.await()
        .atMost(SEARCH_AT_MOST)
        .untilAsserted(
            () -> assertNull(searchSourceById(SdkClients.adminClient(), table.getId().toString())));
    final PaginatedEntitiesSource source =
        new PaginatedEntitiesSource(
            Entity.TABLE, 100, ReindexingUtil.getSearchIndexFields(Entity.TABLE));
    final Map<String, Object> context = new HashMap<>();
    context.put(ReindexingUtil.ENTITY_TYPE_KEY, Entity.TABLE);
    boolean found = false;
    final BulkSink sink = search.createBulkSink(100, 1, 5_000_000);
    try {
      ResultList<? extends EntityInterface<?>> page;
      while ((page = source.readNext(context)) != null) {
        final List<? extends EntityInterface<?>> selected =
            page.getData().stream().filter(entity -> entity.getId().equals(table.getId())).toList();
        if (!selected.isEmpty()) {
          ReindexingUtil.populateDocBuildContext(context, Entity.TABLE, selected);
          sink.write(selected, context);
          found = true;
        }
      }
      assertTrue(found, "The real reindex reader must load the table");
      assertTrue(sink.flushAndAwait(60));
      assertEquals(0, sink.getStats().getFailedRecords());
    } finally {
      sink.close();
    }
  }

  private static void vote(final Table table, final VoteRequest.VoteType type) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/tables/" + table.getId() + "/vote",
            new VoteRequest().withUpdatedVoteType(type),
            ChangeEvent.class);
  }

  @Test
  void missingDocumentDuringFollowerUpdateIsRecoveredCompletely(final TestNamespace namespace)
      throws Exception {
    final Table table = ShortStackFactory.table(namespace);
    final UUID follower = UserTestFactory.createUser(namespace, "missing_doc_follower").getId();
    // The table's own create must land first, or it can recreate the document after the delete.
    QueuedSearchWrites.await();
    final SearchRepository search = Entity.getSearchRepository();
    search
        .getSearchClient()
        .deleteEntity(
            search.getWriteIndexName(search.getIndexMapping(Entity.TABLE)),
            table.getId().toString());
    addFollower(table, follower);
    awaitSource(
        table,
        source -> {
          assertEquals(table.getId().toString(), source.path("id").asText());
          assertEquals(table.getName(), source.path("name").asText());
          assertEquals(follower.toString(), source.path("followers").path(0).asText());
          assertFalse(source.has("followersToAdd"));
          assertFalse(source.has("followersToRemove"));
        });
  }

  @Test
  void partialWriteToEmptyStagedIndexLoadsCompleteDocument(final TestNamespace namespace)
      throws Exception {
    final Table table = ShortStackFactory.table(namespace);
    final UUID follower = UserTestFactory.createUser(namespace, "staged_follower").getId();
    // The table's own create must land before the staged index exists, so only the partial
    // follower write can put the document there.
    QueuedSearchWrites.await();
    final SearchRepository search = Entity.getSearchRepository();
    final var mapping = search.getIndexMapping(Entity.TABLE);
    final String staged =
        mapping.getIndexName(search.getClusterAlias()) + "_rebuild_" + UUID.randomUUID();
    search.getSearchClient().createIndex(staged, search.readIndexMapping(mapping));
    search.registerStagedIndex(Entity.TABLE, staged);
    try {
      addFollower(table, follower);
      QueuedSearchWrites.await();
      final JsonNode indexed = stagedSource(search, staged, table.getId());
      assertEquals(table.getName(), indexed.path("name").asText());
      assertEquals(table.getColumns().size(), indexed.path("columns").size());
      assertEquals(follower.toString(), indexed.path("followers").get(0).asText());
      assertEquals(
          table.getDatabaseSchema().getId().toString(),
          indexed.path("databaseSchema").path("id").asText());
      assertTrue(
          Entity.getCollectionDAO()
              .searchIndexRetryQueueDAO()
              .findByStatus("PENDING", 1000)
              .stream()
              .noneMatch(row -> table.getId().toString().equals(row.getEntityId())),
          "The staged write must not need a retry");
    } finally {
      search.unregisterStagedIndex(Entity.TABLE, staged);
      search.getSearchClient().deleteIndex(staged);
    }
  }

  private static JsonNode stagedSource(
      final SearchRepository search, final String index, final UUID id) throws Exception {
    final Object client = search.getSearchClient().getHighLevelClient();
    if (client instanceof ElasticsearchClient elastic) {
      final var document =
          elastic.get(request -> request.index(index).id(id.toString()), Map.class);
      assertTrue(
          document.found(),
          "A partial live write must create the complete staged document immediately");
      return JsonUtils.readTree(JsonUtils.pojoToJson(document.source()));
    }
    final var document =
        ((OpenSearchClient) client)
            .get(request -> request.index(index).id(id.toString()), Map.class);
    assertTrue(
        document.found(),
        "A partial live write must create the complete staged document immediately");
    return JsonUtils.readTree(JsonUtils.pojoToJson(document.source()));
  }

  private static void addFollower(final Table table, final UUID follower) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/tables/" + table.getId() + "/followers",
            follower,
            ChangeEvent.class);
  }

  private void assertIndexedVotes(
      final Table table, final int up, final int down, final int total) {
    awaitSource(
        table,
        source -> {
          assertEquals(up, source.path("votes").path("upVotes").asInt(-1));
          assertEquals(down, source.path("votes").path("downVotes").asInt(-1));
          assertEquals(total, source.path("totalVotes").asInt(-1));
        });
  }

  private void awaitSource(final Table table, final Consumer<JsonNode> assertion) {
    Awaitility.await()
        .pollInterval(SEARCH_POLL)
        .atMost(SEARCH_AT_MOST)
        .untilAsserted(
            () -> {
              final JsonNode source =
                  searchSourceById(SdkClients.adminClient(), table.getId().toString());
              assertNotNull(source, "Document not yet indexed");
              assertion.accept(source);
            });
  }

  private JsonNode searchSourceById(OpenMetadataClient client, String entityId) throws Exception {
    // A term filter avoids expanding long FQNs into the search engine's boolean-clause limit.
    String filter = JsonUtils.pojoToJson(Map.of("query", Map.of("term", Map.of("_id", entityId))));
    String response =
        client
            .search()
            .query("*")
            .index(TABLE_SEARCH_INDEX)
            .queryFilter(filter)
            .size(10)
            .deleted(false)
            .execute();
    JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
    JsonNode result = null;
    for (JsonNode hit : hits) {
      if (entityId.equals(hit.path("_source").path("id").asText(""))) {
        result = hit.path("_source");
        break;
      }
    }
    return result;
  }

  private Table createTable(TestNamespace ns, String baseName, String description) {
    String shortId = ns.shortPrefix();
    DatabaseService dbService =
        DatabaseServices.builder()
            .name("async_svc_" + shortId + "_" + baseName)
            .connection(
                DatabaseServices.postgresConnection()
                    .hostPort("localhost:5432")
                    .username("test")
                    .build())
            .description("Async consistency test service")
            .create();

    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("async_db_" + shortId + "_" + baseName);
    dbReq.setService(dbService.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("async_schema_" + shortId + "_" + baseName);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setDescription(description);
    tableRequest.setColumns(
        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
    return SdkClients.adminClient().tables().create(tableRequest);
  }
}
