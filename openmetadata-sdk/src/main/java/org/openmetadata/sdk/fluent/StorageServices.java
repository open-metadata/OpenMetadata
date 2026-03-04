package org.openmetadata.sdk.fluent;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.StorageServiceBuilder;
import org.openmetadata.sdk.fluent.request.DeleteRequest;

/**
 * Fluent API for StorageService operations following Stripe SDK patterns.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.StorageServices.*;
 *
 * // Create
 * StorageService storageService = builder()
 *     .name("storageService_name")
 *     .description("Description")
 *     .create();
 *
 * // Retrieve
 * StorageService storageService = retrieve(storageServiceId);
 * StorageService storageService = retrieveByName("fqn");
 *
 * // Update
 * StorageService updated = fluent(storageService)
 *     .withDescription("Updated")
 *     .save();
 * </pre>
 */
public final class StorageServices {
  private static OpenMetadataClient defaultClient;

  private StorageServices() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call StorageServices.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  /**
   * Create a new StorageServiceBuilder for fluent creation.
   */
  public static StorageServiceBuilder builder() {
    return new StorageServiceBuilder(getClient());
  }

  /**
   * Create directly from a CreateStorageService request.
   */
  public static StorageService create(CreateStorageService request) {
    // Pass Create request directly to the service
    return getClient().storageServices().create(request);
  }

  // ==================== Retrieval ====================

  /**
   * Retrieve by ID.
   */
  public static StorageService retrieve(String id) {
    return getClient().storageServices().get(id);
  }

  /**
   * Retrieve by UUID.
   */
  public static StorageService retrieve(UUID id) {
    return retrieve(id.toString());
  }

  /**
   * Retrieve with specific fields.
   */
  public static StorageService retrieve(String id, String fields) {
    return getClient().storageServices().get(id, fields);
  }

  /**
   * Retrieve by fully qualified name.
   */
  public static StorageService retrieveByName(String fqn) {
    return getClient().storageServices().getByName(fqn);
  }

  /**
   * Retrieve by FQN with specific fields.
   */
  public static StorageService retrieveByName(String fqn, String fields) {
    return getClient().storageServices().getByName(fqn, fields);
  }

  // ==================== Listing ====================

  // ==================== Updates ====================

  /**
   * Update directly.
   */
  public static StorageService update(String id, StorageService storageService) {
    return getClient().storageServices().update(id, storageService);
  }

  /**
   * Update using entity's ID.
   */
  public static StorageService update(StorageService storageService) {
    if (storageService.getId() == null) {
      throw new IllegalArgumentException("StorageService must have an ID for update");
    }
    return update(storageService.getId().toString(), storageService);
  }

  // ==================== Deletion ====================

  /**
   * Create a fluent delete request.
   *
   * Usage:
   * <pre>
   * // Soft delete
   * StorageServices.delete(id).execute();
   *
   * // Hard delete
   * StorageServices.delete(id).hardDelete().execute();
   *
   * // Recursive delete
   * StorageServices.delete(id).recursive().execute();
   *
   * // Combined
   * StorageServices.delete(id).recursive().hardDelete().execute();
   * </pre>
   *
   * @param id The ID to delete
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<StorageService> delete(String id) {
    return new DeleteRequest<>(id, params -> getClient().storageServices().delete(id, params));
  }

  /**
   * Delete by UUID.
   *
   * @param id The UUID
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<StorageService> delete(UUID id) {
    return delete(id.toString());
  }

  // ==================== Batch Operations ====================

  /**
   * Create multiple in a batch.
   */
  public static List<StorageService> createBatch(CreateStorageService... requests) {
    List<StorageService> results = new ArrayList<>();
    for (CreateStorageService request : requests) {
      try {
        results.add(create(request));
      } catch (Exception e) {
        // TODO: Better error handling with BatchResult
        throw new RuntimeException("Batch creation failed", e);
      }
    }
    return results;
  }
}
