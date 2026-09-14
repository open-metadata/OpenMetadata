package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.util.RequestEntityCache;

@Isolated("Counts SQL on the version history path")
@ExtendWith(TestNamespaceExtension.class)
class EntityVersionHistoryIT {
  @Test
  void consolidatedDescriptionChangesDoNotRewriteUnchangedRelationships(TestNamespace ns) {
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final Chart chart =
        Charts.create()
            .name(ns.prefix("no_relationship_rewrite"))
            .in(service.getFullyQualifiedName())
            .withDescription("Original")
            .execute();
    final var client = SdkClients.adminClient().charts();
    final Chart first =
        client.patch(
            chart.getId(),
            JsonUtils.readTree(
                "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"First\"}]"));
    try (var deletes =
            SqlQueryCounter.forRequests(Entity.getJdbi(), "delete from entity_relationship");
        var inserts = SqlQueryCounter.forRequests(Entity.getJdbi(), "into entity_relationship")) {
      final Chart second =
          client.patch(
              chart.getId(),
              JsonUtils.readTree(
                  "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Second\"}]"));
      assertEquals(first.getVersion(), second.getVersion());
      assertEquals("Second", second.getDescription());
      assertEquals(0, deletes.count());
      assertEquals(0, inserts.count());
    }
  }

  @Test
  void deletedRemainingRowsProduceAnEmptyTailWithoutInvalidatingThePriorCursor(TestNamespace ns) {
    final List<Chart> charts = createHistoryCharts(ns);
    final Chart oldest = charts.getFirst();
    final long end = charts.getLast().getUpdatedAt();
    final String window =
        "/v1/charts/history?startTs=" + oldest.getUpdatedAt() + "&endTs=" + end + "&limit=2";
    final JsonNode first = historyPage(window);
    final JsonNode second =
        historyPage(window + "&after=" + first.path("paging").path("after").asText());
    assertEquals(2, first.path("data").size());
    assertEquals(2, second.path("data").size());
    assertNotNull(second.path("paging").get("before"));
    SdkClients.adminClient()
        .charts()
        .delete(oldest.getId().toString(), Map.of("recursive", "true", "hardDelete", "true"));
    final JsonNode tail =
        historyPage(window + "&after=" + second.path("paging").path("after").asText());
    assertTrue(tail.path("data").isEmpty());
    assertTrue(
        tail.path("paging").path("after").isMissingNode()
            || tail.path("paging").path("after").isNull());
    final JsonNode backward =
        historyPage(window + "&before=" + second.path("paging").path("before").asText());
    assertEquals(first.path("data"), backward.path("data"));
  }

  private List<Chart> createHistoryCharts(final TestNamespace ns) {
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    final var charts = new ArrayList<Chart>();
    for (int index = 0; index < 5; index++) {
      charts.add(
          Charts.create()
              .name(ns.prefix("cursor_" + index))
              .in(service.getFullyQualifiedName())
              .execute());
    }
    charts.sort(
        Comparator.comparing(Chart::getUpdatedAt).thenComparing(chart -> chart.getId().toString()));
    return List.copyOf(charts);
  }

  private JsonNode historyPage(final String path) {
    return JsonUtils.readTree(
        SdkClients.adminClient().getHttpClient().executeForString(HttpMethod.GET, path, null));
  }

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
