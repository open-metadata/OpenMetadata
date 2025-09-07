package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class TestDefinition extends org.openmetadata.schema.tests.TestDefinition {

  public static TestDefinition create(org.openmetadata.schema.tests.TestDefinition entity)
      throws OpenMetadataException {
    return (TestDefinition) OpenMetadata.client().testDefinitions().create(entity);
  }

  public static TestDefinition retrieve(String id) throws OpenMetadataException {
    return (TestDefinition) OpenMetadata.client().testDefinitions().get(id);
  }

  public static TestDefinition retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static TestDefinition retrieveByName(String name) throws OpenMetadataException {
    return (TestDefinition) OpenMetadata.client().testDefinitions().getByName(name);
  }

  public static TestDefinition update(String id, org.openmetadata.schema.tests.TestDefinition patch)
      throws OpenMetadataException {
    return (TestDefinition) OpenMetadata.client().testDefinitions().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().testDefinitions().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.tests.TestDefinition> list()
      throws OpenMetadataException {
    return OpenMetadata.client().testDefinitions().list();
  }

  public static ListResponse<org.openmetadata.schema.tests.TestDefinition> list(ListParams params)
      throws OpenMetadataException {
    return OpenMetadata.client().testDefinitions().list(params);
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
