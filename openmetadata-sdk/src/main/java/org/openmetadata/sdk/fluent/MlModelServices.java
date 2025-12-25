package org.openmetadata.sdk.fluent;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.MlModelServiceBuilder;
import org.openmetadata.sdk.fluent.request.DeleteRequest;

/**
 * Fluent API for MlModelService operations following Stripe SDK patterns.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.MlModelServices.*;
 *
 * // Create
 * MlModelService mlModelService = builder()
 *     .name("mlModelService_name")
 *     .description("Description")
 *     .create();
 *
 * // Retrieve
 * MlModelService mlModelService = retrieve(mlModelServiceId);
 * MlModelService mlModelService = retrieveByName("fqn");
 *
 * // Update
 * MlModelService updated = fluent(mlModelService)
 *     .withDescription("Updated")
 *     .save();
 * </pre>
 */
public final class MlModelServices {
  private static OpenMetadataClient defaultClient;

  private MlModelServices() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call MlModelServices.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  /**
   * Create a new MlModelServiceBuilder for fluent creation.
   */
  public static MlModelServiceBuilder builder() {
    return new MlModelServiceBuilder(getClient());
  }

  /**
   * Create directly from a CreateMlModelService request.
   */
  public static MlModelService create(CreateMlModelService request) {
    // Pass Create request directly to the service
    return getClient().mlModelServices().create(request);
  }

  // ==================== Retrieval ====================

  /**
   * Retrieve by ID.
   */
  public static MlModelService retrieve(String id) {
    return getClient().mlModelServices().get(id);
  }

  /**
   * Retrieve by UUID.
   */
  public static MlModelService retrieve(UUID id) {
    return retrieve(id.toString());
  }

  /**
   * Retrieve with specific fields.
   */
  public static MlModelService retrieve(String id, String fields) {
    return getClient().mlModelServices().get(id, fields);
  }

  /**
   * Retrieve by fully qualified name.
   */
  public static MlModelService retrieveByName(String fqn) {
    return getClient().mlModelServices().getByName(fqn);
  }

  /**
   * Retrieve by FQN with specific fields.
   */
  public static MlModelService retrieveByName(String fqn, String fields) {
    return getClient().mlModelServices().getByName(fqn, fields);
  }

  // ==================== Listing ====================

  /**
   * List all with default pagination.
   */

  // ==================== Updates ====================

  /**
   * Create a FluentMlModelService wrapper for fluent updates.
   */

  /**
   * Update directly.
   */
  public static MlModelService update(String id, MlModelService mlModelService) {
    return getClient().mlModelServices().update(id, mlModelService);
  }

  /**
   * Update using entity's ID.
   */
  public static MlModelService update(MlModelService mlModelService) {
    if (mlModelService.getId() == null) {
      throw new IllegalArgumentException("MlModelService must have an ID for update");
    }
    return update(mlModelService.getId().toString(), mlModelService);
  }

  // ==================== Deletion ====================

  /**
   * Create a fluent delete request.
   *
   * Usage:
   * <pre>
   * // Soft delete
   * MlModelServices.delete(id).execute();
   *
   * // Hard delete
   * MlModelServices.delete(id).hardDelete().execute();
   *
   * // Recursive delete
   * MlModelServices.delete(id).recursive().execute();
   *
   * // Combined
   * MlModelServices.delete(id).recursive().hardDelete().execute();
   * </pre>
   *
   * @param id The ID to delete
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<MlModelService> delete(String id) {
    return new DeleteRequest<>(id, params -> getClient().mlModelServices().delete(id, params));
  }

  /**
   * Delete by UUID.
   *
   * @param id The UUID
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<MlModelService> delete(UUID id) {
    return delete(id.toString());
  }

  // ==================== Batch Operations ====================

  /**
   * Create multiple in a batch.
   */
  public static List<MlModelService> createBatch(CreateMlModelService... requests) {
    List<MlModelService> results = new ArrayList<>();
    for (CreateMlModelService request : requests) {
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
