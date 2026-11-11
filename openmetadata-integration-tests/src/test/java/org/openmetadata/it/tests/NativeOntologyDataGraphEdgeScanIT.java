package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.assertAxiomNameOrdering;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.deleteAxiomClones;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.insertAxiomClones;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.insertIrrelevantAxioms;
import static org.openmetadata.it.tests.OntologyBindingFixtures.CUSTOMER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.INVOICE;
import static org.openmetadata.it.tests.OntologyBindingFixtures.ORDER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.admin;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertEdge;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertStatus;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertion;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertionRequest;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindSharedTopic;
import static org.openmetadata.it.tests.OntologyBindingFixtures.client;
import static org.openmetadata.it.tests.OntologyBindingFixtures.graph;
import static org.openmetadata.it.tests.OntologyBindingFixtures.objectProperty;
import static org.openmetadata.it.tests.OntologyBindingFixtures.ownerReader;
import static org.openmetadata.it.tests.OntologyBindingFixtures.readerReference;

import java.net.URI;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.NativeOntologyGraphScanProbe.AxiomClone;
import org.openmetadata.it.tests.NativeOntologyGraphScanProbe.ScanObservation;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** The axiom scan behind the data graph's concept edges: permission, page boundaries, keysets. */
@Isolated("Counts SQL statements while serving the native data graph over HTTP")
@ExtendWith(TestNamespaceExtension.class)
class NativeOntologyDataGraphEdgeScanIT extends BaseOntologyApprovalIT {
  @Test
  void anAxiomDeniedByBasicViewCannotRevealAnEdge(final TestNamespace ns) {
    final var ontology = createOntology(ns, "deniedGraphAxiom");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    final var property = objectProperty(ontology, "Relates to");
    final var axiom = assertion(ontology, CUSTOMER, ORDER);
    bindSharedTopic(ns, List.of(customer, order));
    assertEdge(graph(admin(), ontology, ""), customer, order, property);

    try (var fixtures = new RdfAccessFixtures("graphAxiom" + ns.shortPrefix())) {
      final var noAxioms = fixtures.denyRole(MetadataOperation.VIEW_BASIC, Entity.ONTOLOGY_AXIOM);
      final var reader = client(fixtures.userToken("noAxioms", List.of(noAxioms.getId())));
      assertStatus(403, () -> readAxiom(reader, axiom));
      final var partial = graph(reader, ontology, "");
      assertEquals(2, partial.getClusters().size());
      assertEquals(List.of(), partial.getEdges());
    }
  }

  @Test
  void aVisibleEdgeAfterAnAxiomCandidatePageIsStillReturned(final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Seeds a real embedded database candidate page");
    final var ontology = createOntology(ns, "deepGraphEdges");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    declareClass(ontology, "Unbound", URI.create("urn:Unbound"));
    final var property = objectProperty(ontology, "Relates to");
    final var irrelevant = assertion(ontology, CUSTOMER, URI.create("urn:Unbound"), "aaaTemplate");
    assertion(ontology, CUSTOMER, ORDER, "zzzVisible");
    bindSharedTopic(ns, List.of(customer, order));

    final var cloneIds = insertIrrelevantAxioms(ontology, irrelevant, 501);
    try {
      final var observed = new ScanObservation();
      final var graph = observed.watch(() -> graph(admin(), ontology, "?edgeLimit=1"));
      assertEdge(graph, customer, order, property);
      assertEquals(List.of(500L, 3L), observed.axiomRows());
      observed.assertBounded();
    } finally {
      deleteAxiomClones(cloneIds);
    }
  }

  @Test
  void aFullDeniedAxiomBatchDoesNotConsumeTheVisibleEdgeLimit(final TestNamespace ns) {
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
      assertStatus(403, () -> readAxiom(reader, denied));
      assertEquals(allowed.getId(), readAxiom(reader, allowed).getId());
      final var observed = new ScanObservation();
      final var graph = observed.watch(() -> graph(reader, ontology, "?edgeLimit=1"));
      assertEquals(1, graph.getEdges().size());
      assertEdge(graph, order, customer, property);
      assertEquals(List.of(500L, 3L), observed.axiomRows());
      observed.assertBounded();
    } finally {
      deleteAxiomClones(cloneIds);
    }
  }

  @Test
  void axiomNameKeysetsKeepDistinctLinksAcrossCollationTiesAndDuplicates(final TestNamespace ns) {
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
      final var graph = observed.watch(() -> graph(admin(), ontology, "?edgeLimit=2"));
      assertEquals(2, graph.getEdges().size());
      assertEdge(graph, customer, order, property);
      assertEdge(graph, customer, invoice, property);
      assertEquals(List.of(500L, 2L), observed.axiomRows());
      observed.assertBounded();
    } finally {
      deleteAxiomClones(cloneIds);
    }
  }

  private static OntologyAxiom readAxiom(
      final OpenMetadataClient reader, final OntologyAxiom axiom) {
    return reader
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/ontologyAxioms/" + axiom.getId(), null, OntologyAxiom.class);
  }
}
