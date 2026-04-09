package org.openmetadata.service.migration.utils.v1130;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
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

  private static final int BATCH_SIZE = 1000;
  private static final String FQNHASH_COL = "fqnHash";
  private static final String NAMEHASH_COL = "nameHash";

  private static final String OLD_FIELD = "owners.name.keyword";
  private static final String NEW_FIELD = "ownerName";

  public static void backfillRelationshipFqnHashes(Handle handle) {
    for (String entityType : Entity.getEntityList()) {
      try {
        backfillForEntityType(handle, entityType);
      } catch (Exception e) {
        LOG.warn("Failed to backfill FQN hashes for entity type {}: {}", entityType, e.getMessage());
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
    int offset = 0;
    int processed;
    do {
      processed = processEntityBatch(handle, tableName, hashCol, offset);
      offset += processed;
    } while (processed == BATCH_SIZE);
    LOG.info("Backfilled FQN hashes for entity type {}: {} rows", entityType, offset);
  }

  private static int processEntityBatch(Handle handle, String tableName, String hashCol, int offset) {
    String sql =
        "SELECT id, "
            + hashCol
            + " FROM "
            + tableName
            + " WHERE "
            + hashCol
            + " IS NOT NULL LIMIT :limit OFFSET :offset";
    List<Map<String, Object>> rows =
        handle.createQuery(sql).bind("limit", BATCH_SIZE).bind("offset", offset).mapToMap().list();
    for (Map<String, Object> row : rows) {
      backfillRow(handle, row, hashCol);
    }
    return rows.size();
  }

  private static void backfillRow(Handle handle, Map<String, Object> row, String hashCol) {
    Map<String, Object> normalized = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    normalized.putAll(row);
    String id = String.valueOf(normalized.get("id"));
    String fqnHash = String.valueOf(normalized.get(hashCol));
    handle
        .createUpdate(
            "UPDATE entity_relationship SET fromFQNHash = :fqnHash WHERE fromId = :id AND fromFQNHash IS NULL")
        .bind("fqnHash", fqnHash)
        .bind("id", id)
        .execute();
    handle
        .createUpdate(
            "UPDATE entity_relationship SET toFQNHash = :fqnHash WHERE toId = :id AND toFQNHash IS NULL")
        .bind("fqnHash", fqnHash)
        .bind("id", id)
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
