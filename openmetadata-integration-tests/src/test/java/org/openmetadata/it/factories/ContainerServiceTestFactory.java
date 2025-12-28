package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.api.services.CreateStorageService.StorageServiceType;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.services.connections.storage.S3Connection;
import org.openmetadata.schema.type.StorageConnection;

public class ContainerServiceTestFactory {

  public static StorageService createS3(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("containerS3Service_" + uniqueId);

    S3Connection s3Conn = new S3Connection();

    StorageConnection conn = new StorageConnection().withConfig(s3Conn);

    CreateStorageService request =
        new CreateStorageService()
            .withName(name)
            .withServiceType(StorageServiceType.S3)
            .withConnection(conn)
            .withDescription("Test container S3 service");

    return SdkClients.adminClient().storageServices().create(request);
  }

  public static StorageService getById(String id) {
    return SdkClients.adminClient().storageServices().get(id);
  }
}
