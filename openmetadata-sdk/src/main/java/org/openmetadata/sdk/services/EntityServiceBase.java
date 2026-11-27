package org.openmetadata.sdk.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import okhttp3.HttpUrl;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonDiff;
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

  private static final int MAX_SNAPSHOTS = 500;
  private static final String TAGS = "tags";

  // Generated entities have mutable, value-based hash codes. Tag projections belong to an instance.
  private record TagOwner(Object entity) {
    @Override
    public boolean equals(Object other) {
      return other instanceof TagOwner owner && entity == owner.entity;
    }

    @Override
    public int hashCode() {
      return System.identityHashCode(entity);
    }
  }

  // The list carries its own baseline when another read or LRU eviction displaces the snapshot.
  private static final class FetchedTags extends ArrayList<TagLabel> {
    private JsonNode baseline;

    private FetchedTags(List<TagLabel> tags, JsonNode baseline) {
      super(tags == null ? List.of() : tags);
      this.baseline = baseline;
    }
  }

  /**
   * Stores JSON snapshots of entities returned by get() methods. When update() is called, the
   * snapshot serves as the baseline for JSON Patch diff generation. This allows the diff to
   * correctly detect field removals (fields set to null after fetching), which would otherwise be
   * invisible due to NON_NULL serialization omitting null fields.
   *
   * <p>Bounded to {@link #MAX_SNAPSHOTS} entries (LRU eviction) to prevent memory leaks in
   * long-running clients that fetch many entities without updating them.
   */
  private final Map<String, JsonNode> entitySnapshots = boundedSnapshots();

  // A caller can replace the fetched list with setTags(), losing the baseline carried by that list.
  private final Map<TagOwner, JsonNode> tagSnapshots = boundedSnapshots();

  @SuppressWarnings("serial")
  private static <K> Map<K, JsonNode> boundedSnapshots() {
    return Collections.synchronizedMap(
        new java.util.LinkedHashMap<>(16, 0.75f, true) {
          @Override
          protected boolean removeEldestEntry(Map.Entry<K, JsonNode> eldest) {
            return size() > MAX_SNAPSHOTS;
          }
        });
  }

  protected EntityServiceBase(HttpClient httpClient, String basePath) {
    this.httpClient = httpClient;
    this.basePath = basePath;
    this.objectMapper = new ObjectMapper();
    // Configure to exclude null values to avoid sending computed fields like childrenCount
    this.objectMapper.setSerializationInclusion(
        com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
  }

  private void storeSnapshot(String id, T entity) {
    JsonNode node = objectMapper.valueToTree(entity);
    if (entity instanceof EntityInterface<?> tagged) {
      rememberFetchedTags(tagged, node.get(TAGS));
    }
    String snapshotId = id == null ? node.path("id").asText(null) : id;
    if (snapshotId != null) {
      entitySnapshots.put(snapshotId, node);
    }
  }

  private void rememberFetchedTags(T entity) {
    if (entity instanceof EntityInterface<?> tagged) {
      rememberFetchedTags(tagged, objectMapper.valueToTree(tagged.getTags()));
    }
  }

  private void rememberFetchedTags(EntityInterface<?> tagged, JsonNode baseline) {
    JsonNode original =
        baseline != null && baseline.isArray() ? baseline : objectMapper.createArrayNode();
    tagged.setTags(new FetchedTags(tagged.getTags(), original));
    rememberPopulatedTags(tagged, original);
  }

  private void rememberPopulatedTags(EntityInterface<?> entity, JsonNode tags) {
    TagOwner owner = new TagOwner(entity);
    if (tags.isEmpty()) {
      tagSnapshots.remove(owner);
    } else {
      tagSnapshots.put(owner, tags);
    }
  }

  /** Fetch an entity by ID without storing a snapshot (for internal use in update fallback). */
  private T fetchEntity(String id, String fields) throws OpenMetadataException {
    if (fields != null) {
      RequestOptions options = RequestOptions.builder().queryParam("fields", fields).build();
      return httpClient.execute(
          HttpMethod.GET, basePath + "/" + id, null, getEntityClass(), options);
    }
    return httpClient.execute(HttpMethod.GET, basePath + "/" + id, null, getEntityClass());
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
    T result = httpClient.execute(HttpMethod.GET, basePath + "/" + id, null, getEntityClass());
    storeSnapshot(id, result);
    return result;
  }

  public T get(String id, String fields) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParam("fields", fields).build();
    T result =
        httpClient.execute(HttpMethod.GET, basePath + "/" + id, null, getEntityClass(), options);
    storeSnapshot(id, result);
    return result;
  }

  public T get(String id, String fields, String include) throws OpenMetadataException {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();
    if (fields != null) {
      optionsBuilder.queryParam("fields", fields);
    }
    if (include != null) {
      optionsBuilder.queryParam("include", include);
    }
    T result =
        httpClient.execute(
            HttpMethod.GET, basePath + "/" + id, null, getEntityClass(), optionsBuilder.build());
    storeSnapshot(id, result);
    return result;
  }

  /**
   * Retrieve the entity's AI Context (Context Profile) by id as an OKF-style markdown document: its
   * attached business knowledge (glossary terms, articles, applied metrics), type-specific
   * structural context, and depth-1 lineage, assembled for LLM consumption.
   */
  public String getContext(String id) throws OpenMetadataException {
    return httpClient.executeForString(HttpMethod.GET, basePath + "/" + id + "/context", null);
  }

  /** Retrieve the entity's AI Context by fully qualified name. See {@link #getContext(String)}. */
  public String getContextByName(String fqn) throws OpenMetadataException {
    return httpClient.executeForString(
        HttpMethod.GET, buildPathWithEncodedName(fqn) + "/context", null);
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

    T result = httpClient.execute(HttpMethod.GET, encodedPath, null, getEntityClass(), options);
    storeSnapshot(null, result);
    return result;
  }

  /**
   * Builds a properly encoded path for name-based endpoints.
   * Uses OkHttp's HttpUrl.Builder to ensure proper URL encoding of special characters,
   * similar to how Jersey WebTarget handles path parameters.
   *
   * @param name The entity name or FQN, which may contain quotes and special characters
   * @return The properly encoded path string
   */
  protected String buildPathWithEncodedName(String name) {
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
          rememberFetchedTags(item);
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

  /**
   * Updates a fetched entity using its original projection. With no known tag baseline, supplying
   * a nonempty tag list adds those labels, while an empty list clears them, including a detached
   * model's default empty list. To replace the full set, fetch with {@code fields=tags} before
   * editing, or use an explicit JSON Patch.
   */
  public T update(String id, T entity, String etag) throws OpenMetadataException {
    try {
      JsonNode updatedNode = objectMapper.valueToTree(entity);

      // Try to use a stored snapshot from a previous get() call as the baseline.
      // This correctly handles field removals: if a field was non-null when fetched
      // and the user set it to null, the snapshot still has the field but the updated
      // JSON (NON_NULL) omits it, producing a "remove" patch operation.
      JsonNode snapshot = entitySnapshots.get(id);
      JsonNode originalNode =
          snapshot == null ? fetchUpdateBaseline(id, entity, updatedNode) : snapshot.deepCopy();
      normalizeTagBaseline(entity, originalNode, updatedNode);

      // Remove computed/read-only fields that cannot be patched
      removeComputedFields(originalNode);
      removeComputedFields(updatedNode);
      normalizePatchNodes(originalNode, updatedNode, entity);

      ArrayNode patch = JsonDiff.of(originalNode, updatedNode);
      if (entity instanceof EntityInterface<?>) {
        patch = guardTagEdits(originalNode.path(TAGS), updatedNode.path(TAGS), patch);
      }

      RequestOptions options = null;
      if (etag != null) {
        options = RequestOptions.builder().header("If-Match", etag).build();
      }

      T saved =
          httpClient.execute(
              HttpMethod.PATCH, basePath + "/" + id, patch, getEntityClass(), options);
      entitySnapshots.remove(id, snapshot);
      if (saved != null) {
        boolean changedTags = !originalNode.path(TAGS).equals(updatedNode.path(TAGS));
        rememberFetchedTags(saved);
        if (changedTags && entity != saved) {
          rebaseSubmittedTags(entity, saved);
        }
      }
      return saved;
    } catch (Exception e) {
      throw new OpenMetadataException("Failed to update entity: " + e.getMessage(), e);
    }
  }

  private void rebaseSubmittedTags(T entity, T saved) {
    if (entity instanceof EntityInterface<?> submitted
        && saved instanceof EntityInterface<?> response
        && response.getTags() instanceof FetchedTags confirmed) {
      // PATCH returns the canonical tag order. Subsequent index edits must use that same order.
      List<TagLabel> labels =
          objectMapper.convertValue(confirmed.baseline, new TypeReference<>() {});
      if (submitted.getTags() instanceof FetchedTags previous) {
        previous.clear();
        previous.addAll(labels);
        previous.baseline = confirmed.baseline;
      } else {
        submitted.setTags(new FetchedTags(labels, confirmed.baseline));
      }
      rememberPopulatedTags(submitted, confirmed.baseline);
    }
  }

  private ArrayNode guardTagEdits(JsonNode before, JsonNode after, ArrayNode patch) {
    ArrayNode checks = objectMapper.createArrayNode();
    for (int index = 0; index < before.size(); index++) {
      JsonNode tag = before.get(index);
      if (!tag.equals(after.path(index))) {
        // A retry or concurrent removal can put another label at the same array index.
        for (String key : List.of("tagFQN", "source")) {
          checks
              .addObject()
              .put("op", "test")
              .put("path", "/tags/" + index + "/" + key)
              .set("value", tag.get(key));
        }
      }
    }
    return checks.isEmpty() ? patch : checks.addAll(patch);
  }

  private JsonNode fetchUpdateBaseline(String id, T entity, JsonNode updated) {
    Set<String> fields = new HashSet<>();
    updated
        .properties()
        .forEach(
            field -> {
              if (requiresFetch(entity, field.getKey(), field.getValue())) {
                fields.add(field.getKey());
              }
            });

    T stored = fetchEntity(id, fields.isEmpty() ? null : String.join(",", fields));
    return objectMapper.valueToTree(stored);
  }

  private boolean requiresFetch(T entity, String field, JsonNode value) {
    return !(TAGS.equals(field) && entity instanceof EntityInterface<?>)
        && !isBasicField(field)
        && (value.isNull() || (value.isArray() && value.isEmpty()) || isReferenceField(value));
  }

  private void normalizeTagBaseline(T entity, JsonNode original, JsonNode updated) {
    if (entity instanceof EntityInterface<?> tagged && original instanceof ObjectNode object) {
      List<TagLabel> tags = tagged.getTags();
      JsonNode baseline =
          tags instanceof FetchedTags fetched
              ? fetched.baseline
              : tagSnapshots.get(new TagOwner(entity));
      if (baseline != null) {
        object.set(TAGS, baseline);
      } else if (tags != null && !tags.isEmpty()) {
        // A copied, unchanged field needs no patch. Unknown additions must insert into the array.
        if (!updated.path(TAGS).equals(object.path(TAGS))) {
          object.putArray(TAGS);
        }
      } else {
        object.remove(TAGS);
      }
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

    boolean containsReference =
        fieldValue.isObject() && (fieldValue.has("id") || fieldValue.has("type"));
    if (!containsReference && fieldValue.isContainerNode()) {
      for (JsonNode child : fieldValue) {
        if (isReferenceField(child)) {
          containsReference = true;
          break;
        }
      }
    }
    return containsReference;
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

  protected void normalizePatchNodes(JsonNode originalNode, JsonNode updatedNode, T entity) {
    // Default no-op. Subclasses can normalize entity-specific response-only fields before diffing.
  }

  protected void removeField(JsonNode node, String fieldName) {
    if (node instanceof ObjectNode objectNode) {
      objectNode.remove(fieldName);
    }
  }

  private void removeComputedFields(JsonNode node) {
    for (String field : COMPUTED_FIELDS) {
      removeField(node, field);
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

  /**
   * Delete an entity by its fully qualified name, hitting the {@code DELETE
   * basePath/name/{fqn}} endpoint. Mirrors {@link #getByName(String)} routing and uses the same
   * path-encoding helper so FQNs with special characters are handled consistently. Query params
   * (e.g. {@code recursive}, {@code hardDelete}) are forwarded as-is.
   */
  public void deleteByName(String name) throws OpenMetadataException {
    httpClient.execute(HttpMethod.DELETE, buildPathWithEncodedName(name), null, Void.class);
  }

  public void deleteByName(String name, Map<String, String> params) throws OpenMetadataException {
    if (params == null || params.isEmpty()) {
      deleteByName(name);
    } else {
      RequestOptions options = RequestOptions.builder().queryParams(params).build();
      httpClient.execute(
          HttpMethod.DELETE, buildPathWithEncodedName(name), null, Void.class, options);
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
   * Restore a soft-deleted entity (client-side async wrapper).
   *
   * <p>Runs the synchronous restore call on the SDK's executor and returns a
   * {@link CompletableFuture}. The server still does the work synchronously inside the request,
   * so this still ties up an HTTP connection for the duration. For large hierarchies use
   * {@link #restoreServerAsync(String)} instead, which returns a 202 with a job id.
   */
  public CompletableFuture<T> restoreAsync(UUID id) {
    return restoreAsync(id.toString());
  }

  public CompletableFuture<T> restoreAsync(String id) {
    org.openmetadata.schema.api.data.RestoreEntity restoreEntity =
        new org.openmetadata.schema.api.data.RestoreEntity();
    restoreEntity.setId(java.util.UUID.fromString(id));
    return httpClient.executeAsync(
        HttpMethod.PUT, basePath + "/restore", restoreEntity, getEntityClass());
  }

  /**
   * Trigger a server-side async restore. Issues {@code PUT /restore?async=true} and returns
   * the 202 Accepted response containing the job id. Used to avoid proxy / ALB idle timeouts
   * on large hierarchies (issue #4003). The caller can await completion via the SDK's
   * WebSocketListener on the {@code restoreEntityChannel} channel.
   */
  public org.openmetadata.sdk.models.AsyncJobResponse restoreServerAsync(UUID id)
      throws OpenMetadataException {
    return restoreServerAsync(id.toString());
  }

  public org.openmetadata.sdk.models.AsyncJobResponse restoreServerAsync(String id)
      throws OpenMetadataException {
    org.openmetadata.schema.api.data.RestoreEntity restoreEntity =
        new org.openmetadata.schema.api.data.RestoreEntity();
    restoreEntity.setId(java.util.UUID.fromString(id));
    RequestOptions options = RequestOptions.builder().queryParam("async", "true").build();
    org.openmetadata.sdk.models.AsyncJobResponse response =
        httpClient.execute(
            HttpMethod.PUT,
            basePath + "/restore",
            restoreEntity,
            org.openmetadata.sdk.models.AsyncJobResponse.class,
            options);
    // Defensive check for older servers that don't honor ?async=true (or for any future
    // case where the resource short-circuits with a 200 + entity payload). Jackson would
    // otherwise silently deserialize the entity JSON into an AsyncJobResponse with all
    // null fields and callers would treat a sync restore as a dispatched async job.
    if (response == null || response.getJobId() == null || response.getJobId().isEmpty()) {
      throw new OpenMetadataException(
          "Server did not return an async job for "
              + basePath
              + "/restore. The server may be older than the async-restore release.");
    }
    return response;
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
