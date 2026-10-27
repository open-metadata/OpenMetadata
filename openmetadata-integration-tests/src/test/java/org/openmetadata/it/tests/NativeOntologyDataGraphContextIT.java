package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.bindingsPage;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.clusterPage;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.conceptEdges;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.conceptIds;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.deniedReader;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.edge;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.graphPage;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.loadAllClusters;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.prefix;
import static org.openmetadata.it.tests.NativeOntologyPageFixtures.sortedTables;
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
import static org.openmetadata.it.tests.OntologyBindingFixtures.graph;
import static org.openmetadata.it.tests.OntologyBindingFixtures.lineage;
import static org.openmetadata.it.tests.OntologyBindingFixtures.objectProperty;
import static org.openmetadata.it.tests.OntologyBindingFixtures.tables;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.NativeOntologyDataGraphPage;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/** {@code POST /dataGraph/pages}: the loaded context that cluster and binding pages grow. */
@Isolated("Counts SQL statements while serving the native data graph over HTTP")
@ExtendWith(TestNamespaceExtension.class)
class NativeOntologyDataGraphContextIT extends BaseOntologyApprovalIT {
  private static final int TABLE_ONLY_RANK = 57;

  @Test
  void combinedPagesJoinPreviouslyLoadedClustersAndLaterAssets(final TestNamespace ns) {
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var combined = combinedGraph(ns, schema);
    final var ontology = combined.ontology();
    final var first = graphPage(admin(), ontology, List.of(), clusterPage(0, 1));
    assertEquals(List.of(combined.customer().getId()), conceptIds(first.getLoaded()));
    assertEquals(List.of(), first.getTopology().getEdges());
    final var second = graphPage(admin(), ontology, first.getLoaded(), clusterPage(1, 1));
    assertEquals(combined.bothDirections(), Set.copyOf(conceptEdges(second)));
    assertEquals(combined.lineageThrough(1), Set.copyOf(second.getTopology().getLineageEdges()));
    final var last = assertLaterAssetsJoinTheLoadedClusters(combined, first, second);
    assertEquals(List.of(), graph(admin(), ontology, "?limit=1&offset=1").getEdges());
    assertAForeignOrStaleContextIsRefused(
        ns, schema, combined, second.getLoaded(), last.getLoaded());
  }

  @Test
  void aForgedHighWaterMarkCannotProbeWhetherAHiddenAssetIsBound(final TestNamespace ns) {
    final var ontology = createOntology(ns, "forgedMark");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var pair = tables(ns, schema, 2);
    bind(customer, pair.getFirst(), List.of(), 0L);
    final long revision = bindings(customer, "").getRevision();
    final var marks = List.of(pair.getFirst().getId(), pair.getLast().getId(), UUID.randomUUID());
    try (var fixtures = new RdfAccessFixtures("forged" + ns.shortPrefix())) {
      final var reader = deniedReader(fixtures, "reader", Entity.TABLE);
      for (final var mark : marks) {
        final var probe = List.of(prefix(customer, revision, mark));
        assertNothingShown(graphPage(reader, ontology, probe, clusterPage(0, 12)));
      }
      final var random = List.of(prefix(customer, revision, UUID.randomUUID()));
      assertEquals(
          List.of(), graphPage(admin(), ontology, random, clusterPage(0, 12)).getClusters());
    }
  }

  @Test
  void sixtyOneConceptsStopAdvertisingClusterOffsetsOnceTheContextIsFull(final TestNamespace ns) {
    final var ontology = createOntology(ns, "fullContext");
    final var concepts = declareConcepts(ontology, "FullConcept", 61);
    bindSharedTopic(ns, concepts);
    final var walk = loadEveryClusterPage(ontology);
    assertEquals(Arrays.asList(12, 24, 36, 48, null), walk.advertised());
    assertTrue(walk.last().getContextFull());
    assertEquals(60, walk.last().getLoaded().size());
    assertEquals(
        concepts.subList(0, 60).stream().map(OntologyConcept::getId).toList(), walk.seen());
    final var beyond = graphPage(admin(), ontology, walk.last().getLoaded(), clusterPage(60, 12));
    assertEquals(List.of(), beyond.getClusters());
    assertNull(beyond.getNextClusterOffset());
    assertTrue(beyond.getContextFull());
    assertEquals(60, beyond.getLoaded().size());
  }

