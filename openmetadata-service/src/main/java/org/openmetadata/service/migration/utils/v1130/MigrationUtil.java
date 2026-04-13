package org.openmetadata.service.migration.utils.v1130;

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  private static final String FQNHASH_COL = "fqnHash";
  private static final String NAMEHASH_COL = "nameHash";

  private static final String OLD_FIELD = "owners.name.keyword";
  private static final String NEW_FIELD = "ownerName";

  /**
   * Backfills fromFQNHash and toFQNHash in entity_relationship for all registered entity types.
   * Uses a direct correlated-subquery UPDATE (one per direction per entity type) to avoid
   * LIMIT/OFFSET pagination ordering bugs that could silently skip rows.
   */
  public static void backfillRelationshipFqnHashes(Handle handle) {
    for (String entityType : Entity.getEntityList()) {
      try {
        backfillForEntityType(handle, entityType);
      } catch (Exception e) {
        LOG.warn(
            "Failed to backfill FQN hashes for entity type {}: {}", entityType, e.getMessage());
      }
    }
  }

  private static void backfillForEntityType(Handle handle, String entityType) {
    EntityRepository<?> repo = Entity.getEntityRepository(entityType);
    String hashCol = repo.getDao().getNameHashColumn();
    if (!FQNHASH_COL.equals(hashCol) && !NAMEHASH_COL.equals(hashCol)) {
      return;
    }
    String tableName = repo.getDao().getTableName();
    int fromUpdated = updateFromHashes(handle, entityType, tableName, hashCol);
    int toUpdated = updateToHashes(handle, entityType, tableName, hashCol);
    if (fromUpdated + toUpdated > 0) {
      LOG.info(
          "Backfilled FQN hashes for entity type {}: {} fromFQNHash, {} toFQNHash",
          entityType,
          fromUpdated,
          toUpdated);
    }
  }

  private static int updateFromHashes(
      Handle handle, String entityType, String tableName, String hashCol) {
    return handle
        .createUpdate(
            "UPDATE entity_relationship SET fromFQNHash = ("
                + "SELECT CAST(t."
                + hashCol
                + " AS CHAR(768)) FROM "
                + tableName
                + " t WHERE CAST(t.id AS CHAR(36)) = entity_relationship.fromId"
                + ") WHERE fromEntity = :entityType AND fromFQNHash IS NULL")
        .bind("entityType", entityType)
        .execute();
  }

  private static int updateToHashes(
      Handle handle, String entityType, String tableName, String hashCol) {
    return handle
        .createUpdate(
            "UPDATE entity_relationship SET toFQNHash = ("
                + "SELECT CAST(t."
                + hashCol
                + " AS CHAR(768)) FROM "
                + tableName
                + " t WHERE CAST(t.id AS CHAR(36)) = entity_relationship.toId"
                + ") WHERE toEntity = :entityType AND toFQNHash IS NULL")
        .bind("entityType", entityType)
        .execute();
  }

  public static void updateOwnerChartFormulas() {
    DataInsightSystemChartRepository repository = new DataInsightSystemChartRepository();
    String[] chartNames = {
      "percentage_of_data_asset_with_owner",
      "percentage_of_service_with_owner",
      "data_assets_with_owner_summary_card",
      "percentage_of_data_asset_with_owner_kpi",
      "number_of_data_asset_with_owner_kpi",
      "assets_with_owners",
      "assets_with_owner_live"
    };

    for (String chartName : chartNames) {
      try {
        DataInsightCustomChart chart =
            repository.getByName(null, chartName, EntityUtil.Fields.EMPTY_FIELDS);
        String json = org.openmetadata.schema.utils.JsonUtils.pojoToJson(chart.getChartDetails());
        if (json.contains(OLD_FIELD)) {
          String updatedJson = json.replace(OLD_FIELD, NEW_FIELD);
          Object updatedDetails =
              org.openmetadata.schema.utils.JsonUtils.readValue(
                  updatedJson, chart.getChartDetails().getClass());
          chart.setChartDetails(updatedDetails);
          repository.prepareInternal(chart, false);
          repository.getDao().update(chart);
          LOG.info(
              "Updated chart formula for '{}': replaced '{}' with '{}'",
              chartName,
              OLD_FIELD,
              NEW_FIELD);
        }
      } catch (Exception ex) {
        LOG.warn("Could not update chart '{}': {}", chartName, ex.getMessage());
      }
    }
  }
}
