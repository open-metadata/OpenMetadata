package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigInteger;
import java.net.URI;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.digest.DigestUtils;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.NativeOntologyAssetCluster;
import org.openmetadata.schema.api.data.NativeOntologyConceptEdge;
import org.openmetadata.schema.api.data.NativeOntologyDataGraph;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyHydratedAssetBinding;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TopicRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Isolated("Counts SQL statements while serving the native data graph over HTTP")
@ExtendWith(TestNamespaceExtension.class)
@Slf4j
class NativeOntologyDataGraphIT extends BaseOntologyApprovalIT {
  private static final URI CUSTOMER = URI.create("urn:Customer");
  private static final URI ORDER = URI.create("urn:Order");
  private static final URI INVOICE = URI.create("urn:Invoice");
  private static final URI RELATES_TO = URI.create("urn:relatesTo");

  @Test
  void clustersRankByBindingsAndPageIntoTheBindingsEndpoint(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    final var invoice = declareClass(ontology, "Invoice", INVOICE);
    declareClass(ontology, "Unbound", URI.create("urn:Unbound"));
    final var relatesTo = objectProperty(ontology, "Relates to");
    assertion(ontology, CUSTOMER, ORDER);
    restriction(ontology, INVOICE, CUSTOMER);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var customerTables = tables(ns, schema, 6);
    final var orderTables = tables(ns, schema, 2);
    final var postalCode = dataProperty(ontology, order);
    final var topic =
        TopicTestFactory.createSimple(
            ns, MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName());
    bindAll(customer, customerTables);
    bind(order, orderTables.getFirst(), List.of(column(postalCode)), 0L);
    bind(order, orderTables.getLast(), List.of(), 1L);
    bind(
        invoice,
        new OntologyAssetBinding()
            .withAssetType(OntologyBindingAssetType.TOPIC)
            .withAssetId(topic.getId()),
        0L);
    lineage(orderTables.getFirst(), orderTables.getLast());

    final var graph = graph(admin(), ontology, "");
    assertEquals(
        List.of(customer.getId(), order.getId(), invoice.getId()),
        graph.getClusters().stream().map(cluster -> cluster.getConcept().getId()).toList());
    assertEquals(
        List.of(6, 2, 1),
        graph.getClusters().stream().map(NativeOntologyAssetCluster::getAssetCount).toList());
    final var customerCluster = graph.getClusters().getFirst();
    assertEquals(4, customerCluster.getAssets().size());
    assertNotNull(customerCluster.getAfter());
    final var rest = bindings(customer, "?limit=100&after=" + customerCluster.getAfter());
    assertNull(rest.getAfter());
    final var seen = new HashSet<UUID>();
    customerCluster.getAssets().forEach(asset -> seen.add(asset.getAsset().getId()));
    rest.getAssets().forEach(asset -> seen.add(asset.getAssetId()));
    assertEquals(6, seen.size());
    assertEquals(ids(customerTables), seen);
    final var orderCluster = graph.getClusters().get(1);
    assertNull(orderCluster.getAfter());
    assertEquals(
        List.of(1, 0),
        orderCluster.getAssets().stream()
            .sorted((a, b) -> b.getColumnCount() - a.getColumnCount())
            .map(asset -> asset.getColumnCount())
            .toList());
    assertEquals(Set.of("Postgres"), serviceTypes(orderCluster));
    assertEquals(Set.of("Kafka"), serviceTypes(graph.getClusters().get(2)));
    assertEquals(
        orderTables.getFirst().getFullyQualifiedName(),
        orderCluster.getAssets().stream()
            .filter(asset -> asset.getColumnCount() == 1)
            .findFirst()
            .orElseThrow()
            .getAsset()
            .getFullyQualifiedName());

    assertEquals(2, graph.getEdges().size());
    assertEdge(graph, customer, order, relatesTo);
    assertEdge(graph, invoice, customer, relatesTo);
    assertEquals(
        List.of(
            new Edge()
                .withFromEntity(orderTables.getFirst().getId())
                .withToEntity(orderTables.getLast().getId())),
        graph.getLineageEdges());
    assertEquals(0, graph.getPaging().getOffset());
    assertEquals(12, graph.getPaging().getLimit());
    assertEquals(3, graph.getPaging().getTotal());

    final var lastPage = graph(admin(), ontology, "?limit=2&offset=2");
    assertEquals(
        List.of(invoice.getId()),
        lastPage.getClusters().stream().map(cluster -> cluster.getConcept().getId()).toList());
    assertEquals(List.of(), lastPage.getEdges());
    assertEquals(List.of(), lastPage.getLineageEdges());
    assertEquals(3, lastPage.getPaging().getTotal());
    assertEquals(2, lastPage.getPaging().getOffset());
    assertStatus(400, () -> graph(admin(), ontology, "?limit=13"));
    assertStatus(400, () -> graph(admin(), ontology, "?assetsPerConcept=5"));
    assertStatus(400, () -> graph(admin(), ontology, "?offset=-1"));
  }

