package org.openmetadata.it.factories;

import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.client.OpenMetadataClient;

public class DatabaseSchemaTestFactory {
  public static DatabaseSchema create(
      OpenMetadataClient client, TestNamespace ns, String databaseFqn) {
    String name = ns.prefix("schema");
    CreateDatabaseSchema req = new CreateDatabaseSchema();
    req.setName(name);
    req.setDatabase(databaseFqn);
    return client.databaseSchemas().create(req);
  }

  public static DatabaseSchema createSimple(
      OpenMetadataClient client, TestNamespace ns, DatabaseService service) {
    // Create database first
    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName(ns.prefix("db"));
    dbReq.setService(service.getFullyQualifiedName());
    Database database = client.databases().create(dbReq);

    // Then create schema
    String schemaName = ns.prefix("schema");
    CreateDatabaseSchema req = new CreateDatabaseSchema();
    req.setName(schemaName);
    req.setDatabase(database.getFullyQualifiedName());
    return client.databaseSchemas().create(req);
  }

  public static void updateDescription(OpenMetadataClient client, String id, String description) {
    DatabaseSchema schema = client.databaseSchemas().get(id);
    schema.setDescription(description);
    client.databaseSchemas().update(id, schema);
  }
}