  @Test
  void aClampedClusterPageAdvertisesTheOffsetAfterItsClampedRanks(final TestNamespace ns) {
    final var ontology = createOntology(ns, "clampedContext");
    final var concepts = declareConcepts(ontology, "ClampConcept", 62);
    final var topicBound = new ArrayList<>(concepts);
    final var tableOnly = topicBound.remove(TABLE_ONLY_RANK);
    bindSharedTopic(ns, topicBound);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    bind(tableOnly, tables(ns, schema, 1).getFirst(), List.of(), 0L);
    try (var fixtures = new RdfAccessFixtures("clamped" + ns.shortPrefix())) {
      final var reader = deniedReader(fixtures, "reader", Entity.TABLE);
      final var loaded = loadInPagesOfEleven(reader, ontology, 55);
      final var clamped = graphPage(reader, ontology, loaded, clusterPage(55, 12));
      assertEquals(ranks(concepts, 55, 56, 58, 59), clusterIds(clamped));
      assertEquals(59, clamped.getLoaded().size());
      assertEquals(60, clamped.getNextClusterOffset());
      final var next = graphPage(reader, ontology, clamped.getLoaded(), clusterPage(60, 12));
      assertEquals(ranks(concepts, 60), clusterIds(next));
      assertTrue(next.getContextFull());
    }
  }

  @Test
  void loadedContextReadsDoNotGrowWithConceptsOrAssets(final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final var service = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
    final var narrow = NativeOntologyDataGraphIT.boundOntology(ns, "pageNarrow", 4, 1, service);
    final var wide = NativeOntologyDataGraphIT.boundOntology(ns, "pageWide", 40, 2, service);
    try (var fixtures = new RdfAccessFixtures("pageBudget" + ns.shortPrefix())) {
      final var reader = deniedReader(fixtures, "reader", Entity.TABLE);
      for (final var client : List.of(admin(), reader)) {
        assertLoadedContextReadsDoNotGrow(client, narrow, wide);
      }
    }
  }

  private static CombinedGraph combinedGraph(final TestNamespace ns, final String schema) {
    final var ontology = createOntology(ns, "combinedPages");
    final var customer = declareClass(ontology, "Customer", CUSTOMER);
    final var order = declareClass(ontology, "Order", ORDER);
    final var unrelated = declareClass(ontology, "Unrelated", INVOICE);
    objectProperty(ontology, "Relates to");
    assertion(ontology, CUSTOMER, ORDER);
    assertion(ontology, ORDER, CUSTOMER);
    final var combined =
        new CombinedGraph(
            ontology, customer, order, sortedTables(ns, schema, 6), sortedTables(ns, schema, 6));
    bindAll(customer, combined.customerTables());
    bindAll(order, combined.orderTables());
    bindAll(unrelated, tables(ns, schema, 1));
    combined.connect();
    return combined;
  }

  /** Loading one more asset of each loaded concept adds the lineage that asset takes part in. */
  private static NativeOntologyDataGraphPage assertLaterAssetsJoinTheLoadedClusters(
      final CombinedGraph combined,
      final NativeOntologyDataGraphPage first,
      final NativeOntologyDataGraphPage second) {
    final var customerPage = moreBindings(combined.ontology(), second, 0, first);
    assertEquals(List.of(combined.customerTables().get(4).getId()), assetIds(customerPage));
    assertEquals(
        combined.lineageThrough(3), Set.copyOf(customerPage.getTopology().getLineageEdges()));
    final var orderPage = moreBindings(combined.ontology(), customerPage, 1, second);
    assertEquals(combined.lineageThrough(4), Set.copyOf(orderPage.getTopology().getLineageEdges()));
    assertEquals(2, orderPage.getTopology().getEdges().size());
    assertNull(orderPage.getTopology().getAfter());
    return orderPage;
  }

  private static void assertAForeignOrStaleContextIsRefused(
      final TestNamespace ns,
      final String schema,
      final CombinedGraph combined,
      final List<NativeOntologyLoadedPrefix> earlier,
      final List<NativeOntologyLoadedPrefix> latest) {
    final var foreign = createOntology(ns, "foreignContext");
    assertStatus(400, () -> graphPage(admin(), foreign, earlier, clusterPage(0, 1)));
    bind(combined.customer(), tables(ns, schema, 1).getFirst(), List.of(), 6L);
    assertStatus(412, () -> graphPage(admin(), combined.ontology(), latest, clusterPage(0, 1)));
  }

