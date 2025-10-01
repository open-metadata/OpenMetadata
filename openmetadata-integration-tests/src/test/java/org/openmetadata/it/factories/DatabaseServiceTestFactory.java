package org.openmetadata.it.factories;

import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.PostgresConnection;

public class DatabaseServiceTestFactory {

  public static DatabaseService create(
      OpenMetadataClient client, TestNamespace ns, String serviceTypeIgnored, String connectionJsonIgnored) {
    // Build a minimal Postgres connection; serviceType from builder is set via connection
    PostgresConnection conn = DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();
    String name = ns.prefix("dbService");
    return DatabaseServices.builder()
        .name(name)
        .connection(conn)
        .create();
  }

  public static DatabaseService getById(OpenMetadataClient client, String id) {
    return client.databaseServices().get(id);
  }

  public static void updateDescription(OpenMetadataClient client, String id, String description) {
    DatabaseService svc = client.databaseServices().get(id);
    svc.setDescription(description);
    client.databaseServices().update(id, svc);
  }
}
