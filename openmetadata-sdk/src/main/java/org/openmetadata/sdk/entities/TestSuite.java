package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class TestSuite extends org.openmetadata.schema.tests.TestSuite {

  public static TestSuite create(org.openmetadata.schema.tests.TestSuite entity)
      throws OpenMetadataException {
    return (TestSuite) OpenMetadata.client().testSuites().create(entity);
  }

  public static TestSuite retrieve(String id) throws OpenMetadataException {
    return (TestSuite) OpenMetadata.client().testSuites().get(id);
  }

  public static TestSuite retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static TestSuite retrieveByName(String name) throws OpenMetadataException {
    return (TestSuite) OpenMetadata.client().testSuites().getByName(name);
  }

  public static TestSuite update(String id, org.openmetadata.schema.tests.TestSuite patch)
      throws OpenMetadataException {
    return (TestSuite) OpenMetadata.client().testSuites().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().testSuites().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.tests.TestSuite> list()
      throws OpenMetadataException {
    return OpenMetadata.client().testSuites().list();
  }

  public static ListResponse<org.openmetadata.schema.tests.TestSuite> list(ListParams params)
      throws OpenMetadataException {
    return OpenMetadata.client().testSuites().list(params);
  }

  // Add async delete for all entities extending EntityServiceBase
  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(
        () -> {
          try {
            delete(id, recursive, hardDelete);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }
}
