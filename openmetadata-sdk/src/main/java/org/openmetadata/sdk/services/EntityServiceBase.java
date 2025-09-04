package org.openmetadata.sdk.services;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

public abstract class EntityServiceBase<T> {
  protected final HttpClient httpClient;
  protected final String basePath;

  protected EntityServiceBase(HttpClient httpClient, String basePath) {
    this.httpClient = httpClient;
    this.basePath = basePath;
  }

  public T create(T entity) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, entity, getEntityClass());
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

  public T getByName(String name) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.GET, basePath + "/name/" + name, null, getEntityClass());
  }

  public T getByName(String name, String fields) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParam("fields", fields).build();
    return httpClient.execute(
        HttpMethod.GET, basePath + "/name/" + name, null, getEntityClass(), options);
  }

  public ListResponse<T> list() throws OpenMetadataException {
    return list(new ListParams());
  }

  public ListResponse<T> list(ListParams params) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParams(params.toQueryParams()).build();
    return httpClient.execute(HttpMethod.GET, basePath, null, getListResponseClass(), options);
  }

  public T update(UUID id, T entity) throws OpenMetadataException {
    return update(id.toString(), entity);
  }

  public T update(String id, T entity) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath + "/" + id, entity, getEntityClass());
  }

  public T patch(UUID id, T entity) throws OpenMetadataException {
    return patch(id.toString(), entity);
  }

  public T patch(String id, T entity) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PATCH, basePath + "/" + id, entity, getEntityClass());
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

  public String exportCsv() throws OpenMetadataException {
    return httpClient.executeForString(HttpMethod.GET, basePath + "/export", null);
  }

  public String exportCsv(String name) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParam("name", name).build();
    return httpClient.executeForString(HttpMethod.GET, basePath + "/export", null, options);
  }

  public String importCsv(String csvData) throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().header("Content-Type", "text/plain").build();
    return httpClient.executeForString(HttpMethod.PUT, basePath + "/import", csvData, options);
  }

  public String importCsv(String csvData, boolean dryRun) throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder()
            .header("Content-Type", "text/plain")
            .queryParam("dryRun", String.valueOf(dryRun))
            .build();
    return httpClient.executeForString(HttpMethod.PUT, basePath + "/import", csvData, options);
  }

  protected abstract Class<T> getEntityClass();

  @SuppressWarnings("unchecked")
  protected Class<ListResponse<T>> getListResponseClass() {
    return (Class<ListResponse<T>>) (Class<?>) ListResponse.class;
  }
}
