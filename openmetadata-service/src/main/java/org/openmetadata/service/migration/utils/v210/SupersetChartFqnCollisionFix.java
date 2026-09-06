package org.openmetadata.service.migration.utils.v210;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DashboardRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Migration to fix FQN collisions between Superset Dashboard and Chart entities.
 *
 * <p>Superset uses independent auto-increment ID sequences for dashboards and charts, so a
 * Dashboard and a Chart can end up with the same numeric ID and therefore the same
 * fullyQualifiedName (e.g. "superset.1"). The ingestion connector now names new charts
 * "chart_&lt;id&gt;" to avoid this; this migration renames existing chart entities from their old
 * bare-numeric name to the prefixed form so already-ingested installs are repaired without
 * requiring re-ingestion.
 */
@Slf4j
public final class SupersetChartFqnCollisionFix {

  private static final String GET_SUPERSET_SERVICES =
      "SELECT id FROM dashboard_service_entity WHERE serviceType = 'Superset'";

  private SupersetChartFqnCollisionFix() {}

  public static void fixSupersetChartFqnCollision(Handle handle, CollectionDAO collectionDAO) {
    LOG.info("Starting migration to fix Superset chart/dashboard FQN collisions");

    Set<UUID> serviceIds = findSupersetServiceIds(handle);
    if (serviceIds.isEmpty()) {
      LOG.info("No Superset services found. Skipping.");
      return;
    }
    LOG.info("Found {} Superset service(s) to check", serviceIds.size());

    int fixedCount = 0;
    for (UUID serviceId : serviceIds) {
      fixedCount += fixChartsForService(collectionDAO, serviceId);
    }

    LOG.info("Fixed {} Superset chart entities with FQN collisions", fixedCount);
  }

  private static Set<UUID> findSupersetServiceIds(Handle handle) {
    Set<UUID> serviceIds = new HashSet<>();
    try {
      List<Map<String, Object>> rows = handle.createQuery(GET_SUPERSET_SERVICES).mapToMap().list();
      for (Map<String, Object> row : rows) {
        Object idObj = row.get("id");
        if (idObj != null) {
          serviceIds.add(UUID.fromString(idObj.toString()));
        }
      }
    } catch (RuntimeException e) {
      LOG.warn("Error finding Superset services", e);
    }
    return serviceIds;
  }

  private static int fixChartsForService(CollectionDAO collectionDAO, UUID serviceId) {
    var service = collectionDAO.dashboardServiceDAO().findEntityById(serviceId);
    int fixedCount = 0;
    if (service != null) {
      String serviceFqn = service.getFullyQualifiedName();
      List<CollectionDAO.EntityRelationshipRecord> records =
          collectionDAO
              .relationshipDAO()
              .findTo(
                  serviceId,
                  Entity.DASHBOARD_SERVICE,
                  Relationship.CONTAINS.ordinal(),
                  Entity.CHART);
      for (CollectionDAO.EntityRelationshipRecord record : records) {
        fixedCount += fixChart(collectionDAO, record.getId(), serviceFqn);
      }
    }
    return fixedCount;
  }

  private static int fixChart(CollectionDAO collectionDAO, UUID chartId, String serviceFqn) {
    int fixedCount = 0;
    try {
      Chart chart = collectionDAO.chartDAO().findEntityById(chartId);
      if (chart != null && isPurelyNumeric(chart.getName())) {
        String newName = "chart_" + chart.getName();
        String newFqn = FullyQualifiedName.add(serviceFqn, newName);
        LOG.debug("Fixing Chart FQN: {} -> {}", chart.getFullyQualifiedName(), newFqn);
        chart.setName(newName);
        chart.setFullyQualifiedName(newFqn);
        collectionDAO.chartDAO().update(chart);
        reindexChart(chartId);
        reindexParentDashboards(collectionDAO, chartId);
        fixedCount = 1;
      }
    } catch (RuntimeException e) {
      LOG.warn("Error processing Chart entity {}", chartId, e);
    }
    return fixedCount;
  }

  /**
   * Re-fetches the chart through its repository (not the raw DAO) so relationship fields like
   * "dashboards" -- which Chart's own search-index document embeds -- are populated before
   * reindexing. Reindexing a bare DAO-fetched entity would serialize those fields as null,
   * blanking them out in the existing search document instead of just leaving them stale.
   */
  private static void reindexChart(UUID chartId) {
    try {
      ChartRepository chartRepository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
      Chart chart = chartRepository.get(null, chartId, chartRepository.getFields("dashboards"));
      Entity.getSearchRepository().updateEntityIndex(chart);
    } catch (RuntimeException e) {
      LOG.error(
          "Chart {} FQN fixed in the database but the search index could not be refreshed; "
              + "run 'Recreate Search Indexes' to sync.",
          chartId,
          e);
    }
  }

  /**
   * A Dashboard's own search-index document embeds a denormalized copy of its charts' id/name
   * (see DashboardIndex's "charts" field, searchable via "charts.name"). Renaming a chart via
   * this migration's raw DB update bypasses the normal EntityRepository update flow that would
   * otherwise cascade this reindex automatically, so every parent Dashboard needs a manual nudge
   * too -- otherwise its search document keeps showing the chart's old, pre-fix name.
   */
  private static void reindexParentDashboards(CollectionDAO collectionDAO, UUID chartId) {
    List<CollectionDAO.EntityRelationshipRecord> dashboards =
        collectionDAO
            .relationshipDAO()
            .findFrom(chartId, Entity.CHART, Relationship.CONTAINS.ordinal(), Entity.DASHBOARD);
    for (CollectionDAO.EntityRelationshipRecord record : dashboards) {
      reindexDashboard(chartId, record.getId());
    }
  }

  /** Same "fetch through the repository with the right fields" reasoning as reindexChart. */
  private static void reindexDashboard(UUID chartId, UUID dashboardId) {
    try {
      DashboardRepository dashboardRepository =
          (DashboardRepository) Entity.getEntityRepository(Entity.DASHBOARD);
      Dashboard dashboard =
          dashboardRepository.get(null, dashboardId, dashboardRepository.getFields("charts"));
      Entity.getSearchRepository().updateEntityIndex(dashboard);
    } catch (RuntimeException e) {
      LOG.error(
          "Chart {} was renamed but parent Dashboard {} search index could not be refreshed; "
              + "run 'Recreate Search Indexes' to sync.",
          chartId,
          dashboardId,
          e);
    }
  }

  private static boolean isPurelyNumeric(String name) {
    return name != null && name.matches("\\d+");
  }
}
