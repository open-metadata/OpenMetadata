package org.openmetadata.sdk.services.events;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Service for querying Change Events.
 *
 * Change Events are generated when entities are created, updated, or deleted.
 * This service provides methods to query events by entity type and timestamp.
 *
 * Usage:
 * <pre>
 * // Get all database creation events
 * ListResponse<ChangeEvent> events = client.changeEvents().list("database", null, null, null, null);
 *
 * // Get database update events after a specific timestamp
 * ListResponse<ChangeEvent> updates = client.changeEvents().list(null, "database", null, null, timestamp);
 * </pre>
 */
public class ChangeEventService {
  private final HttpClient httpClient;
  private static final String BASE_PATH = "/v1/events";

  public ChangeEventService(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Query change events with filters.
   *
   * @param entityCreated Filter for entity created events (e.g., "database", "table")
   * @param entityUpdated Filter for entity updated events (e.g., "database", "table")
   * @param entityRestored Filter for entity restored events (e.g., "database", "table")
   * @param entityDeleted Filter for entity deleted events (e.g., "database", "table")
   * @param timestamp Filter for events after this timestamp (milliseconds since epoch)
   * @return List of matching ChangeEvent objects
   * @throws OpenMetadataException if request fails
   */
  public ListResponse<ChangeEvent> list(
      String entityCreated,
      String entityUpdated,
      String entityRestored,
      String entityDeleted,
      Long timestamp)
      throws OpenMetadataException {

    Map<String, String> queryParams = new HashMap<>();
    if (entityCreated != null) {
      queryParams.put("entityCreated", entityCreated);
    }
    if (entityUpdated != null) {
      queryParams.put("entityUpdated", entityUpdated);
    }
    if (entityRestored != null) {
      queryParams.put("entityRestored", entityRestored);
    }
    if (entityDeleted != null) {
      queryParams.put("entityDeleted", entityDeleted);
    }
    if (timestamp != null) {
      queryParams.put("timestamp", timestamp.toString());
    }

    RequestOptions options = RequestOptions.builder().queryParams(queryParams).build();

    // Execute and deserialize manually to preserve generic type
    String responseStr = httpClient.executeForString(HttpMethod.GET, BASE_PATH, null, options);
    return deserializeListResponse(responseStr);
  }

  /**
   * Query change events for entity creation.
   *
   * @param entityType Entity type to filter (e.g., "database", "table")
   * @param timestamp Filter for events after this timestamp (optional)
   * @return List of entity created events
   * @throws OpenMetadataException if request fails
   */
  public ListResponse<ChangeEvent> listCreated(String entityType, Long timestamp)
      throws OpenMetadataException {
    return list(entityType, null, null, null, timestamp);
  }

  /**
   * Query change events for entity updates.
   *
   * @param entityType Entity type to filter (e.g., "database", "table")
   * @param timestamp Filter for events after this timestamp (optional)
   * @return List of entity updated events
   * @throws OpenMetadataException if request fails
   */
  public ListResponse<ChangeEvent> listUpdated(String entityType, Long timestamp)
      throws OpenMetadataException {
    return list(null, entityType, null, null, timestamp);
  }

  /**
   * Query change events for entity deletion.
   *
   * @param entityType Entity type to filter (e.g., "database", "table")
   * @param timestamp Filter for events after this timestamp (optional)
   * @return List of entity deleted events
   * @throws OpenMetadataException if request fails
   */
  public ListResponse<ChangeEvent> listDeleted(String entityType, Long timestamp)
      throws OpenMetadataException {
    return list(null, null, null, entityType, timestamp);
  }

  /**
   * Query change events for entity restoration.
   *
   * @param entityType Entity type to filter (e.g., "database", "table")
   * @param timestamp Filter for events after this timestamp (optional)
   * @return List of entity restored events
   * @throws OpenMetadataException if request fails
   */
  public ListResponse<ChangeEvent> listRestored(String entityType, Long timestamp)
      throws OpenMetadataException {
    return list(null, null, entityType, null, timestamp);
  }

  /**
   * Deserialize list response manually to preserve generic type.
   */
  private ListResponse<ChangeEvent> deserializeListResponse(String json)
      throws OpenMetadataException {
    try {
      com.fasterxml.jackson.databind.ObjectMapper objectMapper =
          new com.fasterxml.jackson.databind.ObjectMapper();
      com.fasterxml.jackson.databind.JsonNode rootNode = objectMapper.readTree(json);

      ListResponse<ChangeEvent> response = new ListResponse<>();

      // Parse data array
      if (rootNode.has("data") && rootNode.get("data").isArray()) {
        java.util.List<ChangeEvent> items = new java.util.ArrayList<>();
        for (com.fasterxml.jackson.databind.JsonNode node : rootNode.get("data")) {
          ChangeEvent item = objectMapper.treeToValue(node, ChangeEvent.class);
          items.add(item);
        }
        response.setData(items);
      }

      // Parse paging if present
      if (rootNode.has("paging")) {
        org.openmetadata.sdk.models.AllModels.Paging paging =
            objectMapper.treeToValue(
                rootNode.get("paging"), org.openmetadata.sdk.models.AllModels.Paging.class);
        response.setPaging(paging);
      }

      return response;
    } catch (Exception e) {
      throw new OpenMetadataException(
          "Failed to deserialize ChangeEvent list response: " + e.getMessage(), e);
    }
  }
}