  @Test
  void aBoundConceptBeyondTheOldOffsetCeilingIsReachable(TestNamespace ns) {
    final var ontology = createOntology(ns, "deepGraphPage");
    final var service = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
    final var topic = TopicTestFactory.createSimple(ns, service);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var hidden = tables(ns, schema, 1).getFirst();
    final var concepts = new ArrayList<OntologyConcept>();
    for (int index = 0; index < 61; index++) {
      final var concept =
          declareClass(
              ontology,
              "DeepConcept%02d".formatted(index),
              URI.create(ontology.getNamespace() + "DeepConcept" + index));
      concepts.add(concept);
      bind(
          concept,
          index == 5
              ? new OntologyAssetBinding()
                  .withAssetType(OntologyBindingAssetType.TABLE)
                  .withAssetId(hidden.getId())
              : new OntologyAssetBinding()
                  .withAssetType(OntologyBindingAssetType.TOPIC)
                  .withAssetId(topic.getId()),
          0L);
    }

    final var last = graph(admin(), ontology, "?limit=1&offset=60");
    assertEquals(61, last.getPaging().getTotal());
    assertEquals(60, last.getPaging().getOffset());
    assertEquals(
        List.of(concepts.get(60).getId()),
        last.getClusters().stream().map(cluster -> cluster.getConcept().getId()).toList());
    assertStatus(400, () -> graph(admin(), ontology, "?offset=-1"));
    assertStatus(404, () -> graph(admin(), ontology, "?offset=2147483648"));
    try (var fixtures = new RdfAccessFixtures("storedRank" + ns.shortPrefix())) {
      final var noTables = fixtures.denyRole(MetadataOperation.VIEW_BASIC, Entity.TABLE);
      final var reader = client(fixtures.userToken("reader", List.of(noTables.getId())));
      final var seen = new ArrayList<UUID>();
      for (int offset = 0; offset < 61; offset += 12) {
        final var page = graph(reader, ontology, "?limit=12&offset=" + offset);
        assertEquals(61, page.getPaging().getTotal());
        assertEquals(offset, page.getPaging().getOffset());
        assertEquals(12, page.getPaging().getLimit());
        final var expected =
            concepts.subList(offset, Math.min(offset + 12, 61)).stream()
                .filter(concept -> !concept.getId().equals(concepts.get(5).getId()))
                .map(OntologyConcept::getId)
                .toList();
        final var actual =
            page.getClusters().stream().map(cluster -> cluster.getConcept().getId()).toList();
        assertEquals(expected, actual);
        seen.addAll(actual);
      }
      assertEquals(60, new HashSet<>(seen).size());
      assertEquals(concepts.get(60).getId(), seen.getLast());
      assertEquals(List.of(), graph(reader, ontology, "?limit=12&offset=72").getClusters());
    }
  }

  @Test
  void anAxiomDeniedByBasicViewCannotRevealAnEdge(TestNamespace ns) {
    final var ontology = createOntology(ns, "deniedGraphAxiom");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    final var property = objectProperty(ontology, "Relates to");
    final var axiom = assertion(ontology, CUSTOMER, ORDER);
    final var service = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
    final var topic = TopicTestFactory.createSimple(ns, service);
    for (final var concept : List.of(customer, order)) {
      bind(
          concept,
          new OntologyAssetBinding()
              .withAssetType(OntologyBindingAssetType.TOPIC)
              .withAssetId(topic.getId()),
          0L);
    }
    assertEdge(graph(admin(), ontology, ""), customer, order, property);

    try (var fixtures = new RdfAccessFixtures("graphAxiom" + ns.shortPrefix())) {
      final var noAxioms = fixtures.denyRole(MetadataOperation.VIEW_BASIC, Entity.ONTOLOGY_AXIOM);
      final var reader = client(fixtures.userToken("noAxioms", List.of(noAxioms.getId())));
      assertStatus(
          403,
          () ->
              reader
                  .getHttpClient()
                  .execute(
                      HttpMethod.GET,
                      "/v1/ontologyAxioms/" + axiom.getId(),
                      null,
                      OntologyAxiom.class));
      final var partial = graph(reader, ontology, "");
      assertEquals(2, partial.getClusters().size());
      assertEquals(List.of(), partial.getEdges());
    }
  }

  @Test
  void aVisibleEdgeAfterAnAxiomCandidatePageIsStillReturned(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Seeds a real embedded database candidate page");
    final var ontology = createOntology(ns, "deepGraphEdges");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    declareClass(ontology, "Unbound", URI.create("urn:Unbound"));
    final var property = objectProperty(ontology, "Relates to");
    final var irrelevant = assertion(ontology, CUSTOMER, URI.create("urn:Unbound"), "aaaTemplate");
    assertion(ontology, CUSTOMER, ORDER, "zzzVisible");
    final var service = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
    final var topic = TopicTestFactory.createSimple(ns, service);
    for (final var concept : List.of(customer, order)) {
      bind(
          concept,
          new OntologyAssetBinding()
              .withAssetType(OntologyBindingAssetType.TOPIC)
              .withAssetId(topic.getId()),
          0L);
    }

    final var cloneIds = insertIrrelevantAxioms(ontology, irrelevant, 501);
    try {
      final var observed = new ScanObservation();
      try (var queries =
          SqlQueryCounter.forRequests(Entity.getJdbi(), "select", observed::record)) {
        assertEdge(graph(admin(), ontology, "?edgeLimit=1"), customer, order, property);
      }
      assertEquals(List.of(500L, 3L), observed.axiomRows);
      observed.assertBounded();
    } finally {
      deleteAxiomClones(cloneIds);
    }
  }

  @Test
  void aFullDeniedAxiomBatchDoesNotConsumeTheVisibleEdgeLimit(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Seeds a real embedded database candidate page");
    final var ontology = createOntology(ns, "deniedGraphBatch");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    final var property = objectProperty(ontology, "Relates to");
    bindSharedTopic(ns, List.of(customer, order));
    final var denied = assertion(ontology, CUSTOMER, ORDER, "aaaDenied");
    final var cloneIds = insertIrrelevantAxioms(ontology, denied, 501);
    try (var fixtures = new RdfAccessFixtures("deniedBatch" + ns.shortPrefix())) {
      final var reader = ownerReader(fixtures, Entity.ONTOLOGY_AXIOM);
      final var allowed =
          admin()
              .ontologyAxioms()
              .create(
                  assertionRequest(ontology, ORDER, CUSTOMER, "zzzAllowed")
                      .withOwners(List.of(readerReference(reader))));
      assertStatus(
          403,
          () ->
              reader
                  .getHttpClient()
                  .execute(
                      HttpMethod.GET,
                      "/v1/ontologyAxioms/" + denied.getId(),
                      null,
                      OntologyAxiom.class));
      assertEquals(
          allowed.getId(),
          reader
              .getHttpClient()
              .execute(
                  HttpMethod.GET,
                  "/v1/ontologyAxioms/" + allowed.getId(),
                  null,
                  OntologyAxiom.class)
              .getId());
      final var observed = new ScanObservation();
      try (var queries =
          SqlQueryCounter.forRequests(Entity.getJdbi(), "select", observed::record)) {
        final var graph = graph(reader, ontology, "?edgeLimit=1");
        assertEquals(1, graph.getEdges().size());
        assertEdge(graph, order, customer, property);
      }
      assertEquals(List.of(500L, 3L), observed.axiomRows);
      observed.assertBounded();
    } finally {
      deleteAxiomClones(cloneIds);
    }
  }

