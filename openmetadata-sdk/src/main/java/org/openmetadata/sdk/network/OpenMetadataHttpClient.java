package org.openmetadata.sdk.network;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.AuthenticationException;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.exceptions.RateLimitException;
import org.openmetadata.sdk.models.ErrorResponse;

public class OpenMetadataHttpClient implements HttpClient {
  private static final MediaType JSON_MEDIA_TYPE =
      MediaType.parse("application/json; charset=utf-8");
  private static final MediaType JSON_PATCH_MEDIA_TYPE =
      MediaType.parse("application/json-patch+json; charset=utf-8");
  private final OkHttpClient okHttpClient;
  private final ObjectMapper objectMapper;
  private final OpenMetadataConfig config;

  public OpenMetadataHttpClient(OpenMetadataConfig config) {
    this.config = config;
    this.objectMapper =
        new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    OkHttpClient.Builder builder =
        new OkHttpClient.Builder()
            .connectTimeout(config.getConnectTimeout(), TimeUnit.MILLISECONDS)
            .readTimeout(config.getReadTimeout(), TimeUnit.MILLISECONDS)
            .writeTimeout(config.getWriteTimeout(), TimeUnit.MILLISECONDS);

    this.okHttpClient = builder.build();
  }

  @Override
  public <T> T execute(HttpMethod method, String path, Object requestBody, Class<T> responseClass)
      throws OpenMetadataException {
    return execute(method, path, requestBody, responseClass, null);
  }

  @Override
  public <T> T execute(
      HttpMethod method,
      String path,
      Object requestBody,
      Class<T> responseClass,
      RequestOptions options)
      throws OpenMetadataException {
    Request request = buildRequest(method, path, requestBody, options);

    try (Response response = okHttpClient.newCall(request).execute()) {
      return handleResponse(response, responseClass);
    } catch (IOException e) {
      throw new OpenMetadataException("Network error: " + e.getMessage(), e);
    }
  }

  @Override
  public <T> CompletableFuture<T> executeAsync(
      HttpMethod method, String path, Object requestBody, Class<T> responseClass) {
    return executeAsync(method, path, requestBody, responseClass, null);
  }

  @Override
  public <T> CompletableFuture<T> executeAsync(
      HttpMethod method,
      String path,
      Object requestBody,
      Class<T> responseClass,
      RequestOptions options) {
    CompletableFuture<T> future = new CompletableFuture<>();
    Request request = buildRequest(method, path, requestBody, options);

    okHttpClient
        .newCall(request)
        .enqueue(
            new Callback() {
              @Override
              public void onFailure(Call call, IOException e) {
                future.completeExceptionally(
                    new OpenMetadataException("Network error: " + e.getMessage(), e));
              }

              @Override
              public void onResponse(Call call, Response response) throws IOException {
                try (response) {
                  T result = handleResponse(response, responseClass);
                  future.complete(result);
                } catch (Exception e) {
                  future.completeExceptionally(e);
                }
              }
            });

    return future;
  }

  @Override
  public String executeForString(HttpMethod method, String path, Object requestBody)
      throws OpenMetadataException {
    return executeForString(method, path, requestBody, null);
  }

  @Override
  public String executeForString(
      HttpMethod method, String path, Object requestBody, RequestOptions options)
      throws OpenMetadataException {
    Request request = buildRequest(method, path, requestBody, options);

    try (Response response = okHttpClient.newCall(request).execute()) {
      return handleStringResponse(response);
    } catch (IOException e) {
      throw new OpenMetadataException("Network error: " + e.getMessage(), e);
    }
  }

  @Override
  public CompletableFuture<String> executeForStringAsync(
      HttpMethod method, String path, Object requestBody) {
    return executeForStringAsync(method, path, requestBody, null);
  }

  @Override
  public CompletableFuture<String> executeForStringAsync(
      HttpMethod method, String path, Object requestBody, RequestOptions options) {
    CompletableFuture<String> future = new CompletableFuture<>();
    Request request = buildRequest(method, path, requestBody, options);

    okHttpClient
        .newCall(request)
        .enqueue(
            new Callback() {
              @Override
              public void onFailure(Call call, IOException e) {
                future.completeExceptionally(
                    new OpenMetadataException("Network error: " + e.getMessage(), e));
              }

              @Override
              public void onResponse(Call call, Response response) throws IOException {
                try (response) {
                  String result = handleStringResponse(response);
                  future.complete(result);
                } catch (Exception e) {
                  future.completeExceptionally(e);
                }
              }
            });

    return future;
  }

