package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.deleteAxiomClones;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.insertIrrelevantAxioms;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.bindingsPage;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.clusterPage;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.graphPage;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.loadAllClusters;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.topologyPage;
import static org.openmetadata.it.tests.OntologyBindingFixtures.CUSTOMER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.INVOICE;
import static org.openmetadata.it.tests.OntologyBindingFixtures.ORDER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.admin;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertStatus;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertion;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bind;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindAll;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindSharedTopic;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindings;
import static org.openmetadata.it.tests.OntologyBindingFixtures.client;
import static org.openmetadata.it.tests.OntologyBindingFixtures.graph;
import static org.openmetadata.it.tests.OntologyBindingFixtures.lineage;
import static org.openmetadata.it.tests.OntologyBindingFixtures.objectProperty;
import static org.openmetadata.it.tests.OntologyBindingFixtures.tables;
import static org.openmetadata.it.tests.OntologyBindingFixtures.topicAsset;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.tests.NativeOntologyGraphScanProbe.ScanObservation;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPage;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/** {@code POST /dataGraph/pages}: one selection plus topology over the loaded concept prefixes. */
@Isolated("Counts SQL statements while serving the native data graph over HTTP")
@ExtendWith(TestNamespaceExtension.class)
class NativeOntologyDataGraphPageIT extends BaseOntologyApprovalIT {
  private static final String PREFIX_LINEAGE =
      "relation.fromid, relation.toid, relation.fromentity";

  @Test
  void combinedPagesJoinPreviouslyLoadedClustersAndLaterAssets(final TestNamespace ns) {
    final var ontology = createOntology(ns, "combinedPages");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    final var unrelated = declareClass(ontology, "Unrelated", INVOICE);
    objectProperty(ontology, "Relates to");
    assertion(ontology, CUSTOMER, ORDER);
    assertion(ontology, ORDER, CUSTOMER);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var customerTables = sortedTables(ns, schema, 6);
    final var orderTables = sortedTables(ns, schema, 6);
    bindAll(customer, customerTables);
    bindAll(order, orderTables);
    bindAll(unrelated, tables(ns, schema, 1));
    lineage(customerTables.getFirst(), orderTables.getFirst());
    lineage(customerTables.get(4), orderTables.getFirst());
    lineage(orderTables.getFirst(), customerTables.get(4));
    lineage(customerTables.get(4), orderTables.get(4));

    final var first = graphPage(admin(), ontology, List.of(), clusterPage(0, 1));
    assertEquals(
        List.of(customer.getId()),
        first.getLoaded().stream().map(NativeOntologyLoadedPrefix::getConceptId).toList());
    assertEquals(List.of(), first.getTopology().getEdges());
    final var second = graphPage(admin(), ontology, first.getLoaded(), clusterPage(1, 1));
    assertEquals(
        Set.of(customer.getId() + ">" + order.getId(), order.getId() + ">" + customer.getId()),
        second.getTopology().getEdges().stream()
            .map(edge -> edge.getFromConceptId() + ">" + edge.getToConceptId())
            .collect(Collectors.toSet()));
    assertEquals(
        Set.of(edge(customerTables.getFirst(), orderTables.getFirst())),
        Set.copyOf(second.getTopology().getLineageEdges()));
    final var customerPage =
        graphPage(
            admin(),
            ontology,
            second.getLoaded(),
            bindingsPage(
                second.getLoaded().getFirst(), 1, first.getClusters().getFirst().getAfter()));
    assertEquals(
        List.of(customerTables.get(4).getId()),
        customerPage.getBindings().getAssets().stream().map(asset -> asset.getAssetId()).toList());
    assertEquals(
        Set.of(
            edge(customerTables.getFirst(), orderTables.getFirst()),
            edge(customerTables.get(4), orderTables.getFirst()),
            edge(orderTables.getFirst(), customerTables.get(4))),
        Set.copyOf(customerPage.getTopology().getLineageEdges()));
    final var orderPage =
        graphPage(
            admin(),
            ontology,
            customerPage.getLoaded(),
            bindingsPage(
                customerPage.getLoaded().get(1), 1, second.getClusters().getFirst().getAfter()));
    assertEquals(
        Set.of(
            edge(customerTables.getFirst(), orderTables.getFirst()),
            edge(customerTables.get(4), orderTables.getFirst()),
            edge(orderTables.getFirst(), customerTables.get(4)),
            edge(customerTables.get(4), orderTables.get(4))),
        Set.copyOf(orderPage.getTopology().getLineageEdges()));
    assertEquals(2, orderPage.getTopology().getEdges().size());
    assertNull(orderPage.getTopology().getAfter());
    assertEquals(List.of(), graph(admin(), ontology, "?limit=1&offset=1").getEdges());

    final var foreign = createOntology(ns, "foreignContext");
    assertStatus(400, () -> graphPage(admin(), foreign, second.getLoaded(), clusterPage(0, 1)));
    bind(customer, tables(ns, schema, 1).getFirst(), List.of(), 6L);
    assertStatus(412, () -> graphPage(admin(), ontology, orderPage.getLoaded(), clusterPage(0, 1)));
  }

