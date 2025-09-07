package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class TestCase extends org.openmetadata.schema.tests.TestCase {

  public static TestCase create(org.openmetadata.schema.tests.TestCase entity)
      throws OpenMetadataException {
    return (TestCase) OpenMetadata.client().testCases().create(entity);
  }

  public static TestCase retrieve(String id) throws OpenMetadataException {
    return (TestCase) OpenMetadata.client().testCases().get(id);
  }

  public static TestCase retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static TestCase retrieveByName(String name) throws OpenMetadataException {
    return (TestCase) OpenMetadata.client().testCases().getByName(name);
  }

  public static TestCase update(String id, org.openmetadata.schema.tests.TestCase patch)
      throws OpenMetadataException {
    return (TestCase) OpenMetadata.client().testCases().patch(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().testCases().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.tests.TestCase> list()
      throws OpenMetadataException {
    return OpenMetadata.client().testCases().list();
  }

  public static ListResponse<org.openmetadata.schema.tests.TestCase> list(ListParams params)
      throws OpenMetadataException {
    return OpenMetadata.client().testCases().list(params);
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
