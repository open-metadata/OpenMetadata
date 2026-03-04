package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * SDK wrapper for TestCase operations.
 * This class provides static methods for TestCase CRUD operations.
 * It does NOT extend the schema TestCase class to avoid naming conflicts.
 */
public class TestCase {

  private static OpenMetadataClient defaultClient;

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      return OpenMetadata.client();
    }
    return defaultClient;
  }

  // Static methods for CRUD operations
  public static org.openmetadata.schema.tests.TestCase create(
      org.openmetadata.schema.api.tests.CreateTestCase createTestCase)
      throws OpenMetadataException {
    return getClient().testCases().create(createTestCase);
  }

  public static org.openmetadata.schema.tests.TestCase retrieve(String id)
      throws OpenMetadataException {
    return getClient().testCases().get(id);
  }

  public static org.openmetadata.schema.tests.TestCase retrieve(String id, String fields)
      throws OpenMetadataException {
    return getClient().testCases().get(id, fields);
  }

  public static org.openmetadata.schema.tests.TestCase retrieve(UUID id)
      throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static org.openmetadata.schema.tests.TestCase retrieveByName(String name)
      throws OpenMetadataException {
    return getClient().testCases().getByName(name);
  }

  public static org.openmetadata.schema.tests.TestCase retrieveByName(String name, String fields)
      throws OpenMetadataException {
    return getClient().testCases().getByName(name, fields);
  }

  public static org.openmetadata.schema.tests.TestCase update(
      String id, org.openmetadata.schema.tests.TestCase patch) throws OpenMetadataException {
    return getClient().testCases().update(id, patch);
  }

  public static void delete(String id) throws OpenMetadataException {
    getClient().testCases().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    getClient().testCases().delete(id);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    getClient().testCases().delete(id, params);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return getClient().testCases().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return getClient().testCases().deleteAsync(id);
  }

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

  public static ListResponse<org.openmetadata.schema.tests.TestCase> list()
      throws OpenMetadataException {
    return getClient().testCases().list();
  }

  public static ListResponse<org.openmetadata.schema.tests.TestCase> list(ListParams params)
      throws OpenMetadataException {
    return getClient().testCases().list(params);
  }
}
