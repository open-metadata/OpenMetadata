package org.openmetadata.it.tests;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.deleteAxiomClones;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.insertIrrelevantAxioms;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.clusterPage;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.conceptEdges;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.cursorSealedWithAnotherKey;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.deniedReader;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.edge;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.graphPage;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.prefix;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.randomCursor;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.refusal;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.sortedTables;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.tampered;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.topologyPage;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.unsignedCursor;
import static org.openmetadata.it.tests.OntologyBindingFixtures.CUSTOMER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.ORDER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.admin;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertStatus;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertion;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindAll;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindSharedTopic;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindings;
import static org.openmetadata.it.tests.OntologyBindingFixtures.lineage;
import static org.openmetadata.it.tests.OntologyBindingFixtures.objectProperty;
import static org.openmetadata.it.tests.OntologyBindingFixtures.tables;

import java.net.URI;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.tests.NativeOntologyGraphScanProbe.ScanObservation;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPage;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/** {@code POST /dataGraph/pages}: topology over the loaded concept prefixes, and its cursor. */
@Isolated("Counts SQL statements while serving the native data graph over HTTP")
@ExtendWith(TestNamespaceExtension.class)
class NativeOntologyDataGraphPageIT extends BaseOntologyApprovalIT {
  private static final URI UNBOUND = URI.create("urn:Unbound");
  private static final String PREFIX_LINEAGE =
      "relation.fromid, relation.toid, relation.fromentity";
  private static final String INSERT_RELATIONSHIP =
      "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType, deleted) VALUES (:source, :target, 'table', 'table', :relation, :type, FALSE)";
  private static final int UNRELATED_OUTGOING = 2501;
  private static final int DUPLICATE_PAIRS = 501;

  @Test
  void hiddenAxiomsPropertiesAndConceptsStayHiddenOnThePagePath(final TestNamespace ns) {
    final var related = relatedConcepts(ns, "hiddenPageTopology");
    final var full = graphPage(admin(), related.ontology(), List.of(), clusterPage(0, 12));
    assertEquals(List.of(related.edge()), conceptEdges(full));
    assertNotNull(full.getTopology().getEdges().getFirst().getProperty());
    assertAnAxiomReaderSeesClustersWithoutEdges(ns, related.ontology());
    assertAPropertyReaderSeesTheEdgeWithoutItsProperty(ns, related.ontology());
    assertAConceptReaderSeesNothingAndMustRefresh(ns, related.ontology(), full.getLoaded());
  }

