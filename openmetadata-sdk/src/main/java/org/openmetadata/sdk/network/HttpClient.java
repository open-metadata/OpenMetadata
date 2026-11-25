package org.openmetadata.sdk.network;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JavaType;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

public interface HttpClient {
  <T> T execute(HttpMethod method, String path, Object requestBody, Class<T> responseClass)
      throws OpenMetadataException;

  <T> T execute(
      HttpMethod method,
      String path,
      Object requestBody,
      Class<T> responseClass,
      RequestOptions options)
      throws OpenMetadataException;

  default <T> T executeForType(
      HttpMethod method, String path, Object requestBody, JavaType responseType)
      throws OpenMetadataException {
    return executeForType(method, path, requestBody, responseType, null);
  }

  default <T> T executeForType(
      HttpMethod method,
      String path,
      Object requestBody,
      JavaType responseType,
      RequestOptions options)
      throws OpenMetadataException {
    Objects.requireNonNull(responseType, "responseType must not be null");
    String responseString = executeForString(method, path, requestBody, options);
    return OpenMetadataHttpClient.readValue(responseString, responseType);
  }

  default <T> T executeForType(
      HttpMethod method, String path, Object requestBody, TypeReference<T> responseType)
      throws OpenMetadataException {
    return executeForType(method, path, requestBody, responseType, null);
  }

  default <T> T executeForType(
      HttpMethod method,
      String path,
      Object requestBody,
      TypeReference<T> responseType,
      RequestOptions options)
      throws OpenMetadataException {
    JavaType javaType = OpenMetadataHttpClient.constructType(responseType);
    return executeForType(method, path, requestBody, javaType, options);
  }

  <T> CompletableFuture<T> executeAsync(
      HttpMethod method, String path, Object requestBody, Class<T> responseClass);

  <T> CompletableFuture<T> executeAsync(
      HttpMethod method,
      String path,
      Object requestBody,
      Class<T> responseClass,
      RequestOptions options);

  String executeForString(HttpMethod method, String path, Object requestBody)
      throws OpenMetadataException;

  String executeForString(
      HttpMethod method, String path, Object requestBody, RequestOptions options)
      throws OpenMetadataException;

  CompletableFuture<String> executeForStringAsync(
      HttpMethod method, String path, Object requestBody);

  CompletableFuture<String> executeForStringAsync(
      HttpMethod method, String path, Object requestBody, RequestOptions options);
}
