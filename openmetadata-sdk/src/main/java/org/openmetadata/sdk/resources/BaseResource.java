package org.openmetadata.sdk.resources;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.flipkart.zjsonpatch.JsonDiff;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

public abstract class BaseResource<T> {
  protected final HttpClient httpClient;
  protected final String basePath;
  protected final ObjectMapper objectMapper;

  private static final int MAX_SNAPSHOTS = 500;

  @SuppressWarnings("serial")
  private final Map<String, JsonNode> entitySnapshots =
      Collections.synchronizedMap(
          new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, JsonNode> eldest) {
              return size() > MAX_SNAPSHOTS;
            }
          });

  protected BaseResource(HttpClient httpClient, String basePath) {
    this.httpClient = httpClient;
    this.basePath = basePath;
    this.objectMapper = new ObjectMapper();
    // Use NON_NULL so partially populated entities don't serialize every unset field as null.
    this.objectMapper.setSerializationInclusion(
        com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
  }

  private void storeSnapshot(String id, T entity) {
    JsonNode node = objectMapper.valueToTree(entity);
    if (id != null) {
      entitySnapshots.put(id, node);
    } else if (node.has("id") && !node.get("id").isNull()) {
      entitySnapshots.put(node.get("id").asText(), node);
    }
  }

  private T fetchEntity(String id, String fields) throws OpenMetadataException {
    if (fields != null) {
      RequestOptions options = RequestOptions.builder().queryParam("fields", fields).build();
      return httpClient.execute(
          HttpMethod.GET, basePath + "/" + id, null, getEntityClass(), options);
    }
    return httpClient.execute(HttpMethod.GET, basePath + "/" + id, null, getEntityClass());
  }

  /**
   * When update() is called without a prior get(), we don't know caller intent for unloaded
   * fields. Restricting the diff scope avoids accidental remove ops for unrelated fields.
   */
  private void pruneFieldsNotPresentInUpdated(JsonNode originalNode, JsonNode updatedNode) {
    if (!(originalNode instanceof ObjectNode originalObj) || !updatedNode.isObject()) {
      return;
    }

    Iterator<String> names = originalObj.fieldNames();
    while (names.hasNext()) {
      String fieldName = names.next();
      if (!updatedNode.has(fieldName)) {
        names.remove();
        continue;
      }
      pruneFieldsNotPresentInUpdated(originalObj.get(fieldName), updatedNode.get(fieldName));
    }
  }

  public T create(T entity) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, entity, getEntityClass());
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

  public T getByName(String name) throws OpenMetadataException {
    T result =
        httpClient.execute(HttpMethod.GET, basePath + "/name/" + name, null, getEntityClass());
    storeSnapshot(null, result);
    return result;
  }

  public T getByName(String name, String fields) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParam("fields", fields).build();
    T result =
        httpClient.execute(
            HttpMethod.GET, basePath + "/name/" + name, null, getEntityClass(), options);
    storeSnapshot(null, result);
    return result;
  }

  public ListResponse<T> list() throws OpenMetadataException {
    return list(new ListParams());
  }

  public ListResponse<T> list(ListParams params) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParams(params.toQueryParams()).build();
    return httpClient.execute(HttpMethod.GET, basePath, null, getListResponseClass(), options);
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
      JsonNode updatedNode = objectMapper.valueToTree(entity);
      JsonNode originalNode = entitySnapshots.remove(id);

      if (originalNode == null) {
        // No caller snapshot available: fetch current state and constrain diff to explicit fields
        // to avoid accidental removals from partially populated update objects.
        T original = fetchEntity(id, null);
        originalNode = objectMapper.valueToTree(original);
        pruneFieldsNotPresentInUpdated(originalNode, updatedNode);
      }

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

  public T upsert(T entity) throws OpenMetadataException {
    // PUT without ID for create-or-update operations
    return httpClient.execute(HttpMethod.PUT, basePath, entity, getEntityClass());
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
    RequestOptions options = RequestOptions.builder().queryParams(params).build();
    httpClient.execute(HttpMethod.DELETE, basePath + "/" + id, null, Void.class, options);
  }

  protected abstract Class<T> getEntityClass();

  @SuppressWarnings("unchecked")
  protected Class<ListResponse<T>> getListResponseClass() {
    return (Class<ListResponse<T>>) (Class<?>) ListResponse.class;
  }
}
