package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyColumnBindingState;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class OntologyConceptBindingsIT extends BaseOntologyApprovalIT {
  @Test
  void catalogLinksPersistWithoutChangingDefinitionsTagsOrReleaseDigests(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var concept = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var property = property(ontology, concept);
    final var table = table(ns);
    final var before = capture(ontology);
    final var revision = admin().ontologies().state(ontology.getId()).getWorkingRevision();
    final var asset = association(table, property);
    final var saved = put(admin(), concept, asset, 0L);
    assertEquals(1L, saved.getRevision());
    assertEquals(
        table.getFullyQualifiedName(),
        saved.getAssets().getFirst().getAsset().getFullyQualifiedName());
    final var column = saved.getAssets().getFirst().getColumns().getFirst();
    assertEquals(OntologyColumnBindingState.RESOLVED, column.getState());
    assertEquals("postal.code", column.getColumn().getName());
    assertEquals(property.getId(), column.getProperty().getId());
    assertEquals(saved, get(admin(), concept));
    assertEquals(1L, put(admin(), concept, asset, 0L).getRevision());
    assertEquals(revision, admin().ontologies().state(ontology.getId()).getWorkingRevision());
    assertEquals(before.getContentDigest(), capture(ontology).getContentDigest());
    assertTrue(admin().tables().get(table.getId().toString(), "tags").getTags().isEmpty());
    final var nativeConcept = admin().ontologyConcepts().get(concept.getId());
    assertFalse(JsonUtils.pojoToJson(nativeConcept).contains(table.getId().toString()));
    nativeConcept.setDescription("Unrelated definition edit");
    admin().ontologyConcepts().update(concept.getId(), nativeConcept);
    assertEquals(saved, get(admin(), concept));
    assertEquals(List.of(), remove(admin(), concept, asset, 1L).getAssets());
  }

  @Test
  void inheritedDataPropertyAndExactNestedPathAreValidated(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var child = declareClass(ontology, "Child", URI.create("urn:Child"));
    final var parent = declareClass(ontology, "Parent", URI.create("urn:Parent"));
    admin()
        .ontologyAxioms()
        .create(
            new CreateOntologyAxiom()
                .withName("inherits")
                .withDisplayName("Child inherits Parent")
                .withDescription("A named parent supplies the applicable DATA property domain.")
                .withOntology(ontology.getFullyQualifiedName())
                .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                .withSubjectIri(child.getIri())
                .withProvenance(RelationProvenance.MANUAL)
                .withExpressions(
                    List.of(
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.NAMED_CLASS)
                            .withClassIri(parent.getIri()))));
    final var table = table(ns);
    final var inherited = property(ontology, parent);
    final var asset = association(table, inherited);
    assertEquals(1L, put(admin(), child, asset, 0L).getRevision());
    asset.getColumns().getFirst().setColumnPath(List.of("address", "postal", "code"));
    assertStatus(400, () -> put(admin(), child, asset, 1L));
    final var other = createOntology(ns, "other");
    final var otherConcept = declareClass(other, "Child", child.getIri());
    final var foreign = property(other, otherConcept);
    assertStatus(400, () -> put(admin(), child, association(table, foreign), 1L));
    assertEquals(1L, get(admin(), child).getRevision());
  }

  @Test
  void hiddenTargetsAreNotReturnedOrOverwrittenByVisibleAssetUpdates(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var concept = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var hidden = association(table(ns), property(ontology, concept));
    final var topic = TopicTestFactory.createSimple(ns);
    final var visible =
        new OntologyAssetBinding()
            .withAssetType(OntologyBindingAssetType.TOPIC)
            .withAssetId(topic.getId());
    put(admin(), concept, hidden, 0L);
    try (var fixtures = new RdfAccessFixtures("bindings" + ns.shortPrefix())) {
      final var denied = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.TABLE);
      final var editor = fixtures.allowRole(MetadataOperation.EDIT_ALL, Entity.ONTOLOGY_CONCEPT);
      final var client =
          client(fixtures.userToken("editor", List.of(denied.getId(), editor.getId())));
      assertEquals(List.of(), get(client, concept).getAssets());
      assertStatus(403, () -> put(client, concept, hidden, 1L));
      assertStatus(403, () -> remove(client, concept, hidden, 1L));
      final var saved = put(client, concept, visible, 1L);
      assertEquals(
          List.of(topic.getId()),
          saved.getAssets().stream().map(value -> value.getAssetId()).toList());
      assertEquals(2, get(admin(), concept).getAssets().size());
      assertEquals(List.of(), remove(client, concept, visible, 2L).getAssets());
      assertEquals(hidden.getAssetId(), get(admin(), concept).getAssets().getFirst().getAssetId());
    }
  }

  @Test
  void successfulMutationsPruneDeletedTargetsWithoutRemovingHiddenLiveLinks(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var concept = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var hidden =
        new OntologyAssetBinding()
            .withAssetType(OntologyBindingAssetType.TABLE)
            .withAssetId(table(ns).getId());
    put(admin(), concept, hidden, 0L);
    final var service = MessagingServiceTestFactory.createKafka(ns);
    final var topics = new ArrayList<OntologyAssetBinding>();
    for (int index = 0; index < 99; index++) {
      final var asset = topicAsset(ns, service.getFullyQualifiedName());
      topics.add(asset);
      assertEquals(index + 2L, put(admin(), concept, asset, index + 1L).getRevision());
    }
    final var addition = topicAsset(ns, service.getFullyQualifiedName());
    final var deleted = topics.getFirst().getAssetId();
    admin().topics().delete(deleted);
    admin().topics().delete(topics.get(1).getAssetId().toString(), Map.of("hardDelete", "true"));
    assertEquals(100L, put(admin(), concept, topics.getLast(), 0L).getRevision());
    assertEquals(100L, remove(admin(), concept, addition, 0L).getRevision());
    admin().topics().restore(deleted);
    assertEquals(99, get(admin(), concept).getAssets().size());
    admin().topics().delete(deleted);
    assertStatus(409, () -> put(admin(), concept, addition, 99L));
    assertEquals(100L, get(admin(), concept).getRevision());
    admin().topics().restore(deleted);
    assertEquals(99, get(admin(), concept).getAssets().size());
    admin().topics().delete(deleted);
    try (var fixtures = new RdfAccessFixtures("capacity" + ns.shortPrefix())) {
      final var denied = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.TABLE);
      final var editor = fixtures.allowRole(MetadataOperation.EDIT_ALL, Entity.ONTOLOGY_CONCEPT);
      final var client =
          client(fixtures.userToken("editor", List.of(denied.getId(), editor.getId())));
      final var saved = put(client, concept, addition, 100L);
      assertEquals(101L, saved.getRevision());
      assertEquals(98, saved.getAssets().size());
      assertFalse(
          saved.getAssets().stream()
              .anyMatch(asset -> asset.getAssetId().equals(hidden.getAssetId())));
      admin().topics().restore(deleted);
      final var all = get(admin(), concept);
      assertEquals(99, all.getAssets().size());
      assertTrue(
          all.getAssets().stream()
              .anyMatch(asset -> asset.getAssetId().equals(hidden.getAssetId())));
      assertFalse(all.getAssets().stream().anyMatch(asset -> asset.getAssetId().equals(deleted)));
      admin().topics().delete(topics.get(2).getAssetId());
      assertEquals(102L, remove(client, concept, topics.get(3), 101L).getRevision());
      admin().topics().restore(topics.get(2).getAssetId());
      final var remaining = get(admin(), concept);
      assertEquals(97, remaining.getAssets().size());
      assertTrue(
          remaining.getAssets().stream()
              .anyMatch(asset -> asset.getAssetId().equals(hidden.getAssetId())));
      assertFalse(
          remaining.getAssets().stream()
              .anyMatch(asset -> asset.getAssetId().equals(topics.get(2).getAssetId())));
    }
  }

  @Test
  void oneHundredFiftyBoundAssetsPageWithoutGapsOrRepeats(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var concept = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var table = table(ns);
    final var tableAsset =
        new OntologyAssetBinding()
            .withAssetType(OntologyBindingAssetType.TABLE)
            .withAssetId(table.getId());
    assertEquals(1L, put(admin(), concept, tableAsset, 0L).getRevision());
    final var service = MessagingServiceTestFactory.createKafka(ns);
    final var bound = new HashSet<>(List.of(table.getId()));
    OntologyConceptBindingsResponse lastWrite = null;
    for (int index = 0; index < 150; index++) {
      final var asset = topicAsset(ns, service.getFullyQualifiedName());
      bound.add(asset.getAssetId());
      lastWrite = put(admin(), concept, asset, index + 1L);
      assertEquals(index + 2L, lastWrite.getRevision());
    }
    assertEquals(100, lastWrite.getAssets().size());
    final var firstPage = get(admin(), concept, "?limit=100");
    assertEquals(lastWrite, firstPage);
    final var secondPage = get(admin(), concept, "?limit=100&after=" + firstPage.getAfter());
    assertEquals(51, secondPage.getAssets().size());
    assertNull(secondPage.getAfter());
    final var seen = new ArrayList<UUID>();
    Stream.concat(firstPage.getAssets().stream(), secondPage.getAssets().stream())
        .forEach(asset -> seen.add(asset.getAssetId()));
    assertEquals(151, seen.size());
    assertEquals(bound, new HashSet<>(seen));
    assertEquals(List.of(), walk(concept, 40).stream().filter(id -> !bound.contains(id)).toList());
    assertEquals(151, new HashSet<>(walk(concept, 40)).size());
    assertEquals(151, walk(concept, 40).size());
    final var byAsset = new HashMap<UUID, String>();
    Stream.concat(firstPage.getAssets().stream(), secondPage.getAssets().stream())
        .forEach(asset -> byAsset.put(asset.getAssetId(), asset.getServiceType()));
    assertEquals(table.getServiceType().value(), byAsset.remove(table.getId()));
    assertEquals(Set.of("Kafka"), new HashSet<>(byAsset.values()));
    assertStatus(400, () -> get(admin(), concept, "?limit=0"));
    assertStatus(400, () -> get(admin(), concept, "?limit=101"));
    assertStatus(400, () -> get(admin(), concept, "?after=not-a-cursor"));
    final var late = topicAsset(ns, service.getFullyQualifiedName());
    assertStatus(409, () -> put(admin(), concept, late, 3L));
    assertEquals(151L, get(admin(), concept).getRevision());
  }

  @Test
  void aReaderHiddenFromMostAssetsPagesInBoundedScans(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var concept = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    for (int index = 0; index < 12; index++) {
      assertEquals(index + 1L, put(admin(), concept, tableAsset(ns, schema), index).getRevision());
    }
    final var topic =
        topicAsset(ns, MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName());
    assertEquals(13L, put(admin(), concept, topic, 12L).getRevision());
    try (var fixtures = new RdfAccessFixtures("scan" + ns.shortPrefix())) {
      final var denied = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.TABLE);
      final var reader = client(fixtures.userToken("reader", List.of(denied.getId())));
      final var pages = pages(reader, concept, 1);
      assertEquals(2, pages.size(), "13 rows examined 10 per request take two pages");
      assertEquals(
          List.of(topic.getAssetId()),
          pages.stream()
              .flatMap(page -> page.getAssets().stream())
              .map(asset -> asset.getAssetId())
              .toList());
      assertEquals(1, pages(admin(), concept, 100).size());
      assertEquals(13, walk(concept, 100).size());
    }
  }

  private static List<UUID> walk(OntologyConcept concept, int limit) {
    final var ids = new ArrayList<UUID>();
    pages(admin(), concept, limit)
        .forEach(page -> page.getAssets().forEach(asset -> ids.add(asset.getAssetId())));
    return ids;
  }

  /** Every page the cursor leads to, in order, each holding at most {@code limit} assets. */
  private static List<OntologyConceptBindingsResponse> pages(
      OpenMetadataClient client, OntologyConcept concept, int limit) {
    final var pages = new ArrayList<OntologyConceptBindingsResponse>();
    String after = null;
    do {
      final var page =
          get(client, concept, "?limit=" + limit + (after == null ? "" : "&after=" + after));
      assertTrue(page.getAssets().size() <= limit);
      pages.add(page);
      after = page.getAfter();
    } while (after != null);
    return pages;
  }

  @Test
  void successfulMutationsRecoverDeletedColumnCapacity(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var concept = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var property = property(ontology, concept);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final var assets = new ArrayList<OntologyAssetBinding>();
    for (int index = 0; index < 5; index++) {
      final var asset = wideTableAsset(ns, schema.getFullyQualifiedName(), property);
      assets.add(asset);
      assertEquals(index + 1L, put(admin(), concept, asset, index).getRevision());
    }
    final var addition = wideTableAsset(ns, schema.getFullyQualifiedName(), property);
    assertStatus(400, () -> put(admin(), concept, addition, 5L));
    admin().tables().delete(assets.getFirst().getAssetId());
    assertStatus(409, () -> put(admin(), concept, addition, 4L));
    final var saved = put(admin(), concept, addition, 5L);
    assertEquals(6L, saved.getRevision());
    assertEquals(
        500, saved.getAssets().stream().mapToInt(asset -> asset.getColumns().size()).sum());
    admin().tables().restore(assets.getFirst().getAssetId());
    assertEquals(saved, get(admin(), concept));
  }

  @Test
  void conceptEditPermissionIsRequiredEvenForIdempotentWrites(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var concept = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var asset = association(table(ns), property(ontology, concept));
    put(admin(), concept, asset, 0L);
    try (var fixtures = new RdfAccessFixtures("readonly" + ns.shortPrefix())) {
      final var role = fixtures.denyRole(MetadataOperation.EDIT_ALL, Entity.ONTOLOGY_CONCEPT);
      final var reader = client(fixtures.userToken("reader", List.of(role.getId())));
      assertEquals(1, get(reader, concept).getAssets().size());
      assertStatus(403, () -> put(reader, concept, asset, 1L));
      assertStatus(403, () -> remove(reader, concept, asset, 1L));
    }
  }

  @Test
  void renamedAndDeletedCatalogFieldsNeverUseStaleMetadata(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var concept = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var property = property(ontology, concept);
    final var table = table(ns);
    put(admin(), concept, association(table, property), 0L);
    final var renamed =
        admin()
            .tables()
            .patch(
                table.getId(),
                JsonUtils.readTree(
                    """
        [{"op":"add","path":"/displayName","value":"Renamed addresses"},
         {"op":"replace","path":"/columns","value":[{"name":"replacement","dataType":"STRING"}]}]
        """));
    assertEquals("Renamed addresses", renamed.getDisplayName());
    final var saved = get(admin(), concept).getAssets().getFirst();
    assertEquals(renamed.getName(), saved.getAsset().getName());
    assertEquals(renamed.getDisplayName(), saved.getAsset().getDisplayName());
    assertEquals(table.getId(), saved.getAssetId());
    assertEquals(OntologyColumnBindingState.UNRESOLVED, saved.getColumns().getFirst().getState());
    assertNull(saved.getColumns().getFirst().getColumn());
    assertEquals(1L, put(admin(), concept, association(table, property), 0L).getRevision());
    admin().ontologyProperties().delete(property.getId());
    assertNull(get(admin(), concept).getAssets().getFirst().getColumns().getFirst().getProperty());
    admin().tables().delete(table.getId());
    assertEquals(List.of(), get(admin(), concept).getAssets());
    admin().ontologyConcepts().delete(concept.getId());
    assertStatus(404, () -> get(admin(), concept));
  }

  @Test
  void staleConcurrentWritesCommitOneAssociationAndCanBeRetried(TestNamespace ns) throws Exception {
    final var ontology = createOntology(ns);
    final var concept = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var property = property(ontology, concept);
    final var first = association(table(ns), property);
    final var second = association(table(ns), property);
    final var ready = new CountDownLatch(2);
    try (var writers = Executors.newFixedThreadPool(2)) {
      final var left = writers.submit(() -> writeTogether(concept, first, ready));
      final var right = writers.submit(() -> writeTogether(concept, second, ready));
      assertEquals(1, left.get(30, TimeUnit.SECONDS) + right.get(30, TimeUnit.SECONDS));
    }
    final var saved = get(admin(), concept);
    assertEquals(1L, saved.getRevision());
    assertEquals(1, saved.getAssets().size());
    final var missing =
        saved.getAssets().getFirst().getAssetId().equals(first.getAssetId()) ? second : first;
    assertEquals(2, put(admin(), concept, missing, 1L).getAssets().size());
  }

  @Test
  void readsDoNotAcquireTheOntologyWriteLock(TestNamespace ns) throws Exception {
    assumeFalse(OssTestServer.isExternalMode(), "Requires the embedded server's retained DAO");
    final var ontology = createOntology(ns);
    final var concept = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var locked = new CountDownLatch(1);
    final var release = new CountDownLatch(1);
    try (var workers = Executors.newFixedThreadPool(2)) {
      final var holder =
          workers.submit(
              () ->
                  Entity.getCollectionDAO()
                      .inTransaction(
                          transaction -> {
                            transaction.ontologyStateDAO().lock(ontology.getId());
                            locked.countDown();
                            assertTrue(release.await(20, TimeUnit.SECONDS));
                            return null;
                          }));
      assertTrue(locked.await(10, TimeUnit.SECONDS));
      try {
        assertEquals(
            0L, workers.submit(() -> get(admin(), concept)).get(5, TimeUnit.SECONDS).getRevision());
      } finally {
        release.countDown();
      }
      holder.get(10, TimeUnit.SECONDS);
    }
  }

  private static int writeTogether(
      OntologyConcept concept, OntologyAssetBinding asset, CountDownLatch ready)
      throws InterruptedException {
    ready.countDown();
    assertTrue(ready.await(10, TimeUnit.SECONDS));
    try {
      put(admin(), concept, asset, 0L);
      return 1;
    } catch (OpenMetadataException conflict) {
      assertEquals(409, conflict.getStatusCode());
      return 0;
    }
  }

  private static OntologyProperty property(Ontology ontology, OntologyConcept domain) {
    return admin()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName("postalCode" + UUID.randomUUID())
                .withOntology(ontology.getFullyQualifiedName())
                .withKind(OntologyPropertyKind.DATA)
                .withDomain(List.of(domain.getIri()))
                .withRange(List.of(URI.create("http://www.w3.org/2001/XMLSchema#string"))));
  }

  private static OntologyAssetBinding topicAsset(TestNamespace ns, String service) {
    return new OntologyAssetBinding()
        .withAssetType(OntologyBindingAssetType.TOPIC)
        .withAssetId(TopicTestFactory.createSimple(ns, service).getId());
  }

  private static OntologyAssetBinding tableAsset(TestNamespace ns, String schema) {
    final var table =
        admin()
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("t" + UUID.randomUUID()))
                    .withDatabaseSchema(schema)
                    .withColumns(
                        List.of(
                            new Column().withName("value").withDataType(ColumnDataType.STRING))));
    return new OntologyAssetBinding()
        .withAssetType(OntologyBindingAssetType.TABLE)
        .withAssetId(table.getId());
  }

  private static OntologyAssetBinding wideTableAsset(
      TestNamespace ns, String schema, OntologyProperty property) {
    final var columns =
        IntStream.range(0, 100)
            .mapToObj(
                index -> new Column().withName("field" + index).withDataType(ColumnDataType.STRING))
            .toList();
    final var table =
        admin()
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("wide" + UUID.randomUUID()))
                    .withDatabaseSchema(schema)
                    .withColumns(columns));
    return new OntologyAssetBinding()
        .withAssetType(OntologyBindingAssetType.TABLE)
        .withAssetId(table.getId())
        .withColumns(
            columns.stream()
                .map(
                    column ->
                        new OntologyColumnBinding()
                            .withPropertyId(property.getId())
                            .withColumnPath(List.of(column.getName())))
                .toList());
  }

  private static Table table(TestNamespace ns) {
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    return admin()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix("addresses"))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(
                        new Column()
                            .withName("address")
                            .withDataType(ColumnDataType.STRUCT)
                            .withChildren(
                                List.of(
                                    new Column()
                                        .withName("postal.code")
                                        .withDataType(ColumnDataType.STRING))))));
  }

  private static OntologyAssetBinding association(Table table, OntologyProperty property) {
    return new OntologyAssetBinding()
        .withAssetId(table.getId())
        .withAssetType(OntologyBindingAssetType.TABLE)
        .withColumns(
            List.of(
                new OntologyColumnBinding()
                    .withPropertyId(property.getId())
                    .withColumnPath(List.of("address", "postal.code"))));
  }

  private static OpenMetadataClient admin() {
    return SdkClients.adminClient();
  }

  private static OpenMetadataClient client(String token) {
    return new OpenMetadataClient(
        OpenMetadataConfig.builder().serverUrl(SdkClients.baseUrl()).accessToken(token).build());
  }

  private static String path(OntologyConcept concept) {
    return "/v1/ontologyConcepts/" + concept.getId() + "/bindings";
  }

  private static OntologyConceptBindingsResponse get(
      OpenMetadataClient client, OntologyConcept concept) {
    return get(client, concept, "");
  }

  private static OntologyConceptBindingsResponse get(
      OpenMetadataClient client, OntologyConcept concept, String query) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET, path(concept) + query, null, OntologyConceptBindingsResponse.class);
  }

  private static OntologyConceptBindingsResponse put(
      OpenMetadataClient client,
      OntologyConcept concept,
      OntologyAssetBinding asset,
      long revision) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            path(concept),
            new UpdateOntologyConceptBinding().withExpectedRevision(revision).withAsset(asset),
            OntologyConceptBindingsResponse.class);
  }

  private static OntologyConceptBindingsResponse remove(
      OpenMetadataClient client,
      OntologyConcept concept,
      OntologyAssetBinding asset,
      long revision) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.DELETE,
            path(concept)
                + "/"
                + asset.getAssetType().value()
                + "/"
                + asset.getAssetId()
                + "?expectedRevision="
                + revision,
            null,
            OntologyConceptBindingsResponse.class);
  }

  private static void assertStatus(int status, Runnable request) {
    assertEquals(status, assertThrows(OpenMetadataException.class, request::run).getStatusCode());
  }
}
