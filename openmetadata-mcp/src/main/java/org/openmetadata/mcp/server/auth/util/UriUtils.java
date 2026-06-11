package org.openmetadata.mcp.server.auth.util;

import java.net.URI;
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
    URI uri = URI.create(redirectUriBase);

    StringBuilder queryBuilder = new StringBuilder();
    String existingQuery = uri.getRawQuery();
    if (existingQuery != null && !existingQuery.isEmpty()) {
      queryBuilder.append(existingQuery);
    }

    String newParams =
        params.entrySet().stream()
            .filter(entry -> entry.getValue() != null)
            .map(
                entry ->
                    URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8)
                        + "="
                        + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
            .collect(Collectors.joining("&"));
    if (!newParams.isEmpty()) {
      if (queryBuilder.length() > 0) {
        queryBuilder.append("&");
      }
      queryBuilder.append(newParams);
    }

    // Reassemble the URI by string concatenation. The query is already percent-encoded above;
    // passing it through the multi-argument URI constructor would re-encode the '%' characters
    // (e.g. a base64 state "a==" -> "a%3D%3D" -> "a%253D%253D"), corrupting opaque values such as
    // the OAuth state and breaking clients that compare it byte-for-byte (e.g. VS Code loopback).
    String base = redirectUriBase;
    int fragmentIdx = base.indexOf('#');
    if (fragmentIdx >= 0) {
      base = base.substring(0, fragmentIdx);
    }
    int queryIdx = base.indexOf('?');
    if (queryIdx >= 0) {
      base = base.substring(0, queryIdx);
    }
    String fragment = uri.getRawFragment() != null ? "#" + uri.getRawFragment() : "";
    return queryBuilder.length() > 0 ? base + "?" + queryBuilder + fragment : base + fragment;
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

    if (!"https".equals(scheme)
        && !"localhost".equals(host)
        && !"127.0.0.1".equals(host)
        && !"::1".equals(host)) {
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
