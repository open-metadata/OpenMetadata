package org.openmetadata.sdk.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flipkart.zjsonpatch.JsonDiff;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import okhttp3.HttpUrl;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.AllModels;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

public abstract class EntityServiceBase<T> {
  protected final HttpClient httpClient;
  protected final String basePath;
  protected final ObjectMapper objectMapper;

  protected EntityServiceBase(HttpClient httpClient, String basePath) {
    this.httpClient = httpClient;
    this.basePath = basePath;
    this.objectMapper = new ObjectMapper();
    // Configure to exclude null values to avoid sending computed fields like childrenCount
    this.objectMapper.setSerializationInclusion(
        com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
  }

  public T create(T entity) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, entity, getEntityClass());
  }

  public T upsert(T entity) throws OpenMetadataException {
    // PUT without ID for create-or-update operations
    return httpClient.execute(HttpMethod.PUT, basePath, entity, getEntityClass());
  }

  public BulkOperationResult bulkCreateOrUpdate(List<?> createRequests)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/bulk", createRequests, BulkOperationResult.class);
  }

  public BulkOperationResult bulkCreateOrUpdateAsync(List<?> createRequests)
      throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParam("async", "true").build();
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/bulk", createRequests, BulkOperationResult.class, options);
  }

  public T get(UUID id) throws OpenMetadataException {
    return get(id.toString());
  }

  public T get(String id) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.GET, basePath + "/" + id, null, getEntityClass());
  }

  public T get(String id, String fields) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParam("fields", fields).build();
    return httpClient.execute(HttpMethod.GET, basePath + "/" + id, null, getEntityClass(), options);
  }

  public T get(String id, String fields, String include) throws OpenMetadataException {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();
    if (fields != null) {
      optionsBuilder.queryParam("fields", fields);
    }
    if (include != null) {
      optionsBuilder.queryParam("include", include);
    }
    return httpClient.execute(
        HttpMethod.GET, basePath + "/" + id, null, getEntityClass(), optionsBuilder.build());
  }

  public T getByName(String name) throws OpenMetadataException {
    return getByName(name, null);
  }

  public T getByName(String name, String fields) throws OpenMetadataException {
    // Properly encode the FQN for use in URL path
    // FQNs with special characters are quoted, and we need to handle those quotes
    String encodedPath = buildPathWithEncodedName(name);

    RequestOptions options =
        fields != null ? RequestOptions.builder().queryParam("fields", fields).build() : null;

    return httpClient.execute(HttpMethod.GET, encodedPath, null, getEntityClass(), options);
  }

  /**
   * Builds a properly encoded path for name-based endpoints.
   * Uses OkHttp's HttpUrl.Builder to ensure proper URL encoding of special characters,
   * similar to how Jersey WebTarget handles path parameters.
   *
   * @param name The entity name or FQN, which may contain quotes and special characters
   * @return The properly encoded path string
   */
  private String buildPathWithEncodedName(String name) {
    // Use HttpUrl.Builder to properly encode the name as a path segment
    // This handles special characters, quotes, and Unicode properly
    HttpUrl baseUrl = HttpUrl.parse("http://localhost" + basePath + "/name");
    if (baseUrl == null) {
      throw new IllegalStateException("Invalid base path: " + basePath);
    }

    // Add the name as a path segment - HttpUrl.Builder will handle encoding
    HttpUrl urlWithName = baseUrl.newBuilder().addPathSegment(name).build();

    // Return just the encoded path portion
    return urlWithName.encodedPath();
  }

  public ListResponse<T> list() throws OpenMetadataException {
    return list(new ListParams());
  }

  public ListResponse<T> list(ListParams params) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParams(params.toQueryParams()).build();
    // Use executeForString and manually deserialize with TypeReference to preserve generic type
    String responseStr = httpClient.executeForString(HttpMethod.GET, basePath, null, options);
    return deserializeListResponse(responseStr);
  }

  protected ListResponse<T> deserializeListResponse(String json) throws OpenMetadataException {
    // Default implementation using Jackson with proper type handling
    try {
      // First parse as generic JSON to get the structure
      JsonNode rootNode = objectMapper.readTree(json);

      // Create new ListResponse
      ListResponse<T> response = new ListResponse<>();

      // Parse data array with proper type
      if (rootNode.has("data") && rootNode.get("data").isArray()) {
        List<T> items = new ArrayList<>();
        for (JsonNode node : rootNode.get("data")) {
          T item = objectMapper.treeToValue(node, getEntityClass());
          items.add(item);
        }
        response.setData(items);
      }

      // Parse paging if present
      if (rootNode.has("paging")) {
        AllModels.Paging paging =
            objectMapper.treeToValue(rootNode.get("paging"), AllModels.Paging.class);
        response.setPaging(paging);
      }

      return response;
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to deserialize list response: " + e.getMessage(), e);
    }
  }

  public T update(UUID id, T entity) throws OpenMetadataException {
    return update(id.toString(), entity, null);
  }

  public T update(String id, T entity) throws OpenMetadataException {
    return update(id, entity, null);
  }

  public T update(UUID id, T entity, String etag) throws OpenMetadataException {
    return update(id.toString(), entity, etag);
  }

  public T update(String id, T entity, String etag) throws OpenMetadataException {
    try {
      // First, analyze what fields are present in the entity being updated
      JsonNode updatedNode = objectMapper.valueToTree(entity);

      // Collect all field names from the update that might need special fetching
      // These are typically fields that are references or complex objects
      Set<String> fieldsToFetch = new HashSet<>();
      Iterator<String> fieldNames = updatedNode.fieldNames();

      while (fieldNames.hasNext()) {
        String fieldName = fieldNames.next();
        JsonNode fieldValue = updatedNode.get(fieldName);

        // Skip basic fields that are always returned
        if (!isBasicField(fieldName)) {
          // Check if it's a reference field (has id/type) or an array of references
          if (isReferenceField(fieldValue)) {
            fieldsToFetch.add(fieldName);
          }
        }
      }

      // Fetch the original from server with the same fields that are being updated
      T original;
      if (!fieldsToFetch.isEmpty()) {
        String fields = String.join(",", fieldsToFetch);
        original = get(id, fields);
      } else {
        // No special fields, just get basic entity
        original = get(id);
      }

      // Generate JSON Patch between original and updated
      String originalJson = objectMapper.writeValueAsString(original);
      String updatedJson = objectMapper.writeValueAsString(entity);

      JsonNode originalNode = objectMapper.readTree(originalJson);
      updatedNode = objectMapper.readTree(updatedJson);

      // Remove computed/read-only fields that cannot be patched
      removeComputedFields(originalNode);
      removeComputedFields(updatedNode);

      JsonNode patch = JsonDiff.asJson(originalNode, updatedNode);

      // Build request options with ETag if provided
      RequestOptions options = null;
      if (etag != null) {
        options = RequestOptions.builder().header("If-Match", etag).build();
      }

      // Send PATCH request with the JSON Patch document
      return httpClient.execute(
          HttpMethod.PATCH, basePath + "/" + id, patch, getEntityClass(), options);
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to update entity: " + e.getMessage(), e);
    }
  }

  private boolean isBasicField(String fieldName) {
    // These fields are always returned by default
    return Set.of(
            "id",
            "name",
            "fullyQualifiedName",
            "description",
            "displayName",
            "version",
            "updatedAt",
            "updatedBy",
            "href",
            "deleted")
        .contains(fieldName);
  }

  private boolean isReferenceField(JsonNode fieldValue) {
    if (fieldValue == null || fieldValue.isNull()) {
      return false;
    }

    // Check if it's an object with id/type (entity reference)
    if (fieldValue.isObject()) {
      return fieldValue.has("id") || fieldValue.has("type");
    }

    // Check if it's an array of references
    if (fieldValue.isArray() && fieldValue.size() > 0) {
      JsonNode firstElement = fieldValue.get(0);
      return firstElement.isObject() && (firstElement.has("id") || firstElement.has("type"));
    }

    return false;
  }

  private static final Set<String> COMPUTED_FIELDS =
      Set.of(
          "childrenCount",
          "userCount",
          "termCount",
          "usageCount",
          "changeDescription",
          "href",
          "usageSummary",
          "followers",
          "votes");

  private void removeComputedFields(JsonNode node) {
    if (node instanceof com.fasterxml.jackson.databind.node.ObjectNode objectNode) {
      for (String field : COMPUTED_FIELDS) {
        objectNode.remove(field);
      }
    }
  }

  public T patch(UUID id, JsonNode patchDocument) throws OpenMetadataException {
    return patch(id.toString(), patchDocument, null);
  }

  public T patch(String id, JsonNode patchDocument) throws OpenMetadataException {
    return patch(id, patchDocument, null);
  }

  public T patch(UUID id, JsonNode patchDocument, String etag) throws OpenMetadataException {
    return patch(id.toString(), patchDocument, etag);
  }

  public T patch(String id, JsonNode patchDocument, String etag) throws OpenMetadataException {
    // Build request options with ETag if provided
    RequestOptions options = null;
    if (etag != null) {
      options = RequestOptions.builder().header("If-Match", etag).build();
    }
    return httpClient.execute(
        HttpMethod.PATCH, basePath + "/" + id, patchDocument, getEntityClass(), options);
  }

  public void delete(UUID id) throws OpenMetadataException {
    delete(id.toString());
  }

  public void delete(String id) throws OpenMetadataException {
    httpClient.execute(HttpMethod.DELETE, basePath + "/" + id, null, Void.class);
  }

  public void delete(String id, Map<String, String> params) throws OpenMetadataException {
    if (params == null || params.isEmpty()) {
      delete(id);
    } else {
      RequestOptions options = RequestOptions.builder().queryParams(params).build();
      httpClient.execute(HttpMethod.DELETE, basePath + "/" + id, null, Void.class, options);
    }
  }

  public CompletableFuture<Void> deleteAsync(UUID id) {
    return deleteAsync(id.toString());
  }

  public CompletableFuture<Void> deleteAsync(String id) {
    return httpClient.executeAsync(HttpMethod.DELETE, basePath + "/" + id, null, Void.class);
  }

  public CompletableFuture<Void> deleteAsync(String id, Map<String, String> params) {
    RequestOptions options = RequestOptions.builder().queryParams(params).build();
    return httpClient.executeAsync(
        HttpMethod.DELETE, basePath + "/" + id, null, Void.class, options);
  }

  /**
   * Restore a soft-deleted entity
   */
  public T restore(UUID id) throws OpenMetadataException {
    return restore(id.toString());
  }

  /**
   * Restore a soft-deleted entity
   */
  public T restore(String id) throws OpenMetadataException {
    org.openmetadata.schema.api.data.RestoreEntity restoreEntity =
        new org.openmetadata.schema.api.data.RestoreEntity();
    restoreEntity.setId(java.util.UUID.fromString(id));
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/restore", restoreEntity, getEntityClass());
  }

  /**
   * Restore a soft-deleted entity (async)
   */
  public CompletableFuture<T> restoreAsync(UUID id) {
    return restoreAsync(id.toString());
  }

  /**
   * Restore a soft-deleted entity (async)
   */
  public CompletableFuture<T> restoreAsync(String id) {
    org.openmetadata.schema.api.data.RestoreEntity restoreEntity =
        new org.openmetadata.schema.api.data.RestoreEntity();
    restoreEntity.setId(java.util.UUID.fromString(id));
    return httpClient.executeAsync(
        HttpMethod.PUT, basePath + "/restore", restoreEntity, getEntityClass());
  }

  /**
   * Export entity data to CSV format.
   *
   * @param name Entity name or FQN
   * @return CSV string of exported data
   * @throws OpenMetadataException if export fails
   */
  public String exportCsv(String name) throws OpenMetadataException {
    return exportCsv(name, false);
  }

  /**
   * Export entity data to CSV format with optional recursive export.
   *
   * @param name Entity name or FQN
   * @param recursive If true, export will include child entities
   * @return CSV string of exported data
   * @throws OpenMetadataException if export fails
   */
  public String exportCsv(String name, boolean recursive) throws OpenMetadataException {
    String path = basePath + "/name/" + name + "/export";
    RequestOptions options =
        RequestOptions.builder().queryParam("recursive", String.valueOf(recursive)).build();
    return httpClient.executeForString(HttpMethod.GET, path, null, options);
  }

  /**
   * Export entity data to CSV format asynchronously.
   *
   * @param name Entity name or FQN
   * @return Response with export status/result
   * @throws OpenMetadataException if export fails
   */
  public String exportCsvAsync(String name) throws OpenMetadataException {
    return exportCsvAsync(name, false);
  }

  /**
   * Export entity data to CSV format asynchronously with optional recursive export.
   *
   * @param name Entity name or FQN
   * @param recursive If true, export will include child entities
   * @return Response with export status/result
   * @throws OpenMetadataException if export fails
   */
  public String exportCsvAsync(String name, boolean recursive) throws OpenMetadataException {
    String path = basePath + "/name/" + name + "/exportAsync";
    RequestOptions options =
        RequestOptions.builder().queryParam("recursive", String.valueOf(recursive)).build();
    return httpClient.executeForString(HttpMethod.GET, path, null, options);
  }

  /**
   * Import entity data from CSV format.
   *
   * @param name Entity name or FQN (container for import)
   * @param csvData CSV data to import
   * @return Import result as JSON string
   * @throws OpenMetadataException if import fails
   */
  public String importCsv(String name, String csvData) throws OpenMetadataException {
    return importCsv(name, csvData, true, false);
  }

  /**
   * Import entity data from CSV format.
   *
   * @param name Entity name or FQN (container for import)
   * @param csvData CSV data to import
   * @param dryRun If true, validate without actually importing
   * @return Import result as JSON string
   * @throws OpenMetadataException if import fails
   */
  public String importCsv(String name, String csvData, boolean dryRun)
      throws OpenMetadataException {
    return importCsv(name, csvData, dryRun, false);
  }

  /**
   * Import entity data from CSV format with full options.
   *
   * @param name Entity name or FQN (container for import)
   * @param csvData CSV data to import
   * @param dryRun If true, validate without actually importing
   * @param recursive If true, import child entities recursively
   * @return Import result as JSON string
   * @throws OpenMetadataException if import fails
   */
  public String importCsv(String name, String csvData, boolean dryRun, boolean recursive)
      throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder()
            .header("Content-Type", "text/plain; charset=UTF-8")
            .queryParam("dryRun", String.valueOf(dryRun))
            .queryParam("recursive", String.valueOf(recursive))
            .build();
    String path = basePath + "/name/" + name + "/import";
    return httpClient.executeForString(HttpMethod.PUT, path, csvData, options);
  }

  /**
   * Import entity data from CSV format asynchronously.
   *
   * @param name Entity name or FQN (container for import)
   * @param csvData CSV data to import
   * @return Import result as JSON string
   * @throws OpenMetadataException if import fails
   */
  public String importCsvAsync(String name, String csvData) throws OpenMetadataException {
    return importCsvAsync(name, csvData, false, false);
  }

  /**
   * Import entity data from CSV format asynchronously.
   *
   * @param name Entity name or FQN (container for import)
   * @param csvData CSV data to import
   * @param dryRun If true, validate without actually importing
   * @return Import result as JSON string
   * @throws OpenMetadataException if import fails
   */
  public String importCsvAsync(String name, String csvData, boolean dryRun)
      throws OpenMetadataException {
    return importCsvAsync(name, csvData, dryRun, false);
  }

  /**
   * Import entity data from CSV format asynchronously with full options.
   *
   * @param name Entity name or FQN (container for import)
   * @param csvData CSV data to import
   * @param dryRun If true, validate without actually importing
   * @param recursive If true, import child entities recursively
   * @return Import result as JSON string
   * @throws OpenMetadataException if import fails
   */
  public String importCsvAsync(String name, String csvData, boolean dryRun, boolean recursive)
      throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder()
            .header("Content-Type", "text/plain; charset=UTF-8")
            .queryParam("dryRun", String.valueOf(dryRun))
            .queryParam("recursive", String.valueOf(recursive))
            .build();
    String path = basePath + "/name/" + name + "/importAsync";
    return httpClient.executeForString(HttpMethod.PUT, path, csvData, options);
  }

  /**
   * Get the version history for an entity.
   * Returns EntityHistory containing list of all versions.
   *
   * @param id Entity ID
   * @return EntityHistory with list of versions
   * @throws OpenMetadataException if request fails
   */
  public EntityHistory getVersionList(UUID id) throws OpenMetadataException {
    return getVersionList(id.toString());
  }

  /**
   * Get the version history for an entity.
   * Returns EntityHistory containing list of all versions.
   *
   * @param id Entity ID as string
   * @return EntityHistory with list of versions
   * @throws OpenMetadataException if request fails
   */
  public EntityHistory getVersionList(String id) throws OpenMetadataException {
    String path = basePath + "/" + id + "/versions";
    return httpClient.execute(HttpMethod.GET, path, null, EntityHistory.class);
  }

  /**
   * Get a specific version of an entity.
   *
   * @param id Entity ID
   * @param version Version number (e.g., 0.1, 0.2, 1.0)
   * @return Entity at the specified version
   * @throws OpenMetadataException if request fails
   */
  public T getVersion(UUID id, Double version) throws OpenMetadataException {
    return getVersion(id.toString(), version);
  }

  /**
   * Get a specific version of an entity.
   *
   * @param id Entity ID as string
   * @param version Version number (e.g., 0.1, 0.2, 1.0)
   * @return Entity at the specified version
   * @throws OpenMetadataException if request fails
   */
  public T getVersion(String id, Double version) throws OpenMetadataException {
    String path = basePath + "/" + id + "/versions/" + version.toString();
    return httpClient.execute(HttpMethod.GET, path, null, getEntityClass());
  }

  /**
   * Get a specific version of an entity with specific fields.
   *
   * @param id Entity ID
   * @param version Version number (e.g., 0.1, 0.2, 1.0)
   * @param fields Comma-separated list of fields to include
   * @return Entity at the specified version with requested fields
   * @throws OpenMetadataException if request fails
   */
  public T getVersion(UUID id, Double version, String fields) throws OpenMetadataException {
    return getVersion(id.toString(), version, fields);
  }

  /**
   * Get a specific version of an entity with specific fields.
   *
   * @param id Entity ID as string
   * @param version Version number (e.g., 0.1, 0.2, 1.0)
   * @param fields Comma-separated list of fields to include
   * @return Entity at the specified version with requested fields
   * @throws OpenMetadataException if request fails
   */
  public T getVersion(String id, Double version, String fields) throws OpenMetadataException {
    String path = basePath + "/" + id + "/versions/" + version.toString();
    RequestOptions options = RequestOptions.builder().queryParam("fields", fields).build();
    return httpClient.execute(HttpMethod.GET, path, null, getEntityClass(), options);
  }

  protected abstract Class<T> getEntityClass();

  @SuppressWarnings("unchecked")
  protected Class<ListResponse<T>> getListResponseClass() {
    return (Class<ListResponse<T>>) (Class<?>) ListResponse.class;
  }
}