  /** The next binding page of the loaded concept at {@code index}, after the cluster it showed. */
  private static NativeOntologyDataGraphPage moreBindings(
      final Ontology ontology,
      final NativeOntologyDataGraphPage current,
      final int index,
      final NativeOntologyDataGraphPage shown) {
    final var loaded = current.getLoaded();
    final var after = shown.getClusters().getFirst().getAfter();
    return graphPage(admin(), ontology, loaded, bindingsPage(loaded.get(index), 1, after));
  }

  private static List<UUID> assetIds(final NativeOntologyDataGraphPage page) {
    return page.getBindings().getAssets().stream().map(asset -> asset.getAssetId()).toList();
  }

  private static void assertNothingShown(final NativeOntologyDataGraphPage probe) {
    assertEquals(List.of(), probe.getClusters());
    assertEquals(List.of(), probe.getTopology().getEdges());
    assertEquals(List.of(), probe.getTopology().getLineageEdges());
    assertNull(probe.getTopology().getAfter());
  }

  /** Concepts named {@code name00}, {@code name01} and so on, which rank in that order. */
  private static List<OntologyConcept> declareConcepts(
      final Ontology ontology, final String name, final int count) {
    final var concepts = new ArrayList<OntologyConcept>();
    for (int index = 0; index < count; index++) {
      final var iri = URI.create(ontology.getNamespace() + name + index);
      concepts.add(declareClass(ontology, "%s%02d".formatted(name, index), iri));
    }
    return concepts;
  }

  private static ClusterWalk loadEveryClusterPage(final Ontology ontology) {
    List<NativeOntologyLoadedPrefix> loaded = List.of();
    final var seen = new ArrayList<UUID>();
    final var advertised = new ArrayList<Integer>();
    NativeOntologyDataGraphPage page;
    Integer offset = 0;
    do {
      page = graphPage(admin(), ontology, loaded, clusterPage(offset, 12));
      page.getClusters().forEach(cluster -> seen.add(cluster.getConcept().getId()));
      loaded = page.getLoaded();
      offset = page.getNextClusterOffset();
      advertised.add(offset);
      if (offset != null) {
        assertFalse(page.getContextFull());
      }
    } while (offset != null);
    return new ClusterWalk(seen, advertised, page);
  }

  /** Loads the first {@code count} ranks in pages of eleven, so no page is clamped. */
  private static List<NativeOntologyLoadedPrefix> loadInPagesOfEleven(
      final OpenMetadataClient reader, final Ontology ontology, final int count) {
    List<NativeOntologyLoadedPrefix> loaded = List.of();
    for (int offset = 0; offset < count; offset += 11) {
      loaded = graphPage(reader, ontology, loaded, clusterPage(offset, 11)).getLoaded();
    }
    assertEquals(count, loaded.size());
    return loaded;
  }

  private static List<UUID> ranks(final List<OntologyConcept> concepts, final int... ranks) {
    return IntStream.of(ranks).mapToObj(rank -> concepts.get(rank).getId()).toList();
  }

  private static List<UUID> clusterIds(final NativeOntologyDataGraphPage page) {
    return page.getClusters().stream().map(cluster -> cluster.getConcept().getId()).toList();
  }

  private static void assertLoadedContextReadsDoNotGrow(
      final OpenMetadataClient client, final Ontology narrow, final Ontology wide) {
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

  /** Customer and Order relate both ways, and four lineage edges join their sorted tables. */
  private record CombinedGraph(
      Ontology ontology,
      OntologyConcept customer,
      OntologyConcept order,
      List<Table> customerTables,
      List<Table> orderTables) {
    void connect() {
      lineage(customerTables.getFirst(), orderTables.getFirst());
      lineage(customerTables.get(4), orderTables.getFirst());
      lineage(orderTables.getFirst(), customerTables.get(4));
      lineage(customerTables.get(4), orderTables.get(4));
    }

    /** The first {@code count} lineage edges, in the order {@link #connect} adds them. */
    Set<Edge> lineageThrough(final int count) {
      return Set.copyOf(
          List.of(
                  edge(customerTables.getFirst(), orderTables.getFirst()),
                  edge(customerTables.get(4), orderTables.getFirst()),
                  edge(orderTables.getFirst(), customerTables.get(4)),
                  edge(customerTables.get(4), orderTables.get(4)))
              .subList(0, count));
    }

    Set<String> bothDirections() {
      return Set.of(customer.getId() + ">" + order.getId(), order.getId() + ">" + customer.getId());
    }
  }

  private record ClusterWalk(
      List<UUID> seen, List<Integer> advertised, NativeOntologyDataGraphPage last) {}
}
