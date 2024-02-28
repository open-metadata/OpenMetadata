package org.openmetadata.service.migration.utils.v140;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import javax.json.Json;
import javax.json.JsonArray;
import javax.json.JsonArrayBuilder;
import javax.json.JsonObject;
import javax.json.JsonString;
import javax.json.JsonValue;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.PartitionColumnDetails;
import org.openmetadata.schema.type.PartitionIntervalTypes;
import org.openmetadata.schema.type.TablePartition;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.JsonUtils;
import org.postgresql.util.PGobject;

@Slf4j
public class MigrationUtil {
  private static final String MYSQL_QUERY_TABLES_WITH_PARTITION =
      "SELECT json "
          + "FROM table_entity "
          + "WHERE JSON_EXTRACT(json, '$.tablePartition') IS NOT NULL";

  private static final String POSTGRES_QUERY_TABLES_WITH_PARTITION =
      "SELECT json " + "FROM table_entity " + "WHERE json->'tablePartition' IS NOT NULL";

  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  public static void migrateTablePartition(Handle handle, CollectionDAO collectionDAO) {
    try {
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        handle
            .createQuery(MYSQL_QUERY_TABLES_WITH_PARTITION)
            .mapToMap()
            .forEach(
                row -> {
                  String jsonRow;
                  jsonRow = (String) row.get("json");
                  handleTablePartitionMigration(jsonRow, collectionDAO);
                });
        return;
      }

      handle
          .createQuery(POSTGRES_QUERY_TABLES_WITH_PARTITION)
          .mapToMap()
          .forEach(
              row -> {
                String jsonRow;
                PGobject pgObject = (PGobject) row.get("json");
                jsonRow = pgObject.getValue();
                handleTablePartitionMigration(jsonRow, collectionDAO);
              });
    } catch (Exception ex) {
      LOG.warn("Error running the query migration ", ex);
    }
  }

  private static void handleTablePartitionMigration(String jsonRow, CollectionDAO collectionDAO) {
    JsonObject jsonObj = JsonUtils.readJson(jsonRow).asJsonObject();

    // We need to pop the tablePartition from the json before serializing it
    JsonObject tablePartition = jsonObj.getJsonObject("tablePartition");

    // Remove the tablePartition from the json. We need to convert it to a map to remove the key
    // as JsonObject is immutable
    HashMap<String, Object> jsonMap = JsonUtils.readValue(jsonObj.toString(), HashMap.class);
    jsonMap.remove("tablePartition");

    jsonObj = JsonUtils.readJson(JsonUtils.pojoToJson(jsonMap)).asJsonObject();

    Table table = JsonUtils.readValue(jsonObj.toString(), Table.class);

    JsonArray partitionColumns = tablePartition.getJsonArray("columns");
    if (tablePartition.isEmpty()) {
      LOG.info("Table {} does not have partition details", table.getId());
      return;
    }

    List<PartitionColumnDetails> partitionColumnDetails = new ArrayList<PartitionColumnDetails>();

    if ((partitionColumns == null || partitionColumns.isEmpty())
        && table.getServiceType() == CreateDatabaseService.DatabaseServiceType.BigQuery) {
      // BigQuery tables have pseudo columns for partitioning that were not being set in the
      // partitionColumns entity
      String interval = tablePartition.getString("interval");
      if (interval != null) {
        JsonArrayBuilder jsonArrayBuilder = Json.createArrayBuilder();
        switch (interval) {
          case "HOUR" -> partitionColumns = jsonArrayBuilder.add("_PARTITIONTIME").build();
          case "DAY" -> partitionColumns = jsonArrayBuilder.add("_PARTITIONDATE").build();
        }
      }
      ;
    }

    if (partitionColumns == null || partitionColumns.isEmpty()) {
      throw new RuntimeException(
          "tablePartition is not null but not column partition was defined for table "
              + table.getId());
    }

    for (JsonValue column : partitionColumns) {
      PartitionColumnDetails partitionColumnDetail = new PartitionColumnDetails();
      partitionColumnDetail.setColumnName(((JsonString) column).getString());
      String intervalType = tablePartition.getString("intervalType");
      if (intervalType != null) {
        partitionColumnDetail.setIntervalType(PartitionIntervalTypes.fromValue(intervalType));
      }
      partitionColumnDetail.setInterval(tablePartition.getString("interval"));
      partitionColumnDetails.add(partitionColumnDetail);
    }

    table.withTablePartition(new TablePartition().withColumns(partitionColumnDetails));

    collectionDAO.tableDAO().update(table);
  }
}
