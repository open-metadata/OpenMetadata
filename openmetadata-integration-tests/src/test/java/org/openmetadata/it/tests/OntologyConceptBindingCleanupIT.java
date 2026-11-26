package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.insertMissingBindings;
import static org.openmetadata.it.tests.NativeOntologyGraphScanProbe.shift;
import static org.openmetadata.it.tests.OntologyBindingFixtures.CUSTOMER;
import static org.openmetadata.it.tests.OntologyBindingFixtures.admin;
import static org.openmetadata.it.tests.OntologyBindingFixtures.assertStatus;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bind;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindAll;
import static org.openmetadata.it.tests.OntologyBindingFixtures.bindings;
import static org.openmetadata.it.tests.OntologyBindingFixtures.column;
import static org.openmetadata.it.tests.OntologyBindingFixtures.dataProperty;
import static org.openmetadata.it.tests.OntologyBindingFixtures.tables;
import static org.openmetadata.it.tests.OntologyBindingFixtures.wideTableAsset;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.tests.NativeOntologyGraphScanProbe.ScanObservation;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;

/**
 * A successful binding write removes the concept's links to deleted and missing assets one page
 * of rows at a time, and the column capacity check counts every surviving page.
 */
@Isolated("Counts SQL statements while a binding write cleans dead rows")
@ExtendWith(TestNamespaceExtension.class)
class OntologyConceptBindingCleanupIT extends BaseOntologyApprovalIT {
  private static final int PAGE = 500;

  @Test
  void aWriteCleansDeadRowsOnePageAtATime(final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Seeds rows and counts the embedded server's SQL");
    final var ontology = createOntology(ns, "pagedCleanup");
    final var concept = declareClass(ontology, "Customer", CUSTOMER);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var bound =
        tables(ns, schema, 3).stream()
            .sorted(Comparator.comparing(table -> table.getId().toString()))
            .toList();
    final var first = bound.getFirst();
    final var middle = bound.get(1);
    final var last = bound.getLast();
    bindAll(concept, bound);
    admin().tables().delete(middle.getId());
    final var written = tables(ns, schema, 1).getFirst();
    try {
      assertTrue(shift(first.getId(), PAGE).toString().compareTo(middle.getId().toString()) < 0);
      insertMissingBindings(concept, first.getId(), PAGE);

      final var observed = new ScanObservation();
      observed.run(() -> bind(concept, written, List.of(), 3L));

      assertEquals(List.of(0L, 500L, 3L, 3L), observed.bindingRows());
      observed.assertBounded();
      assertEquals(Set.of(first.getId(), last.getId(), written.getId()), storedAssetIds(concept));
    } finally {
      Entity.getCollectionDAO().ontologyConceptBindingDAO().deleteConcept(concept.getId());
    }
  }

  @Test
  void capacityCountsSurvivingAssignmentsAcrossCleanupPages(final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Seeds rows and counts the embedded server's SQL");
    final var ontology = createOntology(ns, "pagedCapacity");
    final var concept = declareClass(ontology, "Customer", CUSTOMER);
    final var property = dataProperty(ontology, concept);
    final var schema = DatabaseSchemaTestFactory.createSimple(ns).getFullyQualifiedName();
    final var wide = new ArrayList<OntologyAssetBinding>();
    for (int index = 0; index < 5; index++) {
      wide.add(wideTableAsset(ns, schema, property));
      bind(concept, wide.getLast(), index);
    }
    final var narrow = tables(ns, schema, 1).getFirst();
    try {
      insertMissingBindings(concept, new UUID(0, 0), PAGE);
      assertStatus(400, () -> bind(concept, narrow, List.of(column(property)), 5L));
      admin().tables().delete(wide.get(2).getAssetId());

      final var observed = new ScanObservation();
      observed.run(() -> bind(concept, narrow, List.of(column(property)), 5L));

      assertEquals(List.of(0L, 500L, 5L, 5L), observed.bindingRows());
      observed.assertBounded();
      final var saved = bindings(concept, "?limit=100");
      assertEquals(6L, saved.getRevision());
      assertEquals(
          401, saved.getAssets().stream().mapToInt(asset -> asset.getColumns().size()).sum());
      assertEquals(
          Set.of(
              wide.get(0).getAssetId(),
              wide.get(1).getAssetId(),
              wide.get(3).getAssetId(),
              wide.get(4).getAssetId(),
              narrow.getId()),
          storedAssetIds(concept));
    } finally {
      Entity.getCollectionDAO().ontologyConceptBindingDAO().deleteConcept(concept.getId());
    }
  }

  private static Set<UUID> storedAssetIds(final OntologyConcept concept) {
    return Entity.getCollectionDAO()
        .ontologyConceptBindingDAO()
        .listAfter(concept.getId(), "", 1000)
        .stream()
        .map(BindingRow::assetId)
        .collect(Collectors.toSet());
  }
}
