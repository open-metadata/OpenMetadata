package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.fluent.DatabaseServices;

@ExtendWith(TestNamespaceExtension.class)
public class DatabaseSmokeIT {

  @BeforeAll
  static void setup() {
    SdkClients.adminClient(); // Initialize fluent APIs
  }

  @Test
  void createDatabaseService(TestNamespace ns) {
    DatabaseService created = DatabaseServiceTestFactory.create(ns, "Postgres");

    assertNotNull(created.getId());

    // Use fluent API for get/update
    DatabaseService fetched = DatabaseServices.retrieve(created.getId().toString());
    assertNotNull(fetched);

    fetched.setDescription("updated");
    DatabaseServices.update(fetched);
  }
}
