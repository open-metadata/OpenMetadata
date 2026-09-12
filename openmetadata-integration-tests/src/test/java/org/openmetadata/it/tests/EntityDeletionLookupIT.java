package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.FreshReadScope;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Counts deletion target reads and the owning commit")
class EntityDeletionLookupIT {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void deletionLoadsOnlyItsOriginalAndPostCascadeRows(final boolean hardDelete, TestNamespace ns) {
    final Chart chart = chart(ns);
    // Force row reads while leaving write-through and invalidation enabled for the warm aliases.
    try (var fresh = FreshReadScope.enter();
        var transactions = new TransactionCounter(Entity.getJdbi());
        var queries = new SqlQueryCounter(Entity.getJdbi(), "select json from chart_entity")) {
      Entity.deleteEntity("admin", Entity.CHART, chart.getId(), false, hardDelete);
      assertEquals(2, queries.count(), "Deletion needs its original and post-cascade snapshot");
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    assertMissingLiveAliases(chart);
    if (!hardDelete) {
      final Chart deleted = Entity.getEntity(Entity.CHART, chart.getId(), "", Include.ALL);
      assertTrue(deleted.getDeleted());
      assertEquals("admin", deleted.getUpdatedBy());
    }
  }

  @Test
  void missingEntityRemainsAnIdempotentDeleteWithoutAWriteTransaction() {
    SdkClients.adminClient();
    try (var fresh = FreshReadScope.enter();
        var transactions = new TransactionCounter(Entity.getJdbi());
        var queries = new SqlQueryCounter(Entity.getJdbi(), "select json from chart_entity")) {
      Entity.deleteEntity("admin", Entity.CHART, UUID.randomUUID(), false, true);
      assertEquals(1, queries.count());
      assertEquals(0, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
  }

  private Chart chart(final TestNamespace ns) {
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final Chart chart =
        SdkClients.adminClient()
            .charts()
            .create(
                new CreateChart()
                    .withName(ns.prefix("deletionLookup"))
                    .withService(service.getFullyQualifiedName()));
    Entity.getEntity(Entity.CHART, chart.getId(), "", Include.ALL);
    Entity.getEntityByName(Entity.CHART, chart.getFullyQualifiedName(), "", Include.ALL);
    return chart;
  }

  private void assertMissingLiveAliases(final Chart chart) {
    assertThrows(
        EntityNotFoundException.class,
        () -> Entity.getEntity(Entity.CHART, chart.getId(), "", Include.NON_DELETED));
    assertThrows(
        EntityNotFoundException.class,
        () ->
            Entity.getEntityByName(
                Entity.CHART, chart.getFullyQualifiedName(), "", Include.NON_DELETED));
  }
}
