package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

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
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

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
    assertStatus(400, () -> graph(admin(), ontology, "?offset=49"));
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
            wideReads <= narrowReads + 4,
            "A page of 12 of 40 concepts with 2 assets each ran "
                + wideReads
                + " reads; 4 concepts with 1 asset ran "
                + narrowReads);
      }
    }
  }

  private static int reads(OpenMetadataClient client, Ontology ontology) {
    try (var queries = SqlQueryCounter.forRequests(Entity.getJdbi(), "select")) {
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

  private static void assertion(Ontology ontology, URI subject, URI target) {
    admin()
        .ontologyAxioms()
        .create(
            new CreateOntologyAxiom()
                .withName("relates" + subject.getSchemeSpecificPart())
                .withDisplayName("Related concepts")
                .withDescription("An object property assertion between bound concepts")
                .withOntology(ontology.getFullyQualifiedName())
                .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
                .withSubjectIri(subject)
                .withPropertyIri(RELATES_TO)
                .withTargetIri(target)
                .withExpressions(List.of())
                .withProvenance(RelationProvenance.MANUAL));
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
    return admin()
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
