package org.openmetadata.service.migration.utils.v210;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
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
public class SupersetChartFqnCollisionFix {

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
    } catch (Exception e) {
      LOG.warn("Error finding Superset services: {}", e.getMessage());
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
        reindexChart(chart);
        fixedCount = 1;
      }
    } catch (Exception e) {
      LOG.warn("Error processing Chart entity {}: {}", chartId, e.getMessage());
    }
    return fixedCount;
  }

  private static void reindexChart(Chart chart) {
    try {
      Entity.getSearchRepository().updateEntityIndex(chart);
    } catch (Exception e) {
      LOG.error(
          "Chart {} FQN fixed in the database but the search index could not be refreshed; "
              + "run 'Recreate Search Indexes' to sync.",
          chart.getId(),
          e);
    }
  }

  private static boolean isPurelyNumeric(String name) {
    return name != null && name.matches("\\d+");
  }
}
