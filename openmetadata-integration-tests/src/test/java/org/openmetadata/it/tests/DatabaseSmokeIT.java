package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.client.OpenMetadataClient;

@ExtendWith(TestNamespaceExtension.class)
public class DatabaseSmokeIT {

  @Test
  void createDatabaseService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService created = DatabaseServiceTestFactory.create(client, ns, "Postgres", "{}");

    assertNotNull(created.getId());

    DatabaseService fetched =
        DatabaseServiceTestFactory.getById(client, created.getId().toString());
    assertNotNull(fetched);
    DatabaseServiceTestFactory.updateDescription(client, created.getId().toString(), "updated");
  }
}
