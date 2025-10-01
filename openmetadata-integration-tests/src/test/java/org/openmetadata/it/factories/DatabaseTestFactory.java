package org.openmetadata.it.factories;

import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.sdk.client.OpenMetadataClient;

public class DatabaseTestFactory {
  public static Database create(OpenMetadataClient client, TestNamespace ns, String serviceFqn) {
    String name = ns.prefix("db");
    CreateDatabase req = new CreateDatabase();
    req.setName(name);
    req.setService(serviceFqn);
    return client.databases().create(req);
  }
}