  @Test
  void axiomNameKeysetsKeepDistinctLinksAcrossCollationTiesAndDuplicates(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Checks the real candidate ordering and collation");
    final var ontology = createOntology(ns, "duplicateGraphEdges");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    final var invoice = declareClass(ontology, "Invoice", INVOICE);
    declareClass(ontology, "Unbound", URI.create("urn:Unbound"));
    final var property = objectProperty(ontology, "Relates to");
    bindSharedTopic(ns, List.of(customer, order, invoice));
    final var irrelevant = assertion(ontology, CUSTOMER, URI.create("urn:Unbound"), "aaaTemplate");
    final var cloneIds = insertIrrelevantAxioms(ontology, irrelevant, 498);
    try {
      final var names =
          TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL
              ? List.of("bbbLink", "BBBLINK", "BBBLink")
              : List.of("bbbLink0", "bbbLink1", "bbbLink2");
      final var ids =
          IntStream.range(0, 3)
              .mapToObj(ignored -> UUID.randomUUID())
              .sorted(Comparator.comparing(UUID::toString))
              .toList();
      cloneIds.addAll(
          insertAxiomClones(
              ontology,
              irrelevant,
              List.of(
                  new AxiomClone(ids.get(0), names.get(0), ORDER),
                  new AxiomClone(ids.get(1), names.get(1), ORDER),
                  new AxiomClone(ids.get(2), names.get(2), INVOICE))));
      assertAxiomNameOrdering(ontology, names, ids);
      assertStatus(409, () -> assertion(ontology, CUSTOMER, ORDER, names.getFirst()));
      final var observed = new ScanObservation();
      try (var queries =
          SqlQueryCounter.forRequests(Entity.getJdbi(), "select", observed::record)) {
        final var graph = graph(admin(), ontology, "?edgeLimit=2");
        assertEquals(2, graph.getEdges().size());
        assertEdge(graph, customer, order, property);
        assertEdge(graph, customer, invoice, property);
      }
      assertEquals(List.of(500L, 2L), observed.axiomRows);
      observed.assertBounded();
    } finally {
      deleteAxiomClones(cloneIds);
    }
  }

  @Test
  void exactVisibleCountAndPreviewCursorSurviveMoreThanOneBindingPage(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's binding page reads");
    final var ontology = createOntology(ns, "deepGraphBindings");
    final var concept = declareClass(ontology, "DeepCustomer", CUSTOMER);
    final var service = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
    final var topics =
        IntStream.range(0, 12)
            .mapToObj(ignored -> TopicTestFactory.createSimple(ns, service))
            .sorted(Comparator.comparing(topic -> topic.getId().toString()))
            .toList();
    try (var fixtures = new RdfAccessFixtures("deepBindings" + ns.shortPrefix())) {
      final var reader = ownerReader(fixtures, Entity.TOPIC);
      final var owner = readerReference(reader);
      final var visibleIndexes = Set.of(2, 4, 6, 8, 10);
      final var deletedIndexes = Set.of(1, 5, 9);
      for (int index = 0; index < topics.size(); index++) {
        final var topic = topics.get(index);
        if (visibleIndexes.contains(index) || deletedIndexes.contains(index)) {
          final var current = admin().topics().get(topic.getId().toString(), "owners");
          admin().topics().update(topic.getId().toString(), current.withOwners(List.of(owner)));
        }
        bind(
            concept,
            new OntologyAssetBinding()
                .withAssetType(OntologyBindingAssetType.TOPIC)
                .withAssetId(topic.getId()),
            index);
      }
      for (final int index : deletedIndexes) {
        admin().topics().delete(topics.get(index).getId());
      }
      insertMissingBindings(concept, new UUID(0, 0), 501);
      for (final int index : visibleIndexes) {
        assertTrue(
            shift(topics.get(index).getId(), 501)
                    .toString()
                    .compareTo(topics.get(index + 1).getId().toString())
                < 0);
        insertMissingBindings(concept, topics.get(index).getId(), 501);
      }
      assertStatus(403, () -> reader.topics().get(topics.getFirst().getId()));
      final var observed = new ScanObservation();
      final NativeOntologyDataGraph graph;
      try (var queries =
          SqlQueryCounter.forRequests(Entity.getJdbi(), "select", observed::record)) {
        graph = graph(reader, ontology, "?assetsPerConcept=4");
      }
      final var visible =
          IntStream.range(0, topics.size())
              .filter(visibleIndexes::contains)
              .mapToObj(index -> topics.get(index).getId())
              .toList();
      final var cluster = graph.getClusters().getFirst();
      assertEquals(1, graph.getClusters().size());
      assertEquals(5, cluster.getAssetCount());
      assertEquals(
          visible.subList(0, 4),
          cluster.getAssets().stream().map(asset -> asset.getAsset().getId()).toList());
      assertEquals(RestUtil.encodeCursor(visible.get(3).toString()), cluster.getAfter());
      final var remaining = new ArrayList<UUID>();
      String after = cluster.getAfter();
      int emptyPages = 0;
      int pages = 0;
      do {
        assertTrue(++pages <= 11, "The remaining 1005 stored rows must be exhausted");
        final var continuation = bindings(reader, concept, "?limit=10&after=" + after);
        remaining.addAll(
            continuation.getAssets().stream()
                .map(OntologyHydratedAssetBinding::getAssetId)
                .toList());
        if (continuation.getAssets().isEmpty()) {
          emptyPages++;
        }
        assertTrue(continuation.getAfter() == null || !continuation.getAfter().equals(after));
        after = continuation.getAfter();
      } while (after != null);
      assertEquals(List.of(visible.getLast()), remaining);
      assertEquals(10, emptyPages, "The binding endpoint must traverse both invisible stretches");
      assertEquals(List.of(500L, 500L, 500L, 500L, 500L, 500L, 18L), observed.bindingRows);
      assertEquals(500, observed.largestInList.get());
      observed.assertBounded();
    } finally {
      Entity.getCollectionDAO().ontologyConceptBindingDAO().deleteConcept(concept.getId());
    }
  }