  @Test
  void aForgedHighWaterMarkCannotProbeWhetherAHiddenAssetIsBound(final TestNamespace ns) {
    final var ontology = createOntology(ns, "forgedMark");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var pair = tables(ns, schema, 2);
    final var bound = pair.getFirst();
    final var unbound = pair.getLast();
    bind(customer, bound, List.of(), 0L);
    final long revision = bindings(customer, "").getRevision();
    try (var fixtures = new RdfAccessFixtures("forged" + ns.shortPrefix())) {
      final var noTables = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.TABLE);
      final var reader = client(fixtures.userToken("reader", List.of(noTables.getId())));
      final var boundProbe =
          graphPage(
              reader,
              ontology,
              List.of(prefix(customer, revision, bound.getId())),
              clusterPage(0, 12));
      final var unboundProbe =
          graphPage(
              reader,
              ontology,
              List.of(prefix(customer, revision, unbound.getId())),
              clusterPage(0, 12));
      final var randomProbe =
          graphPage(
              reader,
              ontology,
              List.of(prefix(customer, revision, UUID.randomUUID())),
              clusterPage(0, 12));
      for (final var probe : List.of(boundProbe, unboundProbe, randomProbe)) {
        assertEquals(List.of(), probe.getClusters());
        assertEquals(List.of(), probe.getTopology().getEdges());
        assertEquals(List.of(), probe.getTopology().getLineageEdges());
        assertNull(probe.getTopology().getAfter());
      }
      assertEquals(
          List.of(),
          graphPage(
                  admin(),
                  ontology,
                  List.of(prefix(customer, revision, UUID.randomUUID())),
                  clusterPage(0, 12))
              .getClusters());
    }
  }

  @Test
  void sixtyOneConceptsStopAdvertisingClusterOffsetsOnceTheContextIsFull(final TestNamespace ns) {
    final var ontology = createOntology(ns, "fullContext");
    final var topic =
        TopicTestFactory.createSimple(
            ns, MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName());
    final var concepts = new ArrayList<OntologyConcept>();
    for (int index = 0; index < 61; index++) {
      final var concept =
          declareClass(
              ontology,
              "FullConcept%02d".formatted(index),
              URI.create(ontology.getNamespace() + "FullConcept" + index));
      concepts.add(concept);
      bind(concept, topicAsset(topic), 0L);
    }

    List<NativeOntologyLoadedPrefix> loaded = List.of();
    final var seen = new ArrayList<UUID>();
    final var advertised = new ArrayList<Integer>();
    NativeOntologyDataGraphPage page;
    Integer offset = 0;
    do {
      page = graphPage(admin(), ontology, loaded, clusterPage(offset, 12));
      page.getClusters().forEach(cluster -> seen.add(cluster.getConcept().getId()));
      loaded = page.getLoaded();
      advertised.add(page.getNextClusterOffset());
      offset = page.getNextClusterOffset();
      if (offset != null) {
        assertFalse(page.getContextFull());
      }
    } while (offset != null);

    assertEquals(Arrays.asList(12, 24, 36, 48, null), advertised);
    assertTrue(page.getContextFull());
    assertEquals(60, loaded.size());
    assertEquals(concepts.subList(0, 60).stream().map(OntologyConcept::getId).toList(), seen);

    final var beyond = graphPage(admin(), ontology, loaded, clusterPage(60, 12));
    assertEquals(List.of(), beyond.getClusters());
    assertNull(beyond.getNextClusterOffset());
    assertTrue(beyond.getContextFull());
    assertEquals(60, beyond.getLoaded().size());
  }

  @Test
  void hiddenAxiomsPropertiesAndConceptsStayHiddenOnThePagePath(final TestNamespace ns) {
    final var ontology = createOntology(ns, "hiddenPageTopology");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    objectProperty(ontology, "Relates to");
    assertion(ontology, CUSTOMER, ORDER);
    bindSharedTopic(ns, List.of(customer, order));
    final var full = graphPage(admin(), ontology, List.of(), clusterPage(0, 12));
    assertEquals(
        List.of(customer.getId() + ">" + order.getId()),
        full.getTopology().getEdges().stream()
            .map(edge -> edge.getFromConceptId() + ">" + edge.getToConceptId())
            .toList());
    assertNotNull(full.getTopology().getEdges().getFirst().getProperty());

    try (var axiomFixtures = new RdfAccessFixtures("pageAxiom" + ns.shortPrefix());
        var propertyFixtures = new RdfAccessFixtures("pageProperty" + ns.shortPrefix());
        var conceptFixtures = new RdfAccessFixtures("pageConcept" + ns.shortPrefix())) {
      final var noAxioms =
          axiomFixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_AXIOM);
      final var axiomReader = client(axiomFixtures.userToken("axioms", List.of(noAxioms.getId())));
      final var hiddenAxiom = graphPage(axiomReader, ontology, List.of(), clusterPage(0, 12));
      assertEquals(2, hiddenAxiom.getClusters().size());
      assertEquals(List.of(), hiddenAxiom.getTopology().getEdges());

      final var noProperties =
          propertyFixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_PROPERTY);
      final var propertyReader =
          client(propertyFixtures.userToken("properties", List.of(noProperties.getId())));
      final var hiddenProperty = graphPage(propertyReader, ontology, List.of(), clusterPage(0, 12));
      assertEquals(1, hiddenProperty.getTopology().getEdges().size());
      assertNull(hiddenProperty.getTopology().getEdges().getFirst().getProperty());
      assertEquals("relatesTo", hiddenProperty.getTopology().getEdges().getFirst().getLabel());

      final var noConcepts =
          conceptFixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_CONCEPT);
      final var conceptReader =
          client(conceptFixtures.userToken("concepts", List.of(noConcepts.getId())));
      final var hiddenConcepts = graphPage(conceptReader, ontology, List.of(), clusterPage(0, 12));
      assertEquals(List.of(), hiddenConcepts.getClusters());
      assertEquals(List.of(), hiddenConcepts.getLoaded());
      assertEquals(List.of(), hiddenConcepts.getTopology().getEdges());
      assertEquals(List.of(), hiddenConcepts.getTopology().getLineageEdges());
      assertStatus(
          412, () -> graphPage(conceptReader, ontology, full.getLoaded(), clusterPage(0, 12)));
    }
  }

  @Test
  void topologyContinuesAnEmptyCandidatePageAndBindsItsCursorToTheExactContext(
      final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Seeds a bounded candidate stream");
    final var ontology = createOntology(ns, "topologyCursor");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    declareClass(ontology, "Unbound", URI.create("urn:Unbound"));
    objectProperty(ontology, "Relates to");
    final var irrelevant = assertion(ontology, CUSTOMER, URI.create("urn:Unbound"), "aaaTemplate");
    assertion(ontology, CUSTOMER, ORDER, "zzzVisible");
    bindSharedTopic(ns, List.of(customer, order));
    final var clones = insertIrrelevantAxioms(ontology, irrelevant, 501);
    try {
      final var observed = new ScanObservation();
      final var first =
          observed.watch(() -> graphPage(admin(), ontology, List.of(), clusterPage(0, 12)));
      assertEquals(List.of(500L), observed.axiomRows());
      assertEquals(List.of(), first.getTopology().getEdges());
      assertNotNull(first.getTopology().getAfter());
      final var continuation = topologyPage(first.getTopology().getAfter());
      assertStatus(
          400,
          () -> graphPage(admin(), ontology, List.of(first.getLoaded().getFirst()), continuation));
      final var next = graphPage(admin(), ontology, first.getLoaded(), continuation);
      assertEquals(
          List.of(customer.getId() + ">" + order.getId()),
          next.getTopology().getEdges().stream()
              .map(edge -> edge.getFromConceptId() + ">" + edge.getToConceptId())
              .toList());
      assertNull(next.getTopology().getAfter());
      assertEquals(first.getTopology().getContextDigest(), next.getTopology().getContextDigest());
      assertStatus(
          400, () -> graphPage(admin(), ontology, first.getLoaded(), topologyPage("malformed")));
      deleteAxiomClones(clones);
      assertStatus(412, () -> graphPage(admin(), ontology, first.getLoaded(), continuation));
    } finally {
      deleteAxiomClones(clones);
    }
  }

  @Test
  void prefixLineageFindsAValidEdgeBeyondUnrelatedOutgoingRowsAndReauthorizesEndpoints(
      final TestNamespace ns) {
    assumeFalse(
        OssTestServer.isExternalMode(), "Seeds outgoing relationships outside the loaded prefixes");
    final var ontology = createOntology(ns, "prefixLineage");
    final var concept = declareClass(ontology, "Customer", CUSTOMER);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var bound = tables(ns, schema, 2);
    bindAll(concept, bound);
    lineage(bound.getFirst(), bound.getLast());
    Entity.getJdbi()
        .useHandle(
            handle -> {
              final var rows =
                  handle.prepareBatch(
                      "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType, deleted) VALUES (:source, :target, 'table', 'table', :relation, '', FALSE)");
              for (int index = 1; index <= 2501; index++) {
                rows.bind("source", bound.getFirst().getId().toString())
                    .bind("target", new UUID(0, index).toString())
                    .bind("relation", Relationship.UPSTREAM.ordinal())
                    .add();
              }
              rows.execute();
            });
    try (var fixtures = new RdfAccessFixtures("prefixDeny" + ns.shortPrefix())) {
      final var page = graphPage(admin(), ontology, List.of(), clusterPage(0, 12));
      assertEquals(
          List.of(edge(bound.getFirst(), bound.getLast())), page.getTopology().getLineageEdges());
      assertNull(page.getTopology().getAfter());
      final var noTables = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.TABLE);
      final var reader = client(fixtures.userToken("reader", List.of(noTables.getId())));
      final var hidden = graphPage(reader, ontology, page.getLoaded(), clusterPage(0, 12));
      assertEquals(List.of(), hidden.getClusters());
      assertEquals(List.of(), hidden.getTopology().getLineageEdges());
      assertFalse(JsonUtils.pojoToJson(hidden).contains(bound.getFirst().getName()));
      admin().tables().delete(bound.getLast().getId());
      assertEquals(
          List.of(),
          graphPage(admin(), ontology, page.getLoaded(), clusterPage(0, 12))
              .getTopology()
              .getLineageEdges());
    } finally {
      Entity.getJdbi()
          .useHandle(
              handle ->
                  handle
                      .createUpdate(
                          "DELETE FROM entity_relationship WHERE fromId = :source AND toId >= :first AND toId <= :last AND relation = :relation")
                      .bind("source", bound.getFirst().getId().toString())
                      .bind("first", new UUID(0, 1).toString())
                      .bind("last", new UUID(0, 2501).toString())
                      .bind("relation", Relationship.UPSTREAM.ordinal())
                      .execute());
    }
  }

  @Test
  void lineageKeysetsContinueAcrossDuplicatePairsWithoutUnboundedCandidateReads(
      final TestNamespace ns) {
    assumeFalse(
        OssTestServer.isExternalMode(), "Seeds distinct relationship keys for the same asset pair");
    final var ontology = createOntology(ns, "duplicateLineage");
    final var concept = declareClass(ontology, "Customer", CUSTOMER);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var bound = tables(ns, schema, 2);
    bindAll(concept, bound);
    Entity.getJdbi()
        .useHandle(
            handle -> {
              final var batch =
                  handle.prepareBatch(
                      "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType, deleted) VALUES (:source, :target, 'table', 'table', :relation, :type, FALSE)");
              for (int index = 0; index < 501; index++) {
                batch
                    .bind("source", bound.getFirst().getId().toString())
                    .bind("target", bound.getLast().getId().toString())
                    .bind("relation", Relationship.UPSTREAM.ordinal())
                    .bind("type", "variant" + String.format("%04d", index))
                    .add();
              }
              batch.execute();
            });
    final List<Long> candidateRows = new CopyOnWriteArrayList<>();
    try (var queries =
        SqlQueryCounter.forRequests(
            Entity.getJdbi(),
            "select",
            statement -> {
              final var sql = statement.getRenderedSql().toLowerCase(Locale.ROOT);
              if (sql.contains(PREFIX_LINEAGE)) {
                statement.addCleanable(() -> candidateRows.add(statement.getMappedRows()));
                return true;
              }
              return false;
            })) {
      final var first = graphPage(admin(), ontology, List.of(), clusterPage(0, 12));
      assertEquals(1, first.getTopology().getLineageEdges().size());
      assertNotNull(first.getTopology().getAfter());
      final var second =
          graphPage(
              admin(), ontology, first.getLoaded(), topologyPage(first.getTopology().getAfter()));
      assertEquals(first.getTopology().getLineageEdges(), second.getTopology().getLineageEdges());
      assertNull(second.getTopology().getAfter());
      assertEquals(List.of(500L, 1L), candidateRows);
    } finally {
      Entity.getJdbi()
          .useHandle(
              handle ->
                  handle
                      .createUpdate(
                          "DELETE FROM entity_relationship WHERE fromId = :source AND toId = :target AND relation = :relation")
                      .bind("source", bound.getFirst().getId().toString())
                      .bind("target", bound.getLast().getId().toString())
                      .bind("relation", Relationship.UPSTREAM.ordinal())
                      .execute());
    }
  }

  @Test
  void loadedContextReadsDoNotGrowWithConceptsOrAssets(final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final var service = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
    final var narrow = NativeOntologyDataGraphIT.boundOntology(ns, "pageNarrow", 4, 1, service);
    final var wide = NativeOntologyDataGraphIT.boundOntology(ns, "pageWide", 40, 2, service);
    try (var fixtures = new RdfAccessFixtures("pageBudget" + ns.shortPrefix())) {
      final var noTables = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.TABLE);
      final var reader = client(fixtures.userToken("reader", List.of(noTables.getId())));
      for (final var client : List.of(admin(), reader)) {
        final var narrowPrefixes = loadAllClusters(client, narrow);
        final var widePrefixes = loadAllClusters(client, wide);
        assertEquals(4, narrowPrefixes.size());
        assertEquals(40, widePrefixes.size());
        final int narrowReads = pageReads(client, narrow, narrowPrefixes);
        final int wideReads = pageReads(client, wide, widePrefixes);
        assertTrue(narrowReads > 0);
        assertTrue(
            wideReads <= narrowReads,
            "Loaded context queries grew from " + narrowReads + " at 4 concepts to " + wideReads);
      }
    }
  }

  private static int pageReads(
      final OpenMetadataClient client,
      final Ontology ontology,
      final List<NativeOntologyLoadedPrefix> loaded) {
    try (var queries =
        SqlQueryCounter.forRequests(
            Entity.getJdbi(),
            "select",
            statement -> statement.getRenderedSql().toLowerCase(Locale.ROOT).contains("select"))) {
      assertEquals(
          loaded.size(),
          graphPage(client, ontology, loaded, clusterPage(0, 12)).getLoaded().size());
      return queries.count();
    }
  }

  private static NativeOntologyLoadedPrefix prefix(
      final OntologyConcept concept, final long revision, final UUID throughAssetId) {
    return new NativeOntologyLoadedPrefix()
        .withConceptId(concept.getId())
        .withBindingRevision(revision)
        .withThroughAssetId(throughAssetId);
  }

  private static Edge edge(
      final org.openmetadata.schema.entity.data.Table from,
      final org.openmetadata.schema.entity.data.Table to) {
    return new Edge().withFromEntity(from.getId()).withToEntity(to.getId());
  }

  private static List<org.openmetadata.schema.entity.data.Table> sortedTables(
      final TestNamespace ns, final String schema, final int count) {
    return tables(ns, schema, count).stream()
        .sorted(Comparator.comparing(table -> table.getId().toString()))
        .toList();
  }
}
