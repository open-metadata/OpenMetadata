package org.openmetadata.service.migration.utils.v1912;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class MigrationUtil {

  public static void removeConstraintsWithReferredColumnsFromTableJson(
      Handle handle, boolean postgresql) {
    LOG.info(
        "Starting migration to remove table constraints with referredColumns from table_entity JSON");
    final int batchSize = 1000;
    int offset = 0;
    int totalUpdated = 0;

    String fetchQuery =
        "SELECT id, json FROM table_entity "
            + "WHERE JSON_LENGTH(JSON_EXTRACT(json, '$.tableConstraints')) > 0 "
            + "LIMIT :limit OFFSET :offset";

    String updateQuery = "UPDATE table_entity SET json = :json WHERE id = :id";

    if (postgresql) {
      fetchQuery =
          "SELECT id, json FROM table_entity "
              + "WHERE jsonb_typeof(json->'tableConstraints') = 'array' "
              + "AND jsonb_array_length(json->'tableConstraints') > 0 "
              + "LIMIT :limit OFFSET :offset";
    }

    while (true) {
      List<Map<String, Object>> tables =
          handle
              .createQuery(fetchQuery)
              .bind("limit", batchSize)
              .bind("offset", offset)
              .mapToMap()
              .list();

      if (tables.isEmpty()) {
        break;
      }

      for (Map<String, Object> tableRow : tables) {
        String tableId = (String) tableRow.get("id");
        String json = tableRow.get("json").toString();
        try {
          Table table = JsonUtils.readValue(json, Table.class);
          List<TableConstraint> originalConstraints = table.getTableConstraints();

          if (!nullOrEmpty(originalConstraints)) {
            List<TableConstraint> filteredConstraints = new ArrayList<>();
            boolean hasReferredColumns = false;

            for (TableConstraint constraint : originalConstraints) {
              if (nullOrEmpty(constraint.getReferredColumns())) {
                filteredConstraints.add(constraint);
              } else {
                hasReferredColumns = true;
              }
            }

            if (hasReferredColumns) {
              table.setTableConstraints(filteredConstraints);
              String updatedJson = JsonUtils.pojoToJson(table);
              handle
                  .createUpdate(updateQuery)
                  .bind("id", tableId)
                  .bind("json", updatedJson)
                  .execute();
              totalUpdated++;
              LOG.debug("Updated table {} to remove constraints with referredColumns", tableId);
            }
          }
        } catch (Exception e) {
          LOG.error("Error processing table ID '{}': {}", tableId, e.getMessage(), e);
        }
      }

      offset += batchSize;
      LOG.debug("Processed tables up to offset {}", offset);
    }

    LOG.info(
        "Completed migration: {} tables updated to remove constraints with referredColumns from JSON",
        totalUpdated);
  }
}
