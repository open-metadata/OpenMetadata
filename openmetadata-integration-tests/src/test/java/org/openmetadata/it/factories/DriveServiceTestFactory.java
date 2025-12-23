package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.api.services.CreateDriveService.DriveServiceType;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.services.connections.drive.GoogleDriveConnection;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

public class DriveServiceTestFactory {

  public static DriveService createGoogleDrive(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("googleDrive_" + uniqueId);

    GoogleDriveConnection googleConn = new GoogleDriveConnection();

    DriveConnection conn = new DriveConnection().withConfig(googleConn);

    CreateDriveService request =
        new CreateDriveService()
            .withName(name)
            .withServiceType(DriveServiceType.GoogleDrive)
            .withConnection(conn)
            .withDescription("Test GoogleDrive service");

    try {
      return SdkClients.adminClient()
          .getHttpClient()
          .execute(HttpMethod.POST, "/v1/services/driveServices", request, DriveService.class);
    } catch (OpenMetadataException e) {
      throw new RuntimeException("Failed to create GoogleDrive service", e);
    }
  }

  public static DriveService getById(String id) {
    try {
      return SdkClients.adminClient()
          .getHttpClient()
          .execute(HttpMethod.GET, "/v1/services/driveServices/" + id, null, DriveService.class);
    } catch (OpenMetadataException e) {
      throw new RuntimeException("Failed to get DriveService by id: " + id, e);
    }
  }
}
