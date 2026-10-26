package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.reads;
import static org.openmetadata.it.tests.OntologyBindingFixtures.CUSTOMER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.INVOICE;
import static org.openmetadata.it.tests.OntologyBindingFixtures.ORDER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.admin;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertEdge;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertStatus;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertion;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bind;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindAll;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindings;
import static org.openmetadata.it.tests.OntologyBindingFixtures.client;
import static org.openmetadata.it.tests.OntologyBindingFixtures.column;
import static org.openmetadata.it.tests.OntologyBindingFixtures.dataProperty;
import static org.openmetadata.it.tests.OntologyBindingFixtures.graph;
import static org.openmetadata.it.tests.OntologyBindingFixtures.ids;
import static org.openmetadata.it.tests.OntologyBindingFixtures.lineage;
import static org.openmetadata.it.tests.OntologyBindingFixtures.objectProperty;
import static org.openmetadata.it.tests.OntologyBindingFixtures.restriction;
import static org.openmetadata.it.tests.OntologyBindingFixtures.serviceTypes;
import static org.openmetadata.it.tests.OntologyBindingFixtures.tables;
import static org.openmetadata.it.tests.OntologyBindingFixtures.topicAsset;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.NativeOntologyAssetCluster;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;

/**
 * The native data graph page: ranking, offsets, what a partial reader sees, lineage between the
 * returned assets and the statement budget. Scan boundaries live in the edge and binding scan ITs.
 */
@Isolated("Counts SQL statements while serving the native data graph over HTTP")
@ExtendWith(TestNamespaceExtension.class)
@Slf4j
class NativeOntologyDataGraphIT extends BaseOntologyApprovalIT {
  @Test
  void clustersRankByBindingsAndPageIntoTheBindingsEndpoint(final TestNamespace ns) {
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
    bind(invoice, topicAsset(topic), 0L);
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
  void aBoundConceptBeyondTheOldOffsetCeilingIsReachable(final TestNamespace ns) {
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
      if (index == 5) {
        bind(concept, hidden, List.of(), 0L);
      } else {
        bind(concept, topicAsset(topic), 0L);
      }
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
  void hiddenAssetsAndConceptsLeaveNoTraceForAPartialReader(final TestNamespace ns) {
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
    bind(customer, topicAsset(topic), 2L);
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
        final var propertyFixtures = new RdfAccessFixtures("property" + ns.shortPrefix());
        final var conceptFixtures = new RdfAccessFixtures("concept" + ns.shortPrefix());
        final var ontologyFixtures = new RdfAccessFixtures("ontology" + ns.shortPrefix())) {
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
  void statementCountDoesNotGrowWithConceptsOrAssets(final TestNamespace ns) {
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

  private static Ontology boundOntology(
      final TestNamespace ns,
      final String name,
      final int concepts,
      final int assetsPerConcept,
      final String service) {
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
                bind(concept, topicAsset(TopicTestFactory.createSimple(ns, service)), asset);
              }
            });
    return ontology;
  }
}
