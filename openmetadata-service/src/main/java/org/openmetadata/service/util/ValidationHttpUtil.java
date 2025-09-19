/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

/**
 * Common HTTP utility class for SSO authentication validators.
 * Provides standardized HTTP request methods to avoid code duplication
 * across different authentication provider validators.
 */
@Slf4j
public class ValidationHttpUtil {

  private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(15);
  private static final HttpClient DEFAULT_CLIENT = createHttpClient(DEFAULT_TIMEOUT);

  /**
   * Simple container for HTTP response data
   */
  public static class HttpResponseData {
    private final int statusCode;
    private final String body;

    public HttpResponseData(int statusCode, String body) {
      this.statusCode = statusCode;
      this.body = body != null ? body : "";
    }

    public int getStatusCode() {
      return statusCode;
    }

    public String getBody() {
      return body;
    }
  }

  /**
   * Creates an HTTP client with specified timeout
   */
  private static HttpClient createHttpClient(Duration timeout) {
    return HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(timeout)
        .followRedirects(HttpClient.Redirect.NEVER)
        .build();
  }

  /**
   * Makes a GET request to the specified URL
   *
   * @param url Target URL
   * @return HttpResponseData containing status code and body
   * @throws IOException If request fails
   * @throws InterruptedException If request is interrupted
   */
  public static HttpResponseData get(String url) throws IOException, InterruptedException {
    return get(url, Map.of());
  }

  /**
   * Makes a GET request with custom headers
   *
   * @param url Target URL
   * @param headers Custom headers
   * @return HttpResponseData containing status code and body
   * @throws IOException If request fails
   * @throws InterruptedException If request is interrupted
   */
  public static HttpResponseData get(String url, Map<String, String> headers)
      throws IOException, InterruptedException {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder().uri(URI.create(url)).timeout(DEFAULT_TIMEOUT).GET();

    // Add custom headers
    headers.forEach(builder::header);

    HttpRequest request = builder.build();
    HttpResponse<String> response =
        DEFAULT_CLIENT.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

    return new HttpResponseData(response.statusCode(), response.body());
  }

  /**
   * Makes a GET request that doesn't follow redirects
   *
   * @param url Target URL
   * @return HttpResponseData containing status code and body
   * @throws IOException If request fails
   * @throws InterruptedException If request is interrupted
   */
  public static HttpResponseData getNoRedirect(String url)
      throws IOException, InterruptedException {
    return getNoRedirect(url, Map.of());
  }

  /**
   * Makes a GET request with custom headers that doesn't follow redirects
   *
   * @param url Target URL
   * @param headers Custom headers
   * @return HttpResponseData containing status code and body
   * @throws IOException If request fails
   * @throws InterruptedException If request is interrupted
   */
  public static HttpResponseData getNoRedirect(String url, Map<String, String> headers)
      throws IOException, InterruptedException {
    // Use the default client which already has NEVER redirect policy
    return get(url, headers);
  }

  /**
   * Makes a POST request with form data
   *
   * @param url Target URL
   * @param formData Form data to send
   * @return HttpResponseData containing status code and body
   * @throws IOException If request fails
   * @throws InterruptedException If request is interrupted
   */
  public static HttpResponseData postForm(String url, String formData)
      throws IOException, InterruptedException {
    return postForm(url, formData, Map.of());
  }

  /**
   * Makes a POST request with form data and custom headers
   *
   * @param url Target URL
   * @param formData Form data to send
   * @param headers Custom headers
   * @return HttpResponseData containing status code and body
   * @throws IOException If request fails
   * @throws InterruptedException If request is interrupted
   */
  public static HttpResponseData postForm(String url, String formData, Map<String, String> headers)
      throws IOException, InterruptedException {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(DEFAULT_TIMEOUT)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(formData, StandardCharsets.UTF_8));

    // Add custom headers
    headers.forEach(builder::header);

    HttpRequest request = builder.build();
    HttpResponse<String> response =
        DEFAULT_CLIENT.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

    return new HttpResponseData(response.statusCode(), response.body());
  }

  /**
   * Makes a POST request with JSON data
   *
   * @param url Target URL
   * @param jsonData JSON data to send
   * @return HttpResponseData containing status code and body
   * @throws IOException If request fails
   * @throws InterruptedException If request is interrupted
   */
  public static HttpResponseData postJson(String url, String jsonData)
      throws IOException, InterruptedException {
    return postJson(url, jsonData, Map.of());
  }

  /**
   * Makes a POST request with JSON data and custom headers
   *
   * @param url Target URL
   * @param jsonData JSON data to send
   * @param headers Custom headers
   * @return HttpResponseData containing status code and body
   * @throws IOException If request fails
   * @throws InterruptedException If request is interrupted
   */
  public static HttpResponseData postJson(String url, String jsonData, Map<String, String> headers)
      throws IOException, InterruptedException {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(DEFAULT_TIMEOUT)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonData, StandardCharsets.UTF_8));

    // Add custom headers
    headers.forEach(builder::header);

    HttpRequest request = builder.build();
    HttpResponse<String> response =
        DEFAULT_CLIENT.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

    return new HttpResponseData(response.statusCode(), response.body());
  }

  /**
   * Creates a Basic Authentication header value
   *
   * @param username Username
   * @param password Password
   * @return Basic authentication header value
   */
  public static String createBasicAuthHeader(String username, String password) {
    String credentials = username + ":" + password;
    return "Basic "
        + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
  }

  /**
   * Creates a Bearer token header value
   *
   * @param token Bearer token
   * @return Bearer token header value
   */
  public static String createBearerAuthHeader(String token) {
    return "Bearer " + token;
  }

  /**
   * Validates URL format and prevents SSRF attacks by delegating to existing URLValidator
   *
   * @param url URL to validate
   * @throws IllegalArgumentException if URL is invalid or potentially unsafe
   */
  public static void validateUrl(String url) {
    try {
      URLValidator.validateURL(url);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid or unsafe URL: " + url, e);
    }
  }

  /**
   * Makes a safe HTTP GET request with URL validation
   *
   * @param url Target URL
   * @return HttpResponseData containing status code and body
   * @throws IOException If request fails
   * @throws InterruptedException If request is interrupted
   * @throws IllegalArgumentException If URL is invalid
   */
  public static HttpResponseData safeGet(String url) throws IOException, InterruptedException {
    validateUrl(url);
    return get(url);
  }

  /**
   * Makes a safe HTTP GET request with URL validation and custom headers
   *
   * @param url Target URL
   * @param headers Custom headers
   * @return HttpResponseData containing status code and body
   * @throws IOException If request fails
   * @throws InterruptedException If request is interrupted
   * @throws IllegalArgumentException If URL is invalid
   */
  public static HttpResponseData safeGet(String url, Map<String, String> headers)
      throws IOException, InterruptedException {
    validateUrl(url);
    return get(url, headers);
  }
}
