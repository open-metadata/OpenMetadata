package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.models.ListParams;

@ExtendWith(TestNamespaceExtension.class)
public class DatabaseHierarchyIT {

  @BeforeAll
  static void setup() {
    // Initialize fluent APIs (triggers client creation which sets up all fluent APIs)
    SdkClients.adminClient();
  }

  @Test
  void createDatabaseSchemaTable(TestNamespace ns) {
    // Service - uses fluent API, no client parameter needed
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    assertNotNull(svc.getId());

    // Database - uses fluent API
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    assertNotNull(db.getId());

    // Schema - uses fluent API
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());
    assertNotNull(schema.getId());

    // Update schema description using fluent API
    DatabaseSchemas.find(schema.getId().toString()).fetch().withDescription("updated").save();

    // Table - uses fluent API
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    assertNotNull(table.getId());
  }

  @Test
  void childrenShowRenamedParentDisplayNames(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    // #38939: tables and schemas store their parent refs in their own JSON. Renaming the parent
    // must not leave the old display name in GET or list (list is the path search reindex reads).
    String databaseDisplayName = ns.prefix("renamedDatabase");
    String schemaDisplayName = ns.prefix("renamedSchema");
    // The schema is patched first: patching it re-stores its database ref from the current
    // database.
    client.databaseSchemas().update(schema.getId(), schema.withDisplayName(schemaDisplayName));
    client.databases().update(db.getId(), db.withDisplayName(databaseDisplayName));

    Table fetchedTable = client.tables().get(table.getId().toString());
    assertEquals(databaseDisplayName, fetchedTable.getDatabase().getDisplayName());
    assertEquals(schemaDisplayName, fetchedTable.getDatabaseSchema().getDisplayName());
    assertEquals(
        databaseDisplayName,
        client.databaseSchemas().get(schema.getId().toString()).getDatabase().getDisplayName());

    Table listedTable =
        client
            .tables()
            .list(new ListParams().setDatabaseSchema(schema.getFullyQualifiedName()))
            .getData()
            .getFirst();
    assertEquals(databaseDisplayName, listedTable.getDatabase().getDisplayName());
    assertEquals(schemaDisplayName, listedTable.getDatabaseSchema().getDisplayName());
    DatabaseSchema listedSchema =
        client
            .databaseSchemas()
            .list(new ListParams().setDatabase(db.getFullyQualifiedName()))
            .getData()
            .getFirst();
    assertEquals(databaseDisplayName, listedSchema.getDatabase().getDisplayName());
  }
}
