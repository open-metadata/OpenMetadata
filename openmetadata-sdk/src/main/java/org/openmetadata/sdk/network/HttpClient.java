package org.openmetadata.sdk.network;

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
