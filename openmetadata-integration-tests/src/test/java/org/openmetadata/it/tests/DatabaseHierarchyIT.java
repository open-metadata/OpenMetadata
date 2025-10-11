package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;

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

@ExtendWith(TestNamespaceExtension.class)
public class DatabaseHierarchyIT {

  @Test
  void createDatabaseSchemaTable(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Service
    DatabaseService svc = DatabaseServiceTestFactory.create(client, ns, "Postgres", "{}");
    assertNotNull(svc.getId());

    // Database
    Database db = DatabaseTestFactory.create(client, ns, svc.getFullyQualifiedName());
    assertNotNull(db.getId());

    // Schema
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.create(client, ns, db.getFullyQualifiedName());
    assertNotNull(schema.getId());
    DatabaseSchemaTestFactory.updateDescription(client, schema.getId().toString(), "updated");

    // Table
    Table table = TableTestFactory.createSimple(client, ns, schema.getFullyQualifiedName());
    assertNotNull(table.getId());
  }
}
