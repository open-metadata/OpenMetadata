package org.openmetadata.service.migration.utils.v140;

import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.json.JSONArray;
import org.json.JSONObject;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.type.PartitionColumnDetails;
import org.openmetadata.schema.type.PartitionIntervalTypes;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TablePartition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.postgresql.util.PGobject;

@Slf4j
public class MigrationUtil {
  private static final String MYSQL_QUERY_TABLES_WITH_PARTITION =
      "SELECT json "
          + "FROM table_entity "
          + "WHERE JSON_EXTRACT(json, '$.tablePartition') IS NOT NULL";

  private static final String POSTGRES_QUERY_TABLES_WITH_PARTITION =
      "SELECT json " + "FROM table_entity " + "WHERE json->'tablePartition' IS NOT NULL";

  private static final String TEST_CASE_RESOLUTION_QUERY =
      "SELECT json FROM test_case_resolution_status_time_series";
  private static final String MYSQL_TEST_CASE_RESOLUTION_UPDATE_QUERY =
      "UPDATE test_case_resolution_status_time_series SET json = :json WHERE id = :id";
  private static final String POSTGRES_TEST_CASE_RESOLUTION_UPDATE_QUERY =
      "UPDATE test_case_resolution_status_time_series SET json = :json::jsonb WHERE id = :id";

  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  public static void migrateGenericToWebhook(CollectionDAO collectionDAO) {
    try {
      List<String> jsonEventSubscription =
          collectionDAO.eventSubscriptionDAO().listAllEventsSubscriptions();
      for (String eventSubscription : jsonEventSubscription) {
        JSONObject jsonObj = new JSONObject(eventSubscription);
        // Read array detination if exist and check subscription type if Generic then change to
        // Webhook
        if (jsonObj.keySet().contains("destinations")) {
          JSONArray destination = jsonObj.getJSONArray("destinations");
          if (destination != null && !destination.isEmpty()) {
            for (Object value : destination) {
              JSONObject destinationObj = (JSONObject) value;
              if (destinationObj.getString("type").equals("Generic")) {
                destinationObj.put("type", "Webhook");
                collectionDAO
                    .eventSubscriptionDAO()
                    .update(JsonUtils.readValue(jsonObj.toString(), EventSubscription.class));
              }
            }
          }
        }
      }
    } catch (Exception ex) {
      LOG.warn("Error running the Generic to Webhook migration ", ex);
    }
  }

  public static void migrateTestCaseResolution(Handle handle, CollectionDAO collectionDAO) {
    try {
      handle
          .createQuery(TEST_CASE_RESOLUTION_QUERY)
          .mapToMap()
          .forEach(
              row -> {
                try {
                  TestCaseResolutionStatus testCaseResolutionStatus =
                      JsonUtils.readValue(
                          row.get("json").toString(), TestCaseResolutionStatus.class);
                  if (testCaseResolutionStatus.getTestCaseReference() != null) {
                    UUID fromId = testCaseResolutionStatus.getTestCaseReference().getId();
                    UUID toId = testCaseResolutionStatus.getId();
                    // Store the test case <-> incident relationship
                    collectionDAO
                        .relationshipDAO()
                        .insert(
                            fromId,
                            toId,
                            Entity.TEST_CASE,
                            Entity.TEST_CASE_RESOLUTION_STATUS,
                            Relationship.PARENT_OF.ordinal(),
                            null);
                    // Remove the test case reference from the test case resolution status
                    testCaseResolutionStatus.setTestCaseReference(null);
                    String json = JsonUtils.pojoToJson(testCaseResolutionStatus);
                    String updateQuery = MYSQL_TEST_CASE_RESOLUTION_UPDATE_QUERY;
                    if (Boolean.FALSE.equals(DatasourceConfig.getInstance().isMySQL())) {
                      updateQuery = POSTGRES_TEST_CASE_RESOLUTION_UPDATE_QUERY;
                    }
                    handle
                        .createUpdate(updateQuery)
                        .bind("json", json)
                        .bind("id", toId.toString())
                        .execute();
                  }
                } catch (Exception ex) {
                  LOG.warn("Error during the test case resolution migration due to ", ex);
                }
              });
    } catch (Exception ex) {
      LOG.warn("Error running the test case resolution migration ", ex);
    }
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
    try {
      JsonObject jsonObj = JsonUtils.readJson(jsonRow).asJsonObject();

      // We need to pop the tablePartition from the json before serializing it
      JsonObject tablePartition = jsonObj.getJsonObject("tablePartition");

      // Remove the tablePartition from the json. We need to convert it to a map to remove the key
      // as JsonObject is immutable
      HashMap<String, Object> jsonMap = JsonUtils.readValue(jsonObj.toString(), HashMap.class);
      jsonMap.remove("tablePartition");

      jsonObj = JsonUtils.readJson(JsonUtils.pojoToJson(jsonMap)).asJsonObject();

      Table table = JsonUtils.readValue(jsonObj.toString(), Table.class);

      if (!tablePartition.isEmpty()) {
        JsonArray partitionColumns = tablePartition.getJsonArray("columns");

        List<PartitionColumnDetails> partitionColumnDetails = new ArrayList<>();

        if ((partitionColumns == null || partitionColumns.isEmpty())
            && table.getServiceType() == CreateDatabaseService.DatabaseServiceType.BigQuery) {
          // BigQuery tables can have pseudo columns for partitioning that were not being set in the
          // partitionColumns entity
          String interval = tablePartition.getString("interval", null);
          if (interval != null) {
            JsonArrayBuilder jsonArrayBuilder = Json.createArrayBuilder();
            switch (interval) {
              case "HOUR" -> partitionColumns = jsonArrayBuilder.add("_PARTITIONTIME").build();
              case "DAY" -> partitionColumns = jsonArrayBuilder.add("_PARTITIONDATE").build();
            }
          }
        }

        if (partitionColumns != null && !partitionColumns.isEmpty()) {
          for (JsonValue column : partitionColumns) {
            PartitionColumnDetails partitionColumnDetail = new PartitionColumnDetails();
            partitionColumnDetail.setColumnName(((JsonString) column).getString());
            String intervalType = tablePartition.getString("intervalType", null);
            if (intervalType != null) {
              partitionColumnDetail.setIntervalType(PartitionIntervalTypes.fromValue(intervalType));
            }
            partitionColumnDetail.setInterval(tablePartition.getString("interval", null));
            partitionColumnDetails.add(partitionColumnDetail);
          }

          table.withTablePartition(new TablePartition().withColumns(partitionColumnDetails));

          collectionDAO.tableDAO().update(table);
        }
      } else {
        LOG.debug("Table {} does not have partition details", table.getId());
      }
    } catch (Exception exc) {
      LOG.warn(
          "Fail to migrate table partition. The partition detail may have been migrated already.");
      LOG.debug(String.format("Table JSON %s\n", jsonRow), exc);
    }
  }
}
