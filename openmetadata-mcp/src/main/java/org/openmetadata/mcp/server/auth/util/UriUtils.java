package org.openmetadata.mcp.server.auth.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Utility class for URI operations.
 */
public class UriUtils {

  /** RFC 9207 authorization response issuer identifier parameter. */
  public static final String ISSUER_PARAM = "iss";

  // URI.getHost() keeps the brackets of an IPv6 literal.
  private static final Set<String> LOOPBACK_HOSTS = Set.of("localhost", "127.0.0.1", "[::1]");
  private static final Set<String> WEB_SCHEMES = Set.of("http", "https");

  public static boolean isLoopback(URI uri) {
    return uri.getHost() != null && LOOPBACK_HOSTS.contains(uri.getHost());
  }

  /**
   * True for an http(s) URI on another machine. Any client can register one, so an OAuth error is
   * never redirected to it automatically: the user gets a page with a link instead.
   * ADR:2026-11-02-mcp-authorization-errors-reach-a-remote-callback-through-a-link
   */
  public static boolean isRemoteWebUri(URI uri) {
    String scheme = uri.getScheme();
    return scheme != null
        && WEB_SCHEMES.contains(scheme.toLowerCase(Locale.ROOT))
        && !isLoopback(uri);
  }

  /**
   * What a page shows as the place the browser will be sent to. The client name is chosen by
   * whoever registered the client, so this is the one thing on the page the user can check.
   * Userinfo, path and query are left out because they can be made to look like a host. The raw
   * authority is used rather than {@link URI#getHost()}, which is null for hosts such as {@code
   * a_b.example} that a browser still navigates to.
   */
  public static String describeRedirectTarget(URI redirectUri) {
    final String authority = redirectUri.getRawAuthority();
    final String hostAndPort =
        authority == null ? "" : "//" + authority.substring(authority.lastIndexOf('@') + 1);
    return redirectUri.getScheme() + ":" + hostAndPort;
  }

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
   * Constructs an authorization response redirect URI, adding the RFC 9207 {@code iss} parameter.
   *
   * <p>RFC 9207 asks the authorization server to name itself in every authorization response, both
   * success and error. The client checks it before redeeming the code, so it cannot be tricked into
   * sending the code to a different authorization server. Under MCP protocol 2026-07-28 clients must
   * validate this parameter whenever it is present.
   *
   * @param redirectUriBase The base redirect URI.
   * @param params The authorization response parameters (code/state, or error parameters).
   * @param issuer The issuer identifier of this authorization server, or null if not resolved yet.
   * @return The constructed redirect URI.
   */
  public static String constructAuthorizationResponseUri(
      String redirectUriBase, Map<String, String> params, String issuer) {
    Map<String, String> paramsWithIssuer = new LinkedHashMap<>(params);
    if (!nullOrEmpty(issuer)) {
      paramsWithIssuer.put(ISSUER_PARAM, issuer);
    }
    return constructRedirectUri(redirectUriBase, paramsWithIssuer);
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
    String baseUrl = withoutTrailingSlash(issuerUrl.toString());

    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    return URI.create(baseUrl + path);
  }

  /**
   * The MCP base URL as configured may end in a slash, the way BASE_PATH is written. Every MCP
   * OAuth URL is built as baseUrl + "/mcp/...", so the slash has to go or it doubles.
   */
  public static String withoutTrailingSlash(final String url) {
    return url != null && url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
  }
}
