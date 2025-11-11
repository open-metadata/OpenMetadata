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

  private static Map extractConnectionURIDetails(String connectionString) {
    Map connectionDetailsMap = new LinkedHashMap();
    try {
      // Parse the MongoDB connection string
      URI uri = new URI(connectionString);

      // Extract components
      String username = uri.getUserInfo().split(":")[0];
      String password = uri.getUserInfo().split(":")[1];
      String host = uri.getHost();
      String scheme = uri.getScheme();
      int port = uri.getPort();
      String query = uri.getQuery();
      Map queryMap = new HashMap<>();
      if (query != null) {
        String[] queryParams = query.split("&");
        System.out.println("Query Parameters:");
        for (String param : queryParams) {
          queryMap.put(param.split("=")[0], param.split("=")[1]);
        }
      }

      // populate connection details map the extracted components
      connectionDetailsMap.put("username", username);
      connectionDetailsMap.put("password", password);
      connectionDetailsMap.put("hostPort", host + ":" + port);
      connectionDetailsMap.put("scheme", scheme);
      connectionDetailsMap.put("connectionOptions", queryMap);

    } catch (URISyntaxException e) {
      e.printStackTrace();
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
                Map mongoDBConnection = (LinkedHashMap) mongoService.getConnection().getConfig();
                Map connDetails = (LinkedHashMap) mongoDBConnection.get("connectionDetails");

                Map finalConnectionDetails;
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
