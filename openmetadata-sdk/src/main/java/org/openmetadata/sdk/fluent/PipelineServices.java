package org.openmetadata.sdk.fluent;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.PipelineServiceBuilder;
import org.openmetadata.sdk.fluent.request.DeleteRequest;

/**
 * Fluent API for PipelineService operations following Stripe SDK patterns.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.PipelineServices.*;
 *
 * // Create
 * PipelineService pipelineService = builder()
 *     .name("pipelineService_name")
 *     .description("Description")
 *     .create();
 *
 * // Retrieve
 * PipelineService pipelineService = retrieve(pipelineServiceId);
 * PipelineService pipelineService = retrieveByName("fqn");
 *
 * // Update
 * PipelineService updated = fluent(pipelineService)
 *     .withDescription("Updated")
 *     .save();
 * </pre>
 */
public final class PipelineServices {
  private static OpenMetadataClient defaultClient;

  private PipelineServices() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call PipelineServices.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  /**
   * Create a new PipelineServiceBuilder for fluent creation.
   */
  public static PipelineServiceBuilder builder() {
    return new PipelineServiceBuilder(getClient());
  }

  /**
   * Create directly from a CreatePipelineService request.
   */
  public static PipelineService create(CreatePipelineService request) {
    // Pass Create request directly to the service
    return getClient().pipelineServices().create(request);
  }

  // ==================== Retrieval ====================

  /**
   * Retrieve by ID.
   */
  public static PipelineService retrieve(String id) {
    return getClient().pipelineServices().get(id);
  }

  /**
   * Retrieve by UUID.
   */
  public static PipelineService retrieve(UUID id) {
    return retrieve(id.toString());
  }

  /**
   * Retrieve with specific fields.
   */
  public static PipelineService retrieve(String id, String fields) {
    return getClient().pipelineServices().get(id, fields);
  }

  /**
   * Retrieve by fully qualified name.
   */
  public static PipelineService retrieveByName(String fqn) {
    return getClient().pipelineServices().getByName(fqn);
  }

  /**
   * Retrieve by FQN with specific fields.
   */
  public static PipelineService retrieveByName(String fqn, String fields) {
    return getClient().pipelineServices().getByName(fqn, fields);
  }

  // ==================== Listing ====================

  /**
   * List all with default pagination.
   */

  // ==================== Updates ====================

  /**
   * Create a FluentPipelineService wrapper for fluent updates.
   */

  /**
   * Update directly.
   */
  public static PipelineService update(String id, PipelineService pipelineService) {
    return getClient().pipelineServices().update(id, pipelineService);
  }

  /**
   * Update using entity's ID.
   */
  public static PipelineService update(PipelineService pipelineService) {
    if (pipelineService.getId() == null) {
      throw new IllegalArgumentException("PipelineService must have an ID for update");
    }
    return update(pipelineService.getId().toString(), pipelineService);
  }

  // ==================== Deletion ====================

  /**
   * Create a fluent delete request.
   *
   * Usage:
   * <pre>
   * // Soft delete
   * PipelineServices.delete(id).execute();
   *
   * // Hard delete
   * PipelineServices.delete(id).hardDelete().execute();
   *
   * // Recursive delete
   * PipelineServices.delete(id).recursive().execute();
   *
   * // Combined
   * PipelineServices.delete(id).recursive().hardDelete().execute();
   * </pre>
   *
   * @param id The ID to delete
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<PipelineService> delete(String id) {
    return new DeleteRequest<>(id, params -> getClient().pipelineServices().delete(id, params));
  }

  /**
   * Delete by UUID.
   *
   * @param id The UUID
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<PipelineService> delete(UUID id) {
    return delete(id.toString());
  }

  // ==================== Batch Operations ====================

  /**
   * Create multiple in a batch.
   */
  public static List<PipelineService> createBatch(CreatePipelineService... requests) {
    List<PipelineService> results = new ArrayList<>();
    for (CreatePipelineService request : requests) {
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
