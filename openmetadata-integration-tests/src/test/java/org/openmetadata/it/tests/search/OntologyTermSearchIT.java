package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.OntologyChunkIndex;
import org.openmetadata.service.search.OntologyTermSearch;
import org.openmetadata.service.search.vector.VectorDocBuilder;

@ExtendWith(TestNamespaceExtension.class)
@ResourceLock("SEARCH_INDEX_APP")
class OntologyTermSearchIT {
  private static final String ALIAS = "ontologyTerms";

  @Test
  void findsOnlyActiveTermsAndRefreshesBindingsAndDeletion(TestNamespace ns) {
    final String purchase = RankingSupport.uniqueTerm(ns);
    final var ontology = createOntology(ns);
    try {
      final var order = createOrder(ontology, purchase);
      final var property = createProperty(ontology, order);
      assertThat(find(ALIAS, purchase, order)).isNull();

      activate(ontology);
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(
              () -> {
                assertThat(find(ALIAS, "Order", order)).isNotNull();
                assertThat(find(ALIAS, purchase, order)).isNotNull();
                assertThat(find(ALIAS, "tracking", property).path("domainLabels").get(0).asText())
                    .isEqualTo("Order");
                assertThat(find(ALIAS, "Order", property)).isNotNull();
                assertThat(find("ontologyProperty", "string", property)).isNotNull();
                assertThat(find("all", purchase, order)).isNull();
              });

      editDraft(order);
      assertThat(find(ALIAS, "shipment", order)).isNull();
      assertThat(find(ALIAS, purchase, order)).isNotNull();

      final var table = createTable(ns);
      bind(order, table, List.of(), 0);
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(
              () ->
                  assertThat(boundAssets(purchase, order))
                      .containsExactly(table.getFullyQualifiedName()));
      bind(
          order,
          table,
          List.of(
              new OntologyColumnBinding()
                  .withPropertyId(property.getId())
                  .withColumnPath(List.of("code"))),
          1);
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(
              () ->
                  assertThat(boundAssets(purchase, order))
                      .containsExactlyInAnyOrder(
                          table.getFullyQualifiedName(),
                          table.getColumns().getFirst().getFullyQualifiedName()));

      final var draft =
          SdkClients.adminClient()
              .ontologyConcepts()
              .create(
                  new CreateOntologyConcept()
                      .withName("DraftOnly")
                      .withConceptType(OntologyConceptType.OWL_CLASS)
                      .withOntology(ontology.getFullyQualifiedName()));
      reindexTerms();
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(
              () -> {
                assertThat(boundAssets(purchase, order)).contains(table.getFullyQualifiedName());
                assertThat(find(ALIAS, "tracking", property)).isNotNull();
                assertThat(find(ALIAS, "DraftOnly", draft)).isNull();
                assertThat(find(ALIAS, "shipment", order)).isNull();
              });

      SdkClients.adminClient().ontologyProperties().delete(property.getId());
      SdkClients.adminClient()
          .getHttpClient()
          .execute(HttpMethod.DELETE, "/v1/ontologyConcepts/" + order.getId(), null, Void.class);
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(() -> assertThat(find(ALIAS, purchase, order)).isNull());
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.PUT,
              "/v1/ontologyConcepts/restore",
              new RestoreEntity().withId(order.getId()),
              OntologyConcept.class);
      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(() -> assertThat(find(ALIAS, purchase, order)).isNotNull());
    } finally {
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.DELETE,
              "/v1/ontologies/" + ontology.getId() + "?recursive=true",
              null,
              Void.class);
    }
  }

  @Test
  void manualReindexKeepsPublishedTermsAndEmbeddingMetadata(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode());
    final var ontology = createOntology(ns);
    try {
      final var query = RankingSupport.uniqueTerm(ns);
      final var order = createOrder(ontology, query);
      final var property = createProperty(ontology, order);
      final var table = createTable(ns);
      activate(ontology);
      bind(order, table, List.of(), 0);
      final var draft = createConcept(ontology, "Unpublished");
      final var published = rawTerm(order);
      final var publishedProperty = indexedTermDocument(property).path("_source");
      final var active = OntologyTermSearch.activeIndex(order.getEntityReference());
      final var fingerprint =
          VectorDocBuilder.computeFingerprintForEntity(active.term(), active.embeddingBody());
      final var search = Entity.getSearchRepository();
      final var index =
          search.getIndexMapping(Entity.ONTOLOGY_CONCEPT).getIndexName(search.getClusterAlias());
      new SearchClient(OssTestServer.defaultHandle())
          .post(
              "/" + index + "/_update/" + order.getId() + "?refresh=true",
              JsonUtils.pojoToJson(
                  Map.of(
                      "doc",
                      Map.of("fingerprint", fingerprint, "textToEmbed", active.embeddingBody()))));
      editDraft(order);
      patch("/v1/ontologyProperties/" + property.getId(), "add", "/displayName", "Draft property");
      final long sequence = indexedTermDocument(property).path("_seq_no").asLong();

      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.POST,
              "/v1/search/reindexEntities",
              List.of(
                  draft.getEntityReference(),
                  order.getEntityReference(),
                  property.getEntityReference()),
              Void.class);

      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(
              () ->
                  assertThat(indexedTermDocument(property).path("_seq_no").asLong())
                      .isGreaterThan(sequence));
      final var reindexed = indexedTermDocument(order).path("_source");
      assertThat(reindexed.path("description")).isEqualTo(published.path("description"));
      assertThat(reindexed.path("boundAssetIds")).isEqualTo(published.path("boundAssetIds"));
      assertThat(reindexed.path("fingerprint").asText()).isEqualTo(fingerprint);
      assertThat(reindexed.path("textToEmbed").asText()).isEqualTo(active.embeddingBody());
      final var reindexedProperty = indexedTermDocument(property).path("_source");
      assertThat(reindexedProperty.path("displayName"))
          .isEqualTo(publishedProperty.path("displayName"));
      assertThat(reindexedProperty.path("domainLabels"))
          .isEqualTo(publishedProperty.path("domainLabels"));
      assertThat(reindexedProperty.path("rangeLabels"))
          .isEqualTo(publishedProperty.path("rangeLabels"));
      assertThat(find(ALIAS, "Unpublished", draft)).isNull();
    } finally {
      deleteOntology(ontology);
    }
  }

  @Test
  void keepsBindingNamesPrivateAcrossSearchEndpoints(TestNamespace ns) {
    SearchAccessRulesIT.assumeTheServerTrustsHarnessSignedTokens();
    final var ontology = createOntology(ns);
    final var cleanup = new ArrayDeque<Runnable>();
    try {
      final var order = createOrder(ontology, RankingSupport.uniqueTerm(ns));
      final var table = createTable(ns);
      final var admin = SdkClients.adminClient();
      final var reader =
          SearchAccessRulesIT.deniedUser(admin, ns.shortPrefix(), "table", null, cleanup);
      assertThatThrownBy(() -> reader.tables().get(table.getId()))
          .isInstanceOfSatisfying(
              OpenMetadataException.class,
              failure -> assertThat(failure.getStatusCode()).isEqualTo(403));
      activate(ontology);
      bind(order, table, List.of(), 0);
      final var raw = rawTerm(order);
      assertThat(raw.path("boundAssetIds").get(0).asText()).isEqualTo(table.getId().toString());
      assertThat(raw.has("boundAssets")).isFalse();

      final var paths =
          List.of(
              "/query?q=id:" + order.getId(),
              "/fieldQuery?fieldName=id.keyword&fieldValue=" + order.getId(),
              "/nlq/query?q=id:" + order.getId());
      for (var path : paths) {
        final var adminHit = find(admin, path + "&index=" + ALIAS, order);
        assertThat(adminHit).as(path).isNotNull();
        assertThat(adminHit.path("boundAssets").toString()).contains(table.getFullyQualifiedName());
        final var readerHit = find(reader, path + "&index=" + ALIAS, order);
        assertThat(readerHit).as(path).isNotNull();
        assertThat(readerHit.toString()).as(path).doesNotContain(table.getFullyQualifiedName());
      }
    } finally {
      deleteOntology(ontology);
      cleanup.forEach(Runnable::run);
    }
  }

  @Test
  void refreshesInheritedOwnersAndChangedTables(TestNamespace ns) {
    final var ontology = createOntology(ns);
    try {
      final var query = RankingSupport.uniqueTerm(ns);
      final var order = createOrder(ontology, query);
      final var property = createProperty(ontology, order);
      final var table = createTable(ns);
      activate(ontology);
      bind(
          order,
          table,
          List.of(
              new OntologyColumnBinding()
                  .withPropertyId(property.getId())
                  .withColumnPath(List.of("code"))),
          0);
      final var owner = UserTestFactory.createUser(ns, ns.shortPrefix("ontology_owner"));
      patch(
          "/v1/ontologies/" + ontology.getId(),
          "add",
          "/owners",
          List.of(new EntityReference().withId(owner.getId()).withType("user")));
      await()
          .atMost(Duration.ofSeconds(20))
          .untilAsserted(
              () -> {
                assertThat(find(ALIAS, query, order).path("owners").toString())
                    .contains(owner.getId().toString());
                assertThat(find(ALIAS, "tracking", property).path("owners").toString())
                    .contains(owner.getId().toString());
              });
      assertThat(boundAssets(query, order))
          .containsExactlyInAnyOrder(
              table.getFullyQualifiedName(), table.getColumns().getFirst().getFullyQualifiedName());
      final var originalColumnFqn = table.getColumns().getFirst().getFullyQualifiedName();
      final long indexedVersion = indexedTermDocument(order).path("_version").asLong();
      final var columns =
          List.of(new Column().withName("renamed_code").withDataType(ColumnDataType.STRING));
      final var renamed =
          SdkClients.adminClient()
              .tables()
              .update(table.getId().toString(), table.withColumns(columns));
      assertThat(renamed.getColumns().getFirst().getFullyQualifiedName())
          .isNotEqualTo(originalColumnFqn);
      await()
          .atMost(Duration.ofSeconds(20))
          .untilAsserted(
              () ->
                  assertThat(boundAssets(query, order))
                      .containsExactly(renamed.getFullyQualifiedName()));
      assertThat(indexedTermDocument(order).path("_version").asLong())
          .as("Column names are resolved at read time without rewriting the term document")
          .isEqualTo(indexedVersion);
      SdkClients.adminClient().tables().delete(table.getId());
      await()
          .atMost(Duration.ofSeconds(20))
          .untilAsserted(
              () -> {
                assertThat(boundAssets(query, order)).isEmpty();
                assertThat(rawTerm(order).path("boundAssetIds").isEmpty()).isTrue();
              });
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.PUT,
              "/v1/tables/restore",
              new RestoreEntity().withId(table.getId()),
              Table.class);
      await()
          .atMost(Duration.ofSeconds(20))
          .untilAsserted(
              () -> {
                assertThat(boundAssets(query, order)).contains(renamed.getFullyQualifiedName());
                assertThat(rawTerm(order).path("boundAssetIds").get(0).asText())
                    .isEqualTo(table.getId().toString());
              });
    } finally {
      deleteOntology(ontology);
    }
  }

  @Test
  void replacesTheActiveRelease(TestNamespace ns) {
    final var ontology = createOntology(ns);
    try {
      final var order = createOrder(ontology, RankingSupport.uniqueTerm(ns));
      final var removed = createConcept(ontology, "Removed");
      final var deprecated = createConcept(ontology, "Deprecated");
      activate(ontology);
      for (var term : List.of(order, removed, deprecated)) {
        assertThat(find(ALIAS, term.getName(), term)).isNotNull();
      }
      patch("/v1/ontologyConcepts/" + order.getId(), "add", "/displayName", "Purchase");
      patch("/v1/ontologyConcepts/" + deprecated.getId(), "add", "/deprecated", true);
      SdkClients.adminClient().ontologyConcepts().delete(removed.getId());
      final var next = capture(ontology);
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.PUT,
              "/v1/ontologyConcepts/restore",
              new RestoreEntity().withId(removed.getId()),
              OntologyConcept.class);
      assertThat(find(ALIAS, "Removed", removed)).isNotNull();
      assertThat(find(ALIAS, "Deprecated", deprecated)).isNotNull();
      activate(ontology, next);
      assertThat(find(ALIAS, "Purchase", order).path("displayName").asText()).isEqualTo("Purchase");
      assertThat(find(ALIAS, "Removed", removed)).isNull();
      assertThat(find(ALIAS, "Deprecated", deprecated)).isNull();
    } finally {
      deleteOntology(ontology);
    }
  }

  @Test
  void releaseRefreshWaitsForAnInFlightWriteAndRejectsAnOldEmbedding(TestNamespace ns)
      throws Exception {
    assumeFalse(OssTestServer.isExternalMode());
    final var ontology = createOntology(ns);
    try (var workers = Executors.newFixedThreadPool(2)) {
      final var order = createOrder(ontology, RankingSupport.uniqueTerm(ns));
      activate(ontology);
      final var reference = order.getEntityReference();
      final var original = OntologyTermSearch.activeIndex(reference);
      final var oldFingerprint =
          VectorDocBuilder.computeFingerprintForEntity(original.term(), original.embeddingBody());
      patch("/v1/ontologyConcepts/" + order.getId(), "add", "/displayName", "Purchase");
      final var next = capture(ontology);

      final var locked = new CountDownLatch(1);
      final var finishWrite = new CountDownLatch(1);
      final var olderWrite =
          workers.submit(
              () -> {
                OntologyTermSearch.writeCurrentEmbedding(
                    reference,
                    oldFingerprint,
                    () -> {
                      locked.countDown();
                      assertThat(finishWrite.await(30, TimeUnit.SECONDS)).isTrue();
                    });
                return null;
              });
      try {
        assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue();
        final var activation = workers.submit(() -> activate(ontology, next));
        await()
            .atMost(Duration.ofSeconds(10))
            .untilAsserted(
                () ->
                    assertThat(
                            SdkClients.adminClient()
                                .ontologies()
                                .state(ontology.getId())
                                .getActiveReleaseId())
                        .isEqualTo(next));
        assertThatThrownBy(() -> activation.get(1, TimeUnit.SECONDS))
            .isInstanceOf(TimeoutException.class);
        assertThat(find(ALIAS, "Order", order).path("displayName").asText()).isEqualTo("Order");
        finishWrite.countDown();
        olderWrite.get(10, TimeUnit.SECONDS);
        activation.get(10, TimeUnit.SECONDS);
      } finally {
        finishWrite.countDown();
      }

      assertThat(find(ALIAS, "Purchase", order).path("displayName").asText()).isEqualTo("Purchase");
      OntologyTermSearch.writeCurrentEmbedding(
          reference,
          oldFingerprint,
          () -> {
            throw new AssertionError("Stale embedding was applied");
          });
    } finally {
      deleteOntology(ontology);
    }
  }

  @Test
  void termWritesDoNotCreateAChunkIndexWithEmbeddingsDisabled(TestNamespace ns) throws Exception {
    assumeFalse(OssTestServer.isExternalMode());
    assumeTrue(
        Entity.getSearchRepository().getSearchClient()
            instanceof org.openmetadata.service.search.opensearch.OpenSearchClient);
    assumeFalse(Entity.getSearchRepository().isVectorEmbeddingEnabled());
    final var client = new SearchClient(OssTestServer.defaultHandle());
    final var index = OntologyChunkIndex.name();
    assumeFalse(client.indexExists(index), "Requires an absent ontology chunk index");
    final var ontology = createOntology(ns);
    try {
      final var term = createConcept(ontology, "WithoutChunks");
      activate(ontology);
      final var published = indexedTermDocument(term);
      final long version = published.path("_version").asLong();

      patch("/v1/ontologyConcepts/" + term.getId(), "add", "/description", "A working draft");
      Entity.getSearchRepository().reindexOntologyTerm(term.getEntityReference());

      assertThat(indexedTermDocument(term).path("_version").asLong()).isGreaterThan(version);
      assertThat(indexedTermDocument(term).path("_source").path("description"))
          .isEqualTo(published.path("_source").path("description"));
      assertThat(client.indexExists(index)).isFalse();
    } finally {
      deleteOntology(ontology);
    }
  }

  @Test
  void liveWritesAndReindexCleanChunksWithEmbeddingsDisabled(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode());
    assumeTrue(
        Entity.getSearchRepository().getSearchClient()
            instanceof org.openmetadata.service.search.opensearch.OpenSearchClient);
    assumeFalse(Entity.getSearchRepository().isVectorEmbeddingEnabled());
    final var client = new SearchClient(OssTestServer.defaultHandle());
    final var index = OntologyChunkIndex.name();
    final var ontology = createOntology(ns);
    final var missing = UUID.randomUUID();
    final boolean createIndex = !client.indexExists(index);
    try {
      final var active = createConcept(ontology, "Indexed");
      activate(ontology);
      final var draft = createConcept(ontology, "Unpublished");
      if (createIndex) {
        client.put(
            "/" + index,
            """
            {"mappings":{"properties":{
              "parentId":{"type":"keyword"},
              "entityType":{"type":"keyword"},
              "fingerprint":{"type":"keyword"}
            }}}
            """);
      }
      final var published = OntologyTermSearch.activeIndex(active.getEntityReference());
      final var fingerprint =
          VectorDocBuilder.computeFingerprintForEntity(published.term(), published.embeddingBody());
      seedChunk(client, index, active.getId(), 0, fingerprint);
      seedChunk(client, index, active.getId(), 1, "old-release");
      seedChunk(client, index, draft.getId(), 0, "unpublished");
      seedChunk(client, index, missing, 0, "missing");

      assertThat(chunkCount(client, index, active.getId())).isEqualTo(2);
      assertThat(chunkCount(client, index, draft.getId())).isEqualTo(1);

      patch("/v1/ontologyConcepts/" + active.getId(), "add", "/description", "A working draft");
      patch("/v1/ontologyConcepts/" + draft.getId(), "add", "/description", "An unpublished draft");

      await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(
              () -> {
                assertThat(chunkCount(client, index, active.getId())).isEqualTo(1);
                assertThat(chunkCount(client, index, draft.getId())).isZero();
              });
      assertThat(
              client
                  .get("/" + index + "/_doc/" + active.getId() + "_0")
                  .path("_source")
                  .path("fingerprint")
                  .asText())
          .isEqualTo(fingerprint);
      assertThat(chunkCount(client, index, missing)).isEqualTo(1);

      reindexTerms();

      assertThat(chunkCount(client, index, active.getId())).isEqualTo(1);
      assertThat(chunkCount(client, index, draft.getId())).isZero();
      assertThat(chunkCount(client, index, missing)).isZero();
    } finally {
      if (createIndex) {
        client.delete("/" + index);
      } else {
        client.delete("/" + index + "/_doc/" + missing + "_0?refresh=true");
      }
      deleteOntology(ontology);
    }
  }

  private static void seedChunk(
      SearchClient client, String index, UUID id, int chunk, String fingerprint) {
    client.put(
        "/" + index + "/_doc/" + id + "_" + chunk + "?refresh=true",
        JsonUtils.pojoToJson(
            Map.of("entityType", "ontologyConcept", "parentId", id, "fingerprint", fingerprint)));
  }

  private static long chunkCount(SearchClient client, String index, UUID parent) {
    return client
        .count(
            index,
            JsonUtils.pojoToJson(Map.of("query", Map.of("term", Map.of("parentId", parent)))))
        .path("count")
        .asLong();
  }

  private static OntologyConcept createConcept(Ontology ontology, String name) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName(name)
                .withConceptType(OntologyConceptType.OWL_CLASS)
                .withOntology(ontology.getFullyQualifiedName()));
  }

  private static void deleteOntology(Ontology ontology) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.DELETE,
            "/v1/ontologies/" + ontology.getId() + "?recursive=true",
            null,
            Void.class);
  }

  private static void patch(String path, String operation, String field, Object value) {
    final var patch = JsonUtils.getObjectMapper().createArrayNode();
    patch
        .addObject()
        .put("op", operation)
        .put("path", field)
        .set("value", JsonUtils.getObjectMapper().valueToTree(value));
    SdkClients.adminClient().getHttpClient().execute(HttpMethod.PATCH, path, patch, JsonNode.class);
  }

  private static void editDraft(OntologyConcept term) {
    final var patch = JsonUtils.getObjectMapper().createArrayNode();
    patch.addObject().put("op", "replace").put("path", "/description").put("value", "A shipment");
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PATCH, "/v1/ontologyConcepts/" + term.getId(), patch, OntologyConcept.class);
  }

  private static void reindexTerms() {
    final var server = OssTestServer.defaultHandle();
    final var timeout = Duration.ofMinutes(2);
    final long triggeredAt = System.currentTimeMillis();
    ReindexHelpers.triggerSearchIndexWithConfigWhenIdle(
        server, Map.of("entities", List.of("ontologyConcept", "ontologyProperty")), timeout);
    await()
        .atMost(timeout)
        .until(
            () ->
                ReindexHelpers.freshRunIsTerminal(
                    server, ReindexHelpers.SEARCH_INDEX_APP, triggeredAt));
    final var run = ReindexHelpers.fetchLatestRun(server, ReindexHelpers.SEARCH_INDEX_APP);
    assertThat(ReindexHelpers.isSuccess(run))
        .as("Search reindex finished with status %s", ReindexHelpers.statusOf(run))
        .isTrue();
  }

  private static Ontology createOntology(TestNamespace ns) {
    return SdkClients.adminClient()
        .ontologies()
        .create(
            new CreateOntology()
                .withName(ns.prefix("SearchOntology"))
                .withIri(URI.create("https://example.org/" + ns.shortPrefix()))
                .withNamespace(URI.create("https://example.org/" + ns.shortPrefix() + "/")));
  }

  private static OntologyConcept createOrder(Ontology ontology, String purchase) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName("Order")
                .withDescription("One " + purchase + " by a customer")
                .withConceptType(OntologyConceptType.OWL_CLASS)
                .withOntology(ontology.getFullyQualifiedName()));
  }

  private static OntologyProperty createProperty(Ontology ontology, OntologyConcept order) {
    return SdkClients.adminClient()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName("code")
                .withDescription("The tracking number")
                .withKind(OntologyPropertyKind.DATA)
                .withDomain(List.of(order.getIri()))
                .withRange(List.of(URI.create("http://www.w3.org/2001/XMLSchema#string")))
                .withOntology(ontology.getFullyQualifiedName()));
  }

  private static void activate(Ontology ontology) {
    activate(ontology, capture(ontology));
  }

  private static UUID capture(Ontology ontology) {
    final var ontologies = SdkClients.adminClient().ontologies();
    return ontologies
        .capture(
            ontology.getId(),
            new CaptureOntologyRelease()
                .withExpectedWorkingRevision(
                    ontologies.state(ontology.getId()).getWorkingRevision()))
        .getId();
  }

  private static void activate(Ontology ontology, UUID releaseId) {
    final var ontologies = SdkClients.adminClient().ontologies();
    ontologies.activate(
        ontology.getId(),
        new ActivateOntologyRelease()
            .withReleaseId(releaseId)
            .withExpectedActivationRevision(
                ontologies.state(ontology.getId()).getActivationRevision()));
  }

  private static Table createTable(TestNamespace ns) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix("orders"))
                .withDatabaseSchema(
                    DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName())
                .withColumns(
                    List.of(new Column().withName("code").withDataType(ColumnDataType.STRING))));
  }

  private static void bind(
      OntologyConcept concept, Table table, List<OntologyColumnBinding> columns, long revision) {
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/ontologyConcepts/" + concept.getId() + "/bindings",
            new UpdateOntologyConceptBinding()
                .withExpectedRevision(revision)
                .withAsset(
                    new OntologyAssetBinding()
                        .withAssetType(OntologyBindingAssetType.TABLE)
                        .withAssetId(table.getId())
                        .withColumns(columns)),
            OntologyConceptBindingsResponse.class);
  }

  private static JsonNode rawTerm(OntologyConcept concept) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/search/get/ontologyConcept/doc/" + concept.getId(),
            null,
            JsonNode.class);
  }

  private static JsonNode indexedTermDocument(EntityInterface<?> term) {
    final var search = Entity.getSearchRepository();
    final var index =
        search
            .getIndexMapping(term.getEntityReference().getType())
            .getIndexName(search.getClusterAlias());
    return new SearchClient(OssTestServer.defaultHandle())
        .get("/" + index + "/_doc/" + term.getId());
  }

  private static List<String> boundAssets(String query, OntologyConcept term) {
    final var hit = find(ALIAS, query, term);
    assertThat(hit).isNotNull();
    return StreamSupport.stream(hit.path("boundAssets").spliterator(), false)
        .map(JsonNode::asText)
        .toList();
  }

  private static JsonNode find(String alias, String query, EntityInterface<?> term) {
    return find(
        SdkClients.adminClient(), "/query?index=" + alias + "&q=" + query + "&size=100", term);
  }

  private static JsonNode find(OpenMetadataClient client, String path, EntityInterface<?> term) {
    final var response =
        client.getHttpClient().execute(HttpMethod.GET, "/v1/search" + path, null, JsonNode.class);
    for (var hit : response.path("hits").path("hits")) {
      final var source = hit.path("_source");
      if (term.getId().toString().equals(source.path("id").asText())) {
        return source;
      }
    }
    return null;
  }
}
