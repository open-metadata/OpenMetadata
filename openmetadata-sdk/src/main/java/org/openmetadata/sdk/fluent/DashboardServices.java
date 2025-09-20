package org.openmetadata.sdk.fluent;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.DashboardServiceBuilder;
import org.openmetadata.sdk.fluent.request.DeleteRequest;

/**
 * Fluent API for DashboardService operations following Stripe SDK patterns.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.DashboardServices.*;
 *
 * // Create
 * DashboardService dashboardService = builder()
 *     .name("dashboardService_name")
 *     .description("Description")
 *     .create();
 *
 * // Retrieve
 * DashboardService dashboardService = retrieve(dashboardServiceId);
 * DashboardService dashboardService = retrieveByName("fqn");
 *
 * // Update
 * DashboardService updated = fluent(dashboardService)
 *     .withDescription("Updated")
 *     .save();
 * </pre>
 */
public final class DashboardServices {
  private static OpenMetadataClient defaultClient;

  private DashboardServices() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call DashboardServices.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  /**
   * Create a new DashboardServiceBuilder for fluent creation.
   */
  public static DashboardServiceBuilder builder() {
    return new DashboardServiceBuilder(getClient());
  }

  /**
   * Create directly from a CreateDashboardService request.
   */
  public static DashboardService create(CreateDashboardService request) {
    // Pass Create request directly to the service
    return getClient().dashboardServices().create(request);
  }

  // ==================== Retrieval ====================

  /**
   * Retrieve by ID.
   */
  public static DashboardService retrieve(String id) {
    return getClient().dashboardServices().get(id);
  }

  /**
   * Retrieve by UUID.
   */
  public static DashboardService retrieve(UUID id) {
    return retrieve(id.toString());
  }

  /**
   * Retrieve with specific fields.
   */
  public static DashboardService retrieve(String id, String fields) {
    return getClient().dashboardServices().get(id, fields);
  }

  /**
   * Retrieve by fully qualified name.
   */
  public static DashboardService retrieveByName(String fqn) {
    return getClient().dashboardServices().getByName(fqn);
  }

  /**
   * Retrieve by FQN with specific fields.
   */
  public static DashboardService retrieveByName(String fqn, String fields) {
    return getClient().dashboardServices().getByName(fqn, fields);
  }

  // ==================== Listing ====================

  // List functionality not implemented for services

  // ==================== Updates ====================

  /**
   * Update directly.
   */
  public static DashboardService update(String id, DashboardService dashboardService) {
    return getClient().dashboardServices().update(id, dashboardService);
  }

  /**
   * Update using entity's ID.
   */
  public static DashboardService update(DashboardService dashboardService) {
    if (dashboardService.getId() == null) {
      throw new IllegalArgumentException("DashboardService must have an ID for update");
    }
    return update(dashboardService.getId().toString(), dashboardService);
  }

  // ==================== Deletion ====================

  /**
   * Create a fluent delete request.
   *
   * Usage:
   * <pre>
   * // Soft delete
   * DashboardServices.delete(id).execute();
   *
   * // Hard delete
   * DashboardServices.delete(id).hardDelete().execute();
   *
   * // Recursive delete
   * DashboardServices.delete(id).recursive().execute();
   *
   * // Combined
   * DashboardServices.delete(id).recursive().hardDelete().execute();
   * </pre>
   *
   * @param id The ID to delete
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<DashboardService> delete(String id) {
    return new DeleteRequest<>(id, params -> getClient().dashboardServices().delete(id, params));
  }

  /**
   * Delete by UUID.
   *
   * @param id The UUID
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<DashboardService> delete(UUID id) {
    return delete(id.toString());
  }

  // ==================== Batch Operations ====================

  /**
   * Create multiple in a batch.
   */
  public static List<DashboardService> createBatch(CreateDashboardService... requests) {
    List<DashboardService> results = new ArrayList<>();
    for (CreateDashboardService request : requests) {
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