  @Test
  void topologyContinuesAnEmptyCandidatePageAndBindsItsCursorToTheExactContext(
      final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Seeds a bounded candidate stream");
    final var template = templateGraph(ns);
    final var ontology = template.ontology();
    final var clones = insertIrrelevantAxioms(ontology, template.axiom(), 501);
    try {
      final var first = anEmptyFirstTopologyPage(ontology);
      final var continuation = topologyPage(first.getTopology().getAfter());
      final var narrower = List.of(first.getLoaded().getFirst());
      assertStatus(400, () -> graphPage(admin(), ontology, narrower, continuation));
      final var next = graphPage(admin(), ontology, first.getLoaded(), continuation);
      assertEquals(List.of(template.edge()), conceptEdges(next));
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
  void aForgedCursorNamingAHiddenAxiomGetsTheSameRefusalAsRandomBytes(final TestNamespace ns) {
    final var related = relatedConcepts(ns, "forgedCursor");
    final var ontology = related.ontology();
    final var hidden = related.axiom().getId();
    try (var fixtures = new RdfAccessFixtures("forgedCursor" + ns.shortPrefix())) {
      final var reader = deniedReader(fixtures, "axioms", Entity.ONTOLOGY_AXIOM);
      final var page = graphPage(reader, ontology, List.of(), clusterPage(0, 12));
      final var loaded = page.getLoaded();
      final var digest = page.getTopology().getContextDigest();
      final var random = refusal(reader, ontology, loaded, randomCursor());
      assertEquals("400 Invalid native graph topology cursor", random);
      assertEquals(random, refusal(reader, ontology, loaded, unsignedCursor(digest, hidden)));
      assertEquals(
          random, refusal(reader, ontology, loaded, unsignedCursor(digest, UUID.randomUUID())));
      assertEquals(
          random, refusal(reader, ontology, loaded, cursorSealedWithAnotherKey(digest, hidden)));
    }
  }

  @Test
  void anIssuedCursorWhoseLastScannedLineagePairIsHiddenShowsNeitherAsset(final TestNamespace ns) {
    assumeFalse(
        OssTestServer.isExternalMode(), "Seeds distinct relationship keys for the same asset pair");
    final var ontology = createOntology(ns, "sealedLineage");
    final var concept = declareClass(ontology, "Customer", CUSTOMER);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var bound = sortedTables(ns, schema, 2);
    bindAll(concept, bound);
    final long revision = bindings(concept, "").getRevision();
    final var loaded = List.of(prefix(concept, revision, bound.getLast().getId()));
    insertDuplicatePairs(bound.getFirst(), bound.getLast());
    try (var fixtures = new RdfAccessFixtures("sealedLineage" + ns.shortPrefix())) {
      final var reader = deniedReader(fixtures, "reader", Entity.TABLE);
      final var topology = graphPage(reader, ontology, loaded, clusterPage(0, 12)).getTopology();
      assertEquals(List.of(), topology.getLineageEdges());
      assertSealed(topology.getAfter(), bound);
      assertOnlyTheIssuedCursorContinues(reader, ontology, loaded, topology.getAfter());
    } finally {
      deleteDuplicatePairs(bound.getFirst(), bound.getLast());
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
    insertUnrelatedOutgoing(bound.getFirst());
    try (var fixtures = new RdfAccessFixtures("prefixDeny" + ns.shortPrefix())) {
      final var page = graphPage(admin(), ontology, List.of(), clusterPage(0, 12));
      final var loaded = page.getLoaded();
      assertEquals(
          List.of(edge(bound.getFirst(), bound.getLast())), page.getTopology().getLineageEdges());
      assertNull(page.getTopology().getAfter());
      final var reader = deniedReader(fixtures, "reader", Entity.TABLE);
      assertHiddenFrom(reader, ontology, loaded, bound.getFirst());
      assertADeletedEndpointDropsTheEdge(ontology, loaded, bound.getLast());
    } finally {
      deleteUnrelatedOutgoing(bound.getFirst());
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
    insertDuplicatePairs(bound.getFirst(), bound.getLast());
    final List<Long> candidateRows = new CopyOnWriteArrayList<>();
    try (var queries = prefixLineageRows(candidateRows)) {
      final var first = graphPage(admin(), ontology, List.of(), clusterPage(0, 12));
      assertEquals(1, first.getTopology().getLineageEdges().size());
      assertNotNull(first.getTopology().getAfter());
      final var after = topologyPage(first.getTopology().getAfter());
      final var second = graphPage(admin(), ontology, first.getLoaded(), after);
      assertEquals(first.getTopology().getLineageEdges(), second.getTopology().getLineageEdges());
      assertNull(second.getTopology().getAfter());
      assertEquals(List.of(500L, 1L), candidateRows);
    } finally {
      deleteDuplicatePairs(bound.getFirst(), bound.getLast());
    }
  }

  private static RelatedConcepts relatedConcepts(final TestNamespace ns, final String name) {
    final var ontology = createOntology(ns, name);
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    objectProperty(ontology, "Relates to");
    final var axiom = assertion(ontology, CUSTOMER, ORDER);
    bindSharedTopic(ns, List.of(customer, order));
    return new RelatedConcepts(ontology, axiom, customer.getId() + ">" + order.getId());
  }

  /**
   * Customer relates to Order through "zzzVisible". The returned axiom is "aaaTemplate", which
   * names an unbound concept and sorts first, so its clones fill the first candidate batch.
   */
  private static RelatedConcepts templateGraph(final TestNamespace ns) {
    final var ontology = createOntology(ns, "topologyCursor");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    declareClass(ontology, "Unbound", UNBOUND);
    objectProperty(ontology, "Relates to");
    final var template = assertion(ontology, CUSTOMER, UNBOUND, "aaaTemplate");
    assertion(ontology, CUSTOMER, ORDER, "zzzVisible");
    bindSharedTopic(ns, List.of(customer, order));
    return new RelatedConcepts(ontology, template, customer.getId() + ">" + order.getId());
  }

  private static void assertAnAxiomReaderSeesClustersWithoutEdges(
      final TestNamespace ns, final Ontology ontology) {
    try (var fixtures = new RdfAccessFixtures("pageAxiom" + ns.shortPrefix())) {
      final var reader = deniedReader(fixtures, "axioms", Entity.ONTOLOGY_AXIOM);
      final var page = graphPage(reader, ontology, List.of(), clusterPage(0, 12));
      assertEquals(2, page.getClusters().size());
      assertEquals(List.of(), page.getTopology().getEdges());
    }
  }

  private static void assertAPropertyReaderSeesTheEdgeWithoutItsProperty(
      final TestNamespace ns, final Ontology ontology) {
    try (var fixtures = new RdfAccessFixtures("pageProperty" + ns.shortPrefix())) {
      final var reader = deniedReader(fixtures, "properties", Entity.ONTOLOGY_PROPERTY);
      final var edges =
          graphPage(reader, ontology, List.of(), clusterPage(0, 12)).getTopology().getEdges();
      assertEquals(1, edges.size());
      assertNull(edges.getFirst().getProperty());
      assertEquals("relatesTo", edges.getFirst().getLabel());
    }
  }

  private static void assertAConceptReaderSeesNothingAndMustRefresh(
      final TestNamespace ns,
      final Ontology ontology,
      final List<NativeOntologyLoadedPrefix> loaded) {
    try (var fixtures = new RdfAccessFixtures("pageConcept" + ns.shortPrefix())) {
      final var reader = deniedReader(fixtures, "concepts", Entity.ONTOLOGY_CONCEPT);
      final var page = graphPage(reader, ontology, List.of(), clusterPage(0, 12));
      assertEquals(List.of(), page.getClusters());
      assertEquals(List.of(), page.getLoaded());
      assertEquals(List.of(), page.getTopology().getEdges());
      assertEquals(List.of(), page.getTopology().getLineageEdges());
      assertStatus(412, () -> graphPage(reader, ontology, loaded, clusterPage(0, 12)));
    }
  }

  private static NativeOntologyDataGraphPage anEmptyFirstTopologyPage(final Ontology ontology) {
    final var observed = new ScanObservation();
    final var first =
        observed.watch(() -> graphPage(admin(), ontology, List.of(), clusterPage(0, 12)));
    assertEquals(List.of(500L), observed.axiomRows());
    assertEquals(List.of(), first.getTopology().getEdges());
    assertNotNull(first.getTopology().getAfter());
    return first;
  }

  private static void assertSealed(final String cursor, final List<Table> hidden) {
    assertNotNull(cursor);
    final var decoded = new String(Base64.getUrlDecoder().decode(cursor), UTF_8);
    hidden.forEach(table -> assertFalse(decoded.contains(table.getId().toString())));
    assertFalse(decoded.contains("variant"));
    assertThrows(JsonParsingException.class, () -> JsonUtils.readTree(decoded));
  }

  private static void assertOnlyTheIssuedCursorContinues(
      final OpenMetadataClient reader,
      final Ontology ontology,
      final List<NativeOntologyLoadedPrefix> loaded,
      final String issued) {
    final var next = graphPage(reader, ontology, loaded, topologyPage(issued)).getTopology();
    assertEquals(List.of(), next.getLineageEdges());
    assertNull(next.getAfter());
    assertEquals(
        refusal(reader, ontology, loaded, randomCursor()),
        refusal(reader, ontology, loaded, tampered(issued)));
  }

  private static void assertHiddenFrom(
      final OpenMetadataClient reader,
      final Ontology ontology,
      final List<NativeOntologyLoadedPrefix> loaded,
      final Table hidden) {
    final var page = graphPage(reader, ontology, loaded, clusterPage(0, 12));
    assertEquals(List.of(), page.getClusters());
    assertEquals(List.of(), page.getTopology().getLineageEdges());
    assertFalse(JsonUtils.pojoToJson(page).contains(hidden.getName()));
  }

  private static void assertADeletedEndpointDropsTheEdge(
      final Ontology ontology,
      final List<NativeOntologyLoadedPrefix> loaded,
      final Table endpoint) {
    admin().tables().delete(endpoint.getId());
    final var page = graphPage(admin(), ontology, loaded, clusterPage(0, 12));
    assertEquals(List.of(), page.getTopology().getLineageEdges());
  }

  private static SqlQueryCounter prefixLineageRows(final List<Long> candidateRows) {
    return SqlQueryCounter.forRequests(
        Entity.getJdbi(),
        "select",
        statement -> {
          final var sql = statement.getRenderedSql().toLowerCase(Locale.ROOT);
          if (sql.contains(PREFIX_LINEAGE)) {
            statement.addCleanable(() -> candidateRows.add(statement.getMappedRows()));
            return true;
          }
          return false;
        });
  }

  private static void insertUnrelatedOutgoing(final Table source) {
    Entity.getJdbi()
        .useHandle(
            handle -> {
              final var rows = handle.prepareBatch(INSERT_RELATIONSHIP);
              for (int index = 1; index <= UNRELATED_OUTGOING; index++) {
                rows.bind("source", source.getId().toString())
                    .bind("target", new UUID(0, index).toString())
                    .bind("relation", Relationship.UPSTREAM.ordinal())
                    .bind("type", "")
                    .add();
              }
              rows.execute();
            });
  }

  private static void deleteUnrelatedOutgoing(final Table source) {
    Entity.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "DELETE FROM entity_relationship WHERE fromId = :source AND toId >= :first AND toId <= :last AND relation = :relation")
                    .bind("source", source.getId().toString())
                    .bind("first", new UUID(0, 1).toString())
                    .bind("last", new UUID(0, UNRELATED_OUTGOING).toString())
                    .bind("relation", Relationship.UPSTREAM.ordinal())
                    .execute());
  }

  /** Distinct relationship keys for one asset pair, which differ only in relationType. */
  private static void insertDuplicatePairs(final Table source, final Table target) {
    Entity.getJdbi()
        .useHandle(
            handle -> {
              final var rows = handle.prepareBatch(INSERT_RELATIONSHIP);
              for (int index = 0; index < DUPLICATE_PAIRS; index++) {
                rows.bind("source", source.getId().toString())
                    .bind("target", target.getId().toString())
                    .bind("relation", Relationship.UPSTREAM.ordinal())
                    .bind("type", "variant" + String.format("%04d", index))
                    .add();
              }
              rows.execute();
            });
  }

  private static void deleteDuplicatePairs(final Table source, final Table target) {
    Entity.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "DELETE FROM entity_relationship WHERE fromId = :source AND toId = :target AND relation = :relation")
                    .bind("source", source.getId().toString())
                    .bind("target", target.getId().toString())
                    .bind("relation", Relationship.UPSTREAM.ordinal())
                    .execute());
  }

  private record RelatedConcepts(Ontology ontology, OntologyAxiom axiom, String edge) {}
}
