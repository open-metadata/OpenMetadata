package org.openmetadata.mcp.server.auth.util;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Utility class for URI operations.
 */
public class UriUtils {

  /**
   * Constructs a redirect URI with query parameters.
   * @param redirectUriBase The base redirect URI.
   * @param params The parameters to add to the query string.
   * @return The constructed redirect URI.
   */
  public static String constructRedirectUri(String redirectUriBase, Map<String, String> params) {
    try {
      URI uri = new URI(redirectUriBase);

      // Get existing query
      String query = uri.getQuery();
      StringBuilder queryBuilder = new StringBuilder();

      // Append existing query parameters if any
      if (query != null && !query.isEmpty()) {
        queryBuilder.append(query);
        if (!params.isEmpty()) {
          queryBuilder.append("&");
        }
      }

      // Append new parameters
      if (!params.isEmpty()) {
        String newParams =
            params.entrySet().stream()
                .filter(entry -> entry.getValue() != null)
                .map(
                    entry ->
                        URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8)
                            + "="
                            + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        queryBuilder.append(newParams);
      }

      // Create new URI with updated query
      return new URI(
              uri.getScheme(),
              uri.getAuthority(),
              uri.getPath(),
              queryBuilder.toString(),
              uri.getFragment())
          .toString();
    } catch (URISyntaxException e) {
      throw new IllegalArgumentException("Invalid redirect URI: " + redirectUriBase, e);
    }
  }

  /**
   * Modify a URI's path using the provided mapper function.
   * @param uri The URI to modify
   * @param pathMapper Function to transform the path
   * @return The modified URI
   */
  public static URI modifyUriPath(URI uri, Function<String, String> pathMapper) {
    String path = uri.getPath();
    if (path == null) {
      path = "";
    }

    String newPath = pathMapper.apply(path);

    try {
      return new URI(
          uri.getScheme(),
          uri.getUserInfo(),
          uri.getHost(),
          uri.getPort(),
          newPath,
          uri.getQuery(),
          uri.getFragment());
    } catch (Exception e) {
      throw new IllegalArgumentException("Failed to modify URI path", e);
    }
  }

  /**
   * Validate that the issuer URL meets OAuth 2.0 requirements.
   * @param url The issuer URL to validate
   */
  public static void validateIssuerUrl(URI url) {
    // RFC 8414 requires HTTPS, but we allow localhost HTTP for testing
    String scheme = url.getScheme();
    String host = url.getHost();

    if (!"https".equals(scheme) && !"localhost".equals(host) && !host.startsWith("127.0.0.1")) {
      throw new IllegalArgumentException("Issuer URL must be HTTPS");
    }

    // No fragments or query parameters allowed
    if (url.getFragment() != null) {
      throw new IllegalArgumentException("Issuer URL must not have a fragment");
    }
    if (url.getQuery() != null) {
      throw new IllegalArgumentException("Issuer URL must not have a query string");
    }
  }

  /**
   * Build an endpoint URL by appending a path to the issuer URL.
   * @param issuerUrl The issuer URL
   * @param path The path to append
   * @return The endpoint URL
   */
  public static URI buildEndpointUrl(URI issuerUrl, String path) {
    String baseUrl = issuerUrl.toString();
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
    }

    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    return URI.create(baseUrl + path);
  }
}