  @Test
  void emptyAndFullBindingPagesKeepExactCountsWithoutVisibleClusters(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts exact embedded binding page boundaries");
    final var ontology = createOntology(ns, "bindingBoundaries");
    final var concept = declareClass(ontology, "Customer", CUSTOMER);
    final var empty = new ScanObservation();
    try (var queries = SqlQueryCounter.forRequests(Entity.getJdbi(), "select", empty::record)) {
      assertEquals(List.of(), graph(admin(), ontology, "").getClusters());
    }
    assertEquals(List.of(), empty.bindingRows);
    try {
      insertMissingBindings(concept, new UUID(0, 0), 500);
      assertInvisibleBindingRows(ontology, List.of(500L, 0L));
      insertMissingBindings(concept, new UUID(0, 500), 1);
      assertInvisibleBindingRows(ontology, List.of(500L, 1L));
    } finally {
      Entity.getCollectionDAO().ontologyConceptBindingDAO().deleteConcept(concept.getId());
    }
  }

  @Test
  void bindingKeysetsAdvanceAcrossConceptsSharingTheSameAsset(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Checks the embedded composite binding keyset");
    final var ontology = createOntology(ns, "bindingTuple");
    final var concepts =
        List.of(
                declareClass(ontology, "Customer", CUSTOMER),
                declareClass(ontology, "Order", ORDER))
            .stream()
            .sorted(Comparator.comparing(concept -> concept.getId().toString()))
            .toList();
    final var topic = TopicTestFactory.createSimple(ns);
    try {
      insertMissingBindings(concepts.getFirst(), new UUID(0, 0), 499);
      for (final var concept : concepts) {
        Entity.getCollectionDAO()
            .ontologyConceptBindingDAO()
            .upsert(
                concept.getId(),
                topic.getId(),
                OntologyBindingAssetType.TOPIC.value(),
                FullyQualifiedName.buildHash(topic.getFullyQualifiedName()),
                "[]");
      }
      final var observed = new ScanObservation();
      try (var queries =
          SqlQueryCounter.forRequests(Entity.getJdbi(), "select", observed::record)) {
        final var graph = graph(admin(), ontology, "");
        assertEquals(
            concepts.stream().map(OntologyConcept::getId).toList(),
            graph.getClusters().stream().map(cluster -> cluster.getConcept().getId()).toList());
        for (final var cluster : graph.getClusters()) {
          assertEquals(1, cluster.getAssetCount());
          assertEquals(topic.getId(), cluster.getAssets().getFirst().getAsset().getId());
          assertNull(cluster.getAfter());
        }
      }
      assertEquals(List.of(500L, 1L), observed.bindingRows);
      observed.assertBounded();
    } finally {
      concepts.forEach(
          concept ->
              Entity.getCollectionDAO().ontologyConceptBindingDAO().deleteConcept(concept.getId()));
    }
  }

  @Test
  void hiddenAssetsAndConceptsLeaveNoTraceForAPartialReader(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    objectProperty(ontology, "Relates to");
    assertion(ontology, CUSTOMER, ORDER);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var customerTables = tables(ns, schema, 2);
    final var topic =
        TopicTestFactory.createSimple(
            ns, MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName());
    bindAll(customer, customerTables);
    bind(
        customer,
        new OntologyAssetBinding()
            .withAssetType(OntologyBindingAssetType.TOPIC)
            .withAssetId(topic.getId()),
        2L);
    bindAll(order, tables(ns, schema, 1));
    lineage(customerTables.getFirst(), customerTables.getLast());

    final var full = graph(admin(), ontology, "");
    assertEquals(
        List.of(3, 1),
        full.getClusters().stream().map(NativeOntologyAssetCluster::getAssetCount).toList());
    assertEquals(1, full.getEdges().size());
    assertEquals(1, full.getLineageEdges().size());
    admin().tables().delete(customerTables.getLast().getId());
    final var afterDeletion = graph(admin(), ontology, "");
    assertEquals(2, afterDeletion.getClusters().getFirst().getAssetCount());
    assertEquals(List.of(), afterDeletion.getLineageEdges());
    admin().tables().restore(customerTables.getLast().getId());
    try (var fixtures = new RdfAccessFixtures("graph" + ns.shortPrefix());
        var propertyFixtures = new RdfAccessFixtures("property" + ns.shortPrefix());
        var conceptFixtures = new RdfAccessFixtures("concept" + ns.shortPrefix());
        var ontologyFixtures = new RdfAccessFixtures("ontology" + ns.shortPrefix())) {
      final var noProperties =
          propertyFixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_PROPERTY);
      final var propertyReader =
          client(propertyFixtures.userToken("noProperties", List.of(noProperties.getId())));
      final var hiddenPropertyGraph = graph(propertyReader, ontology, "");
      assertEquals(2, hiddenPropertyGraph.getClusters().size());
      assertEquals(1, hiddenPropertyGraph.getEdges().size());
      assertNull(hiddenPropertyGraph.getEdges().getFirst().getProperty());
      assertEquals("relatesTo", hiddenPropertyGraph.getEdges().getFirst().getLabel());

      final var noTables = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.TABLE);
      final var reader = client(fixtures.userToken("reader", List.of(noTables.getId())));
      final var partial = graph(reader, ontology, "");
      assertEquals(
          List.of(customer.getId()),
          partial.getClusters().stream().map(cluster -> cluster.getConcept().getId()).toList());
      final var cluster = partial.getClusters().getFirst();
      assertEquals(1, cluster.getAssetCount());
      assertEquals(
          List.of(topic.getId()),
          cluster.getAssets().stream().map(asset -> asset.getAsset().getId()).toList());
      assertNull(cluster.getAfter());
      assertEquals(List.of(), partial.getEdges());
      assertEquals(List.of(), partial.getLineageEdges());
      assertEquals(2, partial.getPaging().getTotal());

