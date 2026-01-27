package org.openmetadata.sdk.fluent;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.MessagingServiceBuilder;
import org.openmetadata.sdk.fluent.request.DeleteRequest;

/**
 * Fluent API for MessagingService operations following Stripe SDK patterns.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.MessagingServices.*;
 *
 * // Create
 * MessagingService messagingService = builder()
 *     .name("messagingService_name")
 *     .description("Description")
 *     .create();
 *
 * // Retrieve
 * MessagingService messagingService = retrieve(messagingServiceId);
 * MessagingService messagingService = retrieveByName("fqn");
 *
 * // Update
 * MessagingService updated = fluent(messagingService)
 *     .withDescription("Updated")
 *     .save();
 * </pre>
 */
public final class MessagingServices {
  private static OpenMetadataClient defaultClient;

  private MessagingServices() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call MessagingServices.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  /**
   * Create a new MessagingServiceBuilder for fluent creation.
   */
  public static MessagingServiceBuilder builder() {
    return new MessagingServiceBuilder(getClient());
  }

  /**
   * Create directly from a CreateMessagingService request.
   */
  public static MessagingService create(CreateMessagingService request) {
    // Pass Create request directly to the service
    return getClient().messagingServices().create(request);
  }

  // ==================== Retrieval ====================

  /**
   * Retrieve by ID.
   */
  public static MessagingService retrieve(String id) {
    return getClient().messagingServices().get(id);
  }

  /**
   * Retrieve by UUID.
   */
  public static MessagingService retrieve(UUID id) {
    return retrieve(id.toString());
  }

  /**
   * Retrieve with specific fields.
   */
  public static MessagingService retrieve(String id, String fields) {
    return getClient().messagingServices().get(id, fields);
  }

  /**
   * Retrieve by fully qualified name.
   */
  public static MessagingService retrieveByName(String fqn) {
    return getClient().messagingServices().getByName(fqn);
  }

  /**
   * Retrieve by FQN with specific fields.
   */
  public static MessagingService retrieveByName(String fqn, String fields) {
    return getClient().messagingServices().getByName(fqn, fields);
  }

  // ==================== Listing ====================

  /**
   * List all with default pagination.
   */

  // ==================== Updates ====================

  /**
   * Create a FluentMessagingService wrapper for fluent updates.
   */

  /**
   * Update directly.
   */
  public static MessagingService update(String id, MessagingService messagingService) {
    return getClient().messagingServices().update(id, messagingService);
  }

  /**
   * Update using entity's ID.
   */
  public static MessagingService update(MessagingService messagingService) {
    if (messagingService.getId() == null) {
      throw new IllegalArgumentException("MessagingService must have an ID for update");
    }
    return update(messagingService.getId().toString(), messagingService);
  }

  // ==================== Deletion ====================

  /**
   * Create a fluent delete request.
   *
   * Usage:
   * <pre>
   * // Soft delete
   * MessagingServices.delete(id).execute();
   *
   * // Hard delete
   * MessagingServices.delete(id).hardDelete().execute();
   *
   * // Recursive delete
   * MessagingServices.delete(id).recursive().execute();
   *
   * // Combined
   * MessagingServices.delete(id).recursive().hardDelete().execute();
   * </pre>
   *
   * @param id The ID to delete
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<MessagingService> delete(String id) {
    return new DeleteRequest<>(id, params -> getClient().messagingServices().delete(id, params));
  }

  /**
   * Delete by UUID.
   *
   * @param id The UUID
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<MessagingService> delete(UUID id) {
    return delete(id.toString());
  }

  // ==================== Batch Operations ====================

  /**
   * Create multiple in a batch.
   */
  public static List<MessagingService> createBatch(CreateMessagingService... requests) {
    List<MessagingService> results = new ArrayList<>();
    for (CreateMessagingService request : requests) {
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