  private Request buildRequest(
      HttpMethod method, String path, Object requestBody, RequestOptions options) {
    HttpUrl.Builder urlBuilder = HttpUrl.parse(config.getBaseUrl() + path).newBuilder();

    // Add query parameters
    if (options != null && options.getQueryParams() != null) {
      for (Map.Entry<String, String> entry : options.getQueryParams().entrySet()) {
        urlBuilder.addQueryParameter(entry.getKey(), entry.getValue());
      }
    }

    Request.Builder requestBuilder = new Request.Builder().url(urlBuilder.build());

    // Add headers from config
    for (Map.Entry<String, String> entry : config.getHeaders().entrySet()) {
      requestBuilder.addHeader(entry.getKey(), entry.getValue());
    }

    // Add authorization header
    if (config.getAccessToken() != null) {
      if (config.isTestMode()) {
        // In test mode, send the email in X-Auth-Params-Email header
        requestBuilder.addHeader("X-Auth-Params-Email", config.getAccessToken());
      } else {
        // In production mode, use Bearer token
        requestBuilder.addHeader("Authorization", "Bearer " + config.getAccessToken());
      }
    }

    // Add headers from options
    if (options != null && options.getHeaders() != null) {
      for (Map.Entry<String, String> entry : options.getHeaders().entrySet()) {
        requestBuilder.addHeader(entry.getKey(), entry.getValue());
      }
    }

    // Set request body and method
    RequestBody body = null;
    if (requestBody != null) {
      // Check if this is a string request (for CSV import, etc.)
      if (requestBody instanceof String) {
        String stringBody = (String) requestBody;
        String contentType = "text/plain";
        // Check if options has a specific Content-Type
        if (options != null && options.getHeaders() != null) {
          contentType = options.getHeaders().getOrDefault("Content-Type", contentType);
        }
        // If no explicit content type and the string looks like JSON, use application/json
        if (contentType.equals("text/plain") && stringBody.length() > 0) {
          char firstChar = stringBody.trim().charAt(0);
          if (firstChar == '{' || firstChar == '[') {
            contentType = "application/json; charset=utf-8";
          }
        }
        body = RequestBody.create(stringBody, MediaType.parse(contentType));
      } else {
        try {
          String jsonBody = objectMapper.writeValueAsString(requestBody);
          // Use JSON Patch media type for PATCH requests with JsonNode
          if (method == HttpMethod.PATCH && requestBody instanceof JsonNode) {
            body = RequestBody.create(jsonBody, JSON_PATCH_MEDIA_TYPE);
          } else {
            body = RequestBody.create(jsonBody, JSON_MEDIA_TYPE);
          }
        } catch (JsonProcessingException e) {
          throw new InvalidRequestException(
              "Failed to serialize request body: " + e.getMessage(), e);
        }
      }
    } else if (method == HttpMethod.POST
        || method == HttpMethod.PUT
        || method == HttpMethod.PATCH) {
      body = RequestBody.create("", JSON_MEDIA_TYPE);
    }

    requestBuilder.method(method.name(), body);

    return requestBuilder.build();
  }

  private <T> T handleResponse(Response response, Class<T> responseClass)
      throws OpenMetadataException {
    if (response.isSuccessful()) {
      if (responseClass == Void.class || responseClass == void.class) {
        return null;
      }

      ResponseBody responseBody = response.body();
      if (responseBody == null) {
        return null;
      }

      try {
        String responseString = responseBody.string();
        if (responseString.isEmpty()) {
          return null;
        }
        return objectMapper.readValue(responseString, responseClass);
      } catch (IOException e) {
        throw new OpenMetadataException("Failed to parse response: " + e.getMessage(), e);
      }
    } else {
      handleErrorResponse(response);
      return null; // This line will never be reached due to exception
    }
  }

  private String handleStringResponse(Response response) throws OpenMetadataException {
    if (response.isSuccessful()) {
      ResponseBody responseBody = response.body();
      if (responseBody == null) {
        return null;
      }

      try {
        return responseBody.string();
      } catch (IOException e) {
        throw new OpenMetadataException("Failed to read response: " + e.getMessage(), e);
      }
    } else {
      handleErrorResponse(response);
      return null; // This line will never be reached due to exception
    }
  }

  private void handleErrorResponse(Response response) throws OpenMetadataException {
    int statusCode = response.code();
    String responseBodyString = null;

    try {
      ResponseBody responseBody = response.body();
      if (responseBody != null) {
        responseBodyString = responseBody.string();
      }
    } catch (IOException e) {
      // Ignore, we'll use the status code and message
    }

    // Try to parse error response
    String errorMessage = "HTTP " + statusCode + ": " + response.message();
    if (responseBodyString != null && !responseBodyString.isEmpty()) {
      try {
        ErrorResponse errorResponse =
            objectMapper.readValue(responseBodyString, ErrorResponse.class);
        if (errorResponse.getMessage() != null) {
          errorMessage = errorResponse.getMessage();
        }
      } catch (JsonProcessingException e) {
        // Use the raw response body as the error message
        errorMessage = responseBodyString;
      }
    }

    // Throw appropriate exception based on status code
    switch (statusCode) {
      case 400:
        throw new InvalidRequestException(errorMessage, (String) null, responseBodyString);
      case 401:
        throw new AuthenticationException(errorMessage);
      case 409:
        throw new ConflictException(errorMessage);
      case 429:
        String retryAfter = response.header("Retry-After");
        long retryAfterSeconds = retryAfter != null ? Long.parseLong(retryAfter) : -1;
        throw new RateLimitException(errorMessage, retryAfterSeconds);
      default:
        throw new ApiException(errorMessage, statusCode, responseBodyString);
    }
  }
}
