package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.Charts;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Counts SQL on the version history path")
@ExtendWith(TestNamespaceExtension.class)
class EntityVersionHistoryIT {
  @Test
  void laterVersionPagesDoNotHydrateTheDiscardedCurrentVersion(TestNamespace ns) {
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final Chart chart =
        Charts.create()
            .name(ns.prefix("history"))
            .in(service.getFullyQualifiedName())
            .withDescription("Original description")
            .execute();
    final var client = SdkClients.adminClient().charts();
    for (final String description : new String[] {"First change", "Second change"}) {
      client.patch(
          chart.getId(),
          JsonUtils.readTree(
              "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"" + description + "\"}]"),
          "*");
    }
    final var repository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    RequestEntityCache.clear();

    try (var bypass = EntityCacheBypass.skip();
        var queries = new SqlQueryCounter(Entity.getJdbi(), "entity_relationship")) {
      final var page = repository.versions().page(chart.getId(), 1, 1);
      assertEquals(2, page.nextOffset());
      assertEquals(1, page.entityHistory().getVersions().size());
      final Chart snapshot =
          JsonUtils.readValue((String) page.entityHistory().getVersions().getFirst(), Chart.class);
      assertEquals(chart.getId(), snapshot.getId());
      assertEquals(0.1, snapshot.getVersion());
      assertEquals("Original description", snapshot.getDescription());
      assertEquals(0, queries.count());
    } finally {
      RequestEntityCache.clear();
    }
  }

  @Test
  void laterVersionPageForMissingEntityRetainsNotFoundError() {
    SdkClients.adminClient();
    final var repository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    assertThrows(
        EntityNotFoundException.class, () -> repository.versions().page(UUID.randomUUID(), 1, 1));
  }
}
