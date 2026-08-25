package org.openmetadata.sdk;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.StorageServices;
import org.openmetadata.sdk.services.services.StorageServiceService;

class OMStorageServicesInitTest {

  @AfterEach
  void tearDown() {
    StorageServices.setDefaultClient(null);
  }

  @Test
  void testInitRegistersStorageServicesFluentApi() {
    OpenMetadataClient mockClient = mock(OpenMetadataClient.class);
    StorageServiceService mockStorageServiceService = mock(StorageServiceService.class);
    StorageService expected = new StorageService();
    expected.setName("s3-prod");

    when(mockClient.storageServices()).thenReturn(mockStorageServiceService);
    when(mockStorageServiceService.get("storage-service-id")).thenReturn(expected);

    OM.init(mockClient);

    StorageService result = StorageServices.retrieve("storage-service-id");

    assertSame(expected, result);
    verify(mockClient).storageServices();
    verify(mockStorageServiceService).get("storage-service-id");
  }
}
