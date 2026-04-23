package org.openmetadata.service.migration.utils.v130;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public class MigrationUtil {

  private static final String GET_MONGO_DB_SERVICES =
      "SELECT id, json from " + "dbservice_entity de WHERE " + "serviceType = 'MongoDB'";

  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  private static Map<String, Object> extractConnectionURIDetails(String connectionString) {
    Map<String, Object> connectionDetailsMap = new LinkedHashMap<>();
    try {
      URI uri = new URI(connectionString);

      String userInfo = uri.getUserInfo();
      String username = "";
      String password = "";
      if (userInfo != null) {
        String[] parts = userInfo.split(":", 2);
        username = parts[0];
        password = parts.length > 1 ? parts[1] : "";
      }

      String host = uri.getHost();
      String scheme = uri.getScheme();
      int port = uri.getPort();
      String query = uri.getQuery();
      Map<String, String> queryMap = new HashMap<>();
      if (query != null) {
        LOG.debug("Parsing query parameters from MongoDB connection string");
        for (String param : query.split("&")) {
          String[] kv = param.split("=", 2);
          if (kv.length == 2) {
            queryMap.put(kv[0], kv[1]);
          } else if (kv.length == 1 && !kv[0].isEmpty()) {
            queryMap.put(kv[0], "");
          }
        }
      }

      connectionDetailsMap.put("username", username);
      connectionDetailsMap.put("password", password);
      connectionDetailsMap.put("hostPort", host + ":" + port);
      connectionDetailsMap.put("scheme", scheme);
      connectionDetailsMap.put("connectionOptions", queryMap);

    } catch (URISyntaxException e) {
      LOG.error("Failed to parse MongoDB connection URI: {}", e.getMessage(), e);
    }
    return connectionDetailsMap;
  }

  public static void migrateMongoDBConnStr(Handle handle, String updateSqlQuery) {
    handle
        .createQuery(GET_MONGO_DB_SERVICES)
        .mapToMap()
        .forEach(
            row -> {
              try {
                DatabaseService mongoService =
                    JsonUtils.readValue(row.get("json").toString(), DatabaseService.class);
                String id = row.get("id").toString();
                @SuppressWarnings("unchecked")
                Map<String, Object> mongoDBConnection =
                    (LinkedHashMap<String, Object>) mongoService.getConnection().getConfig();
                @SuppressWarnings("unchecked")
                Map<String, Object> connDetails =
                    (LinkedHashMap<String, Object>) mongoDBConnection.get("connectionDetails");

                Map<String, Object> finalConnectionDetails;
                if (connDetails != null) {
                  if (connDetails.get("connectionURI") != null) {
                    String connectionURI = connDetails.get("connectionURI").toString();
                    finalConnectionDetails = extractConnectionURIDetails(connectionURI);
                  } else {
                    finalConnectionDetails = connDetails;
                  }
                  mongoDBConnection.putAll(finalConnectionDetails);
                  mongoDBConnection.remove("connectionDetails");
                  String json = JsonUtils.pojoToJson(mongoService);

                  handle.createUpdate(updateSqlQuery).bind("json", json).bind("id", id).execute();
                }
              } catch (Exception ex) {
                LOG.warn("Error during the MongoDB migration due to ", ex);
              }
            });
  }
}
