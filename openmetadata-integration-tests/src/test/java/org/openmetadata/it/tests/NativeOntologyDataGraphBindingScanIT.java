package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.assertInvisibleBindingRows;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.insertMissingBindings;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.shift;
import static org.openmetadata.it.tests.OntologyBindingFixtures.CUSTOMER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.ORDER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.admin;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertStatus;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bind;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindings;
import static org.openmetadata.it.tests.OntologyBindingFixtures.graph;
import static org.openmetadata.it.tests.OntologyBindingFixtures.ownerReader;
import static org.openmetadata.it.tests.OntologyBindingFixtures.readerReference;
import static org.openmetadata.it.tests.OntologyBindingFixtures.topicAsset;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.tests.NativeOntologyGraphScanProbe.ScanObservation;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyHydratedAssetBinding;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

/** The binding scan behind the data graph's clusters: exact counts, cursors, page boundaries. */
@Isolated("Counts SQL statements while serving the native data graph over HTTP")
@ExtendWith(TestNamespaceExtension.class)
class NativeOntologyDataGraphBindingScanIT extends BaseOntologyApprovalIT {
  @Test
  void exactVisibleCountAndPreviewCursorSurviveMoreThanOneBindingPage(final TestNamespace ns) {
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
        bind(concept, topicAsset(topic), index);
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
      final var graph = observed.watch(() -> graph(reader, ontology, "?assetsPerConcept=4"));
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
      assertEquals(List.of(500L, 500L, 500L, 500L, 500L, 500L, 18L), observed.bindingRows());
      assertEquals(500, observed.largestInList());
      observed.assertBounded();
    } finally {
      Entity.getCollectionDAO().ontologyConceptBindingDAO().deleteConcept(concept.getId());
    }
  }

  @Test
  void emptyAndFullBindingPagesKeepExactCountsWithoutVisibleClusters(final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts exact embedded binding page boundaries");
    final var ontology = createOntology(ns, "bindingBoundaries");
    final var concept = declareClass(ontology, "Customer", CUSTOMER);
    final var empty = new ScanObservation();
    assertEquals(List.of(), empty.watch(() -> graph(admin(), ontology, "")).getClusters());
    assertEquals(List.of(), empty.bindingRows());
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
  void bindingKeysetsAdvanceAcrossConceptsSharingTheSameAsset(final TestNamespace ns) {
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
      final var graph = observed.watch(() -> graph(admin(), ontology, ""));
      assertEquals(
          concepts.stream().map(OntologyConcept::getId).toList(),
          graph.getClusters().stream().map(cluster -> cluster.getConcept().getId()).toList());
      for (final var cluster : graph.getClusters()) {
        assertEquals(1, cluster.getAssetCount());
        assertEquals(topic.getId(), cluster.getAssets().getFirst().getAsset().getId());
        assertNull(cluster.getAfter());
      }
      assertEquals(List.of(500L, 1L), observed.bindingRows());
      observed.assertBounded();
    } finally {
      concepts.forEach(
          concept ->
              Entity.getCollectionDAO().ontologyConceptBindingDAO().deleteConcept(concept.getId()));
    }
  }
}