      final var noConcepts =
          conceptFixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_CONCEPT);
      final var blind = client(conceptFixtures.userToken("blind", List.of(noConcepts.getId())));
      final var empty = graph(blind, ontology, "");
      assertEquals(List.of(), empty.getClusters());
      assertEquals(List.of(), empty.getEdges());
      assertEquals(List.of(), empty.getLineageEdges());
      assertEquals(2, empty.getPaging().getTotal());
      final var noOntology = ontologyFixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY);
      final var denied = client(ontologyFixtures.userToken("denied", List.of(noOntology.getId())));
      assertStatus(403, () -> graph(denied, ontology, ""));
    }
  }

  @Test
  void statementCountDoesNotGrowWithConceptsOrAssets(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final var service = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
    final var narrow = boundOntology(ns, "narrow", 4, 1, service);
    final var wide = boundOntology(ns, "wide", 40, 2, service);
    try (var fixtures = new RdfAccessFixtures("budget" + ns.shortPrefix())) {
      final var noTables = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.TABLE);
      final var reader = client(fixtures.userToken("reader", List.of(noTables.getId())));
      for (final var client : List.of(admin(), reader)) {
        assertEquals(4, graph(client, narrow, "").getClusters().size());
        assertEquals(12, graph(client, wide, "").getClusters().size());
        final int narrowReads = reads(client, narrow);
        final int wideReads = reads(client, wide);
        log.info("Native data graph SQL reads: narrow={}, wide={}", narrowReads, wideReads);
        assertTrue(narrowReads > 0, "The SQL counter must observe the graph request");
        assertTrue(
            wideReads <= narrowReads,
            "A page of 12 of 40 concepts with 2 assets each ran "
                + wideReads
                + " reads; 4 concepts with 1 asset ran "
                + narrowReads);
      }
    }
  }

  @Test
  void topicServiceHydrationReadsStayConstantWithoutCaches(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final var service = MessagingServiceTestFactory.createKafka(ns);
    final var repository = (TopicRepository) Entity.getEntityRepository(Entity.TOPIC);
    final List<Topic> topics =
        IntStream.range(0, 24)
            .mapToObj(
                ignored ->
                    repository
                        .getDao()
                        .findEntityById(
                            TopicTestFactory.createSimple(ns, service.getFullyQualifiedName())
                                .getId()))
            .toList();
    final var reads = new ArrayList<Integer>();
    for (final int width : List.of(4, 24)) {
      final var batch = topics.subList(0, width);
      try (var fresh = FreshReadScope.enter();
          var bypass = EntityCacheBypass.skip();
          var queries = new SqlQueryCounter(Entity.getJdbi(), "select")) {
        repository.setFieldsInBulk(Fields.EMPTY_FIELDS, batch);
        reads.add(queries.count());
      }
      batch.forEach(topic -> assertEquals(service.getId(), topic.getService().getId()));
    }
    assertTrue(reads.getFirst() > 0, "The SQL counter must observe topic hydration");
    assertEquals(
        reads.getFirst(), reads.getLast(), "Topic service reads must not grow with topics");
  }

  @Test
  void topicServiceHydrationMapsDistinctParentsInOneBatch(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final var services =
        IntStream.range(0, 3)
            .mapToObj(ignored -> MessagingServiceTestFactory.createKafka(ns))
            .toList();
    final var repository = (TopicRepository) Entity.getEntityRepository(Entity.TOPIC);
    final List<Topic> topics =
        IntStream.range(0, 24)
            .mapToObj(
                index ->
                    repository
                        .getDao()
                        .findEntityById(
                            TopicTestFactory.createSimple(
                                    ns,
                                    services.get(index % services.size()).getFullyQualifiedName())
                                .getId()))
            .toList();
    final var reads = new ArrayList<Integer>();
    for (final int width : List.of(6, 24)) {
      final var batch = topics.subList(0, width);
      try (var fresh = FreshReadScope.enter();
          var bypass = EntityCacheBypass.skip();
          var queries = new SqlQueryCounter(Entity.getJdbi(), "select")) {
        repository.setFieldsInBulk(Fields.EMPTY_FIELDS, batch);
        reads.add(queries.count());
      }
      for (int index = 0; index < width; index++) {
        assertEquals(
            services.get(index % services.size()).getId(), batch.get(index).getService().getId());
      }
    }
    assertTrue(reads.getFirst() > 0, "The SQL counter must observe topic hydration");
    assertEquals(
        reads.getFirst(), reads.getLast(), "Distinct service reads must not grow with topics");
  }

  @Test
  void topicServiceHydrationRejectsMissingParent(TestNamespace ns) {
    final var service = MessagingServiceTestFactory.createKafka(ns);
    final var topic = TopicTestFactory.createSimple(ns, service.getFullyQualifiedName());
    final var repository = (TopicRepository) Entity.getEntityRepository(Entity.TOPIC);
    final var row = repository.getDao().findEntityById(topic.getId());
    final var relationships = Entity.getCollectionDAO().relationshipDAO();
    final var missingId = UUID.randomUUID();
    try (var fresh = FreshReadScope.enter();
        var bypass = EntityCacheBypass.skip()) {
      relationships.deleteTo(
          topic.getId(), Entity.TOPIC, Relationship.CONTAINS.ordinal(), Entity.MESSAGING_SERVICE);
      relationships.insert(
          missingId,
          topic.getId(),
          Entity.MESSAGING_SERVICE,
          Entity.TOPIC,
          Relationship.CONTAINS.ordinal());
      final var error =
          assertThrows(
              EntityNotFoundException.class,
              () -> repository.setFieldsInBulk(Fields.EMPTY_FIELDS, List.of(row)));
      assertEquals(
          CatalogExceptionMessage.entityNotFound(Entity.MESSAGING_SERVICE, missingId),
          error.getMessage());
    } finally {
      relationships.deleteTo(
          topic.getId(), Entity.TOPIC, Relationship.CONTAINS.ordinal(), Entity.MESSAGING_SERVICE);
      relationships.insert(
          service.getId(),
          topic.getId(),
          Entity.MESSAGING_SERVICE,
          Entity.TOPIC,
          Relationship.CONTAINS.ordinal());
    }
  }

  @Test
  void topicServiceHydrationRejectsSoftDeletedParent(TestNamespace ns) {
    final var service = MessagingServiceTestFactory.createKafka(ns);
    final var topic = TopicTestFactory.createSimple(ns, service.getFullyQualifiedName());
    final var repository = (TopicRepository) Entity.getEntityRepository(Entity.TOPIC);
    final var row = repository.getDao().findEntityById(topic.getId());
    final var services = Entity.getCollectionDAO().messagingServiceDAO();
    try (var fresh = FreshReadScope.enter();
        var bypass = EntityCacheBypass.skip()) {
      services.update(service.withDeleted(true));
      final var error =
          assertThrows(
              EntityNotFoundException.class,
              () -> repository.setFieldsInBulk(Fields.EMPTY_FIELDS, List.of(row)));
      assertEquals(
          CatalogExceptionMessage.entityNotFound(Entity.MESSAGING_SERVICE, service.getId()),
          error.getMessage());
    } finally {
      services.update(service.withDeleted(false));
    }
  }

  private static int reads(OpenMetadataClient client, Ontology ontology) {
    final var sequence = new AtomicInteger();
    try (var queries =
        SqlQueryCounter.forRequests(
            Entity.getJdbi(),
            "select",
            statement -> {
              final var sql = statement.getRenderedSql();
              if (sql.toLowerCase(Locale.ROOT).contains("select")) {
                final var request = RequestLatencyContext.getContext();
                log.info(
                    "Graph budget SQL ontology={} sequence={} request={} method={} path={} thread={} sql={}",
                    ontology.getId(),
                    sequence.incrementAndGet(),
                    System.identityHashCode(request),
                    request.getMethod(),
                    request.getUriPath(),
                    Thread.currentThread().getName(),
                    sql);
              }
              return true;
            })) {
      final var graph = graph(client, ontology, "");
      assertEquals(Math.min(12, graph.getPaging().getTotal()), graph.getClusters().size());
      return queries.count();
    }
  }

  private static Ontology boundOntology(
      TestNamespace ns, String name, int concepts, int assetsPerConcept, String service) {
    final var ontology = createOntology(ns, name);
    IntStream.range(0, concepts)
        .forEach(
            index -> {
              final var concept =
                  declareClass(
                      ontology,
                      "Concept" + index,
                      URI.create(ontology.getNamespace() + "Concept" + index));
              for (int asset = 0; asset < assetsPerConcept; asset++) {
                bind(
                    concept,
                    new OntologyAssetBinding()
                        .withAssetType(OntologyBindingAssetType.TOPIC)
                        .withAssetId(TopicTestFactory.createSimple(ns, service).getId()),
                    asset);
              }
            });
    return ontology;
  }

  private static void assertEdge(
      NativeOntologyDataGraph graph,
      OntologyConcept from,
      OntologyConcept to,
      OntologyProperty property) {
    final NativeOntologyConceptEdge edge =
        graph.getEdges().stream()
            .filter(
                candidate ->
                    candidate.getFromConceptId().equals(from.getId())
                        && candidate.getToConceptId().equals(to.getId()))
            .findFirst()
            .orElseThrow();
    assertEquals(RELATES_TO, edge.getPropertyIri());
    assertEquals("Relates to", edge.getLabel());
    assertEquals(property.getId(), edge.getProperty().getId());
  }

  private static Set<String> serviceTypes(NativeOntologyAssetCluster cluster) {
    final var types = new HashSet<String>();
    cluster.getAssets().forEach(asset -> types.add(asset.getServiceType()));
    return types;
  }

  private static Set<UUID> ids(List<Table> tables) {
    final var ids = new HashSet<UUID>();
    tables.forEach(table -> ids.add(table.getId()));
    return ids;
  }

  private static OntologyProperty objectProperty(Ontology ontology, String displayName) {
    return admin()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName("relatesTo")
                .withDisplayName(displayName)
                .withOntology(ontology.getFullyQualifiedName())
                .withKind(OntologyPropertyKind.OBJECT)
                .withIri(RELATES_TO));
  }

  private static OntologyProperty dataProperty(Ontology ontology, OntologyConcept domain) {
    return admin()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName("postalCode")
                .withOntology(ontology.getFullyQualifiedName())
                .withKind(OntologyPropertyKind.DATA)
                .withDomain(List.of(domain.getIri()))
                .withRange(List.of(URI.create("http://www.w3.org/2001/XMLSchema#string"))));
  }

  private static OntologyAxiom assertion(Ontology ontology, URI subject, URI target) {
    return assertion(ontology, subject, target, "relates" + subject.getSchemeSpecificPart());
  }

  private static OntologyAxiom assertion(Ontology ontology, URI subject, URI target, String name) {
    return admin().ontologyAxioms().create(assertionRequest(ontology, subject, target, name));
  }

  private static CreateOntologyAxiom assertionRequest(
      Ontology ontology, URI subject, URI target, String name) {
    return new CreateOntologyAxiom()
        .withName(name)
        .withDisplayName("Related concepts")
        .withDescription("An object property assertion between bound concepts")
        .withOntology(ontology.getFullyQualifiedName())
        .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
        .withSubjectIri(subject)
        .withPropertyIri(RELATES_TO)
        .withTargetIri(target)
        .withExpressions(List.of())
        .withProvenance(RelationProvenance.MANUAL);
  }

  private static List<UUID> insertIrrelevantAxioms(
      Ontology ontology, OntologyAxiom template, int count) {
    return insertAxiomClones(
        ontology,
        template,
        IntStream.range(0, count)
            .mapToObj(
                index ->
                    new AxiomClone(
                        UUID.randomUUID(),
                        "aaaCandidate%04d".formatted(index),
                        template.getTargetIri()))
            .toList());
  }

  private record AxiomClone(UUID id, String name, URI target) {}

  private static List<UUID> insertAxiomClones(
      Ontology ontology, OntologyAxiom template, List<AxiomClone> clones) {
    final var jsonCast =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.POSTGRES
            ? "CAST(:json AS JSONB)"
            : ":json";
    Entity.getJdbi()
        .useTransaction(
            handle -> {
              final var axioms =
                  handle.prepareBatch(
                      "INSERT INTO ontology_axiom_entity (fqnHash, json) VALUES (:hash, "
                          + jsonCast
                          + ")");
              final var references =
                  handle.prepareBatch(
                      "INSERT INTO ontology_reference "
                          + "(ontologyId, sourceType, sourceId, role, iri, iriHash) "
                          + "VALUES (:ontologyId, 'ontologyAxiom', :sourceId, "
                          + "'AXIOM_SUBJECT', :iri, :iriHash)");
              for (final var clone : clones) {
                final var fqn =
                    FullyQualifiedName.add(ontology.getFullyQualifiedName(), clone.name());
                final var document = (ObjectNode) JsonUtils.valueToTree(template);
                document.put("id", clone.id().toString());
                document.put("name", clone.name());
                document.put("fullyQualifiedName", fqn);
                document.put("targetIri", clone.target().toString());
                axioms
                    .bind("hash", FullyQualifiedName.buildHash(fqn))
                    .bind("json", document.toString())
                    .add();
                references
                    .bind("ontologyId", ontology.getId().toString())
                    .bind("sourceId", clone.id().toString())
                    .bind("iri", template.getSubjectIri().toString())
                    .bind("iriHash", DigestUtils.sha256Hex(template.getSubjectIri().toString()))
                    .add();
              }
              axioms.execute();
              references.execute();
            });
    return new ArrayList<>(clones.stream().map(AxiomClone::id).toList());
  }

  private static void deleteAxiomClones(List<UUID> ids) {
    Entity.getJdbi()
        .useHandle(
            handle -> {
              final var references =
                  handle.prepareBatch(
                      "DELETE FROM ontology_reference WHERE sourceType = 'ontologyAxiom' AND sourceId = :id");
              final var axioms =
                  handle.prepareBatch("DELETE FROM ontology_axiom_entity WHERE id = :id");
              ids.forEach(
                  id -> {
                    references.bind("id", id.toString()).add();
                    axioms.bind("id", id.toString()).add();
                  });
              references.execute();
              axioms.execute();
            });
  }

  private static void insertMissingBindings(OntologyConcept concept, UUID after, int count) {
    Entity.getJdbi()
        .useHandle(
            handle -> {
              final var batch =
                  handle.prepareBatch(
                      "INSERT INTO ontology_concept_binding "
                          + "(conceptId, assetId, assetType, assetFqnHash, columnBindings) "
                          + "VALUES (:conceptId, :assetId, 'topic', :hash, '[]')");
              for (int index = 1; index <= count; index++) {
                final var id = shift(after, index);
                batch
                    .bind("conceptId", concept.getId().toString())
                    .bind("assetId", id.toString())
                    .bind("hash", "missing-" + id)
                    .add();
              }
              batch.execute();
            });
  }

  private static UUID shift(UUID id, int distance) {
    final var value =
        new BigInteger(id.toString().replace("-", ""), 16).add(BigInteger.valueOf(distance));
    final var hex = "%032x".formatted(value);
    return UUID.fromString(
        hex.substring(0, 8)
            + "-"
            + hex.substring(8, 12)
            + "-"
            + hex.substring(12, 16)
            + "-"
            + hex.substring(16, 20)
            + "-"
            + hex.substring(20));
  }

  private static void bindSharedTopic(TestNamespace ns, List<OntologyConcept> concepts) {
    final var topic = TopicTestFactory.createSimple(ns);
    for (final var concept : concepts) {
      bind(
          concept,
          new OntologyAssetBinding()
              .withAssetType(OntologyBindingAssetType.TOPIC)
              .withAssetId(topic.getId()),
          0L);
    }
  }

  private static OpenMetadataClient ownerReader(RdfAccessFixtures fixtures, String resource) {
    final var role = fixtures.denyRole(MetadataOperation.VIEW_BASIC, resource);
    final var policy =
        admin().policies().get(role.getPolicies().getFirst().getId().toString(), "rules");
    policy.getRules().getFirst().setCondition("!isOwner()");
    admin().policies().update(policy.getId(), policy);
    return client(fixtures.userToken("owner", List.of(role.getId())));
  }

  private static EntityReference readerReference(OpenMetadataClient reader) {
    return reader
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/users/loggedInUser", null, User.class)
        .getEntityReference();
  }

  private static void assertAxiomNameOrdering(
      Ontology ontology, List<String> names, List<UUID> ids) {
    Entity.getJdbi()
        .useHandle(
            handle -> {
              final var ordered =
                  handle
                      .createQuery(
                          "SELECT id FROM ontology_axiom_entity WHERE ontologyId = :ontologyId "
                              + "AND name IN (<names>) ORDER BY name, id")
                      .bind("ontologyId", ontology.getId().toString())
                      .bindList("names", names)
                      .mapTo(String.class)
                      .list();
              assertEquals(ids.stream().map(UUID::toString).toList(), ordered);
              final int equalNames =
                  handle
                      .createQuery(
                          "SELECT COUNT(*) FROM ontology_axiom_entity WHERE ontologyId = :ontologyId AND name = :name")
                      .bind("ontologyId", ontology.getId().toString())
                      .bind("name", names.getFirst())
                      .mapTo(Integer.class)
                      .one();
              if (TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL) {
                assertEquals(
                    "utf8mb4_0900_ai_ci",
                    handle
                        .createQuery(
                            "SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                                + "AND TABLE_NAME = 'ontology_axiom_entity' AND COLUMN_NAME = 'name'")
                        .mapTo(String.class)
                        .one());
                assertEquals(3, equalNames);
              } else {
                assertEquals(1, equalNames);
              }
            });
  }

  private static void assertInvisibleBindingRows(Ontology ontology, List<Long> expectedRows) {
    final var observed = new ScanObservation();
    try (var queries = SqlQueryCounter.forRequests(Entity.getJdbi(), "select", observed::record)) {
      final var graph = graph(admin(), ontology, "");
      assertEquals(1, graph.getPaging().getTotal());
      assertEquals(List.of(), graph.getClusters());
      assertEquals(List.of(), graph.getEdges());
    }
    assertEquals(expectedRows, observed.bindingRows);
    observed.assertBounded();
  }

  private static final class ScanObservation {
    private static final Pattern IN_LIST = Pattern.compile("\\bin\\s*\\(([^)]*)\\)");
    private final List<Long> bindingRows = new CopyOnWriteArrayList<>();
    private final List<Long> axiomRows = new CopyOnWriteArrayList<>();
    private final AtomicInteger largestInList = new AtomicInteger();
    private final AtomicBoolean boundedRows = new AtomicBoolean(true);

    boolean record(StatementContext statement) {
      final var sql = statement.getRenderedSql().toLowerCase(Locale.ROOT);
      if (!sql.contains("select")) {
        return false;
      }
      final var lists = IN_LIST.matcher(sql);
      while (lists.find()) {
        largestInList.accumulateAndGet(lists.group(1).split(",").length, Math::max);
      }
      final var rows =
          sql.contains("from ontology_concept_binding") && !sql.contains("count(")
              ? bindingRows
              : sql.contains("from ontology_axiom_entity a") && sql.contains("axiom_subject")
                  ? axiomRows
                  : null;
      if (rows != null) {
        boundedRows.compareAndSet(true, sql.contains(" limit "));
        statement.addCleanable(
            () -> {
              rows.add(statement.getMappedRows());
              log.info("Graph scan SQL mappedRows={} sql={}", statement.getMappedRows(), sql);
            });
      }
      return true;
    }

    void assertBounded() {
      assertTrue(boundedRows.get(), "Every scan query must carry LIMIT");
      assertTrue(bindingRows.stream().allMatch(rows -> rows <= 500), bindingRows.toString());
      assertTrue(axiomRows.stream().allMatch(rows -> rows <= 500), axiomRows.toString());
      assertTrue(
          largestInList.get() <= 500, "The widest observed SQL IN list was " + largestInList);
    }
  }

  private static void restriction(Ontology ontology, URI subject, URI target) {
    admin()
        .ontologyAxioms()
        .create(
            new CreateOntologyAxiom()
                .withName("restricts" + subject.getSchemeSpecificPart())
                .withDisplayName("Restricted concept")
                .withDescription("A named filler restriction between bound concepts")
                .withOntology(ontology.getFullyQualifiedName())
                .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                .withSubjectIri(subject)
                .withProvenance(RelationProvenance.MANUAL)
                .withExpressions(
                    List.of(
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.RESTRICTION)
                            .withPropertyIri(RELATES_TO)
                            .withRestrictionKind(OntologyRestrictionKind.SOME)
                            .withFiller(
                                new OntologyExpression()
                                    .withKind(OntologyExpressionKind.NAMED_CLASS)
                                    .withClassIri(target)))));
  }

  private static List<Table> tables(TestNamespace ns, String schema, int count) {
    final var tables = new ArrayList<Table>();
    for (int index = 0; index < count; index++) {
      tables.add(
          admin()
              .tables()
              .create(
                  new CreateTable()
                      .withName(ns.prefix("t" + UUID.randomUUID()))
                      .withDatabaseSchema(schema)
                      .withColumns(
                          List.of(
                              new Column()
                                  .withName("value")
                                  .withDataType(ColumnDataType.STRING)))));
    }
    return tables;
  }

  private static OntologyColumnBinding column(OntologyProperty property) {
    return new OntologyColumnBinding()
        .withPropertyId(property.getId())
        .withColumnPath(List.of("value"));
  }

  private static void bindAll(OntologyConcept concept, List<Table> tables) {
    for (int index = 0; index < tables.size(); index++) {
      bind(concept, tables.get(index), List.of(), index);
    }
  }

  private static void bind(
      OntologyConcept concept, Table table, List<OntologyColumnBinding> columns, long revision) {
    bind(
        concept,
        new OntologyAssetBinding()
            .withAssetType(OntologyBindingAssetType.TABLE)
            .withAssetId(table.getId())
            .withColumns(columns),
        revision);
  }

  private static void bind(OntologyConcept concept, OntologyAssetBinding asset, long revision) {
    final var saved =
        admin()
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                bindingsPath(concept),
                new UpdateOntologyConceptBinding().withExpectedRevision(revision).withAsset(asset),
                OntologyConceptBindingsResponse.class);
    assertEquals(revision + 1, saved.getRevision());
  }

  private static OntologyConceptBindingsResponse bindings(OntologyConcept concept, String query) {
    return bindings(admin(), concept, query);
  }

  private static OntologyConceptBindingsResponse bindings(
      OpenMetadataClient client, OntologyConcept concept, String query) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            bindingsPath(concept) + query,
            null,
            OntologyConceptBindingsResponse.class);
  }

  private static String bindingsPath(OntologyConcept concept) {
    return "/v1/ontologyConcepts/" + concept.getId() + "/bindings";
  }

  private static void lineage(EntityInterface<?> from, EntityInterface<?> to) {
    admin()
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())));
  }

  private static NativeOntologyDataGraph graph(
      OpenMetadataClient client, Ontology ontology, String query) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/" + ontology.getId() + "/dataGraph" + query,
            null,
            NativeOntologyDataGraph.class);
  }

  private static OpenMetadataClient admin() {
    return SdkClients.adminClient();
  }

  private static OpenMetadataClient client(String token) {
    return new OpenMetadataClient(
        OpenMetadataConfig.builder().serverUrl(SdkClients.baseUrl()).accessToken(token).build());
  }

  private static void assertStatus(int status, Runnable request) {
    assertEquals(status, assertThrows(OpenMetadataException.class, request::run).getStatusCode());
  }
}
