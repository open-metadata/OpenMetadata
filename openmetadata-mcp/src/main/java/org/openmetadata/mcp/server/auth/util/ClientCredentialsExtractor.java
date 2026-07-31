package org.openmetadata.mcp.server.auth.util;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Extracts OAuth 2.0 client credentials from a request per RFC 6749 §2.3.1.
 *
 * <p>Supports both transport methods:
 * <ul>
 *   <li>{@code client_secret_basic} — HTTP Basic auth header (preferred per RFC).
 *   <li>{@code client_secret_post} — credentials in form body parameters.
 * </ul>
 *
 * <p>Per RFC 6749 §2.3.1, clients MUST NOT use more than one method per request, but several
 * widely deployed clients (notably the Databricks MCP Proxy) duplicate the same credentials in
 * both the Authorization header and the request body. Strict rejection blocks such clients
 * outright. This implementation therefore prefers the Basic header (treated as the authoritative
 * channel per RFC) and tolerates duplicate body parameters only when they exactly match the
 * header credentials. Mismatched credentials are still rejected as {@code invalid_request} since
 * they signal either a misconfiguration or an attempted credential confusion attack.
 */
public final class ClientCredentialsExtractor {

  private static final String BASIC_PREFIX = "Basic ";

  private ClientCredentialsExtractor() {}

  public record Credentials(String clientId, String clientSecret) {}

  /**
   * Extract client credentials from the request.
   *
   * @param request the HTTP request
   * @param bodyClientId value of the {@code client_id} form parameter (may be {@code null})
   * @param bodyClientSecret value of the {@code client_secret} form parameter (may be {@code null})
   * @return parsed credentials; {@code clientId} may be {@code null} when no credentials supplied
   * @throws InvalidClientCredentialsException when the Basic header is malformed or when body
   *     credentials are present and do not match the header credentials
   */
  public static Credentials extract(
      HttpServletRequest request, String bodyClientId, String bodyClientSecret)
      throws InvalidClientCredentialsException {
    String header = request.getHeader("Authorization");
    if (header == null || !header.regionMatches(true, 0, BASIC_PREFIX, 0, BASIC_PREFIX.length())) {
      return new Credentials(bodyClientId, bodyClientSecret);
    }

    Credentials headerCreds = decodeBasic(header.substring(BASIC_PREFIX.length()).trim());
    assertBodyMatchesHeader(headerCreds, bodyClientId, bodyClientSecret);
    return headerCreds;
  }

  private static void assertBodyMatchesHeader(
      Credentials headerCreds, String bodyClientId, String bodyClientSecret)
      throws InvalidClientCredentialsException {
    if (bodyClientId != null && !bodyClientId.equals(headerCreds.clientId())) {
      throw new InvalidClientCredentialsException(
          "client_id in request body does not match Authorization header");
    }
    if (bodyClientSecret != null && !bodyClientSecret.equals(headerCreds.clientSecret())) {
      throw new InvalidClientCredentialsException(
          "client_secret in request body does not match Authorization header");
    }
  }

  private static Credentials decodeBasic(String encoded) throws InvalidClientCredentialsException {
    if (encoded.isEmpty()) {
      throw new InvalidClientCredentialsException("Empty Basic authorization value");
    }

    byte[] decoded;
    try {
      decoded = Base64.getDecoder().decode(encoded);
    } catch (IllegalArgumentException e) {
      throw new InvalidClientCredentialsException("Malformed Base64 in Authorization header");
    }

    String credential = new String(decoded, StandardCharsets.UTF_8);
    int colonIndex = credential.indexOf(':');
    if (colonIndex < 0) {
      throw new InvalidClientCredentialsException(
          "Authorization header missing client_id:client_secret separator");
    }

    String clientId = urlDecode(credential.substring(0, colonIndex));
    String clientSecret = urlDecode(credential.substring(colonIndex + 1));

    if (clientId.isEmpty()) {
      throw new InvalidClientCredentialsException("Empty client_id in Authorization header");
    }

    return new Credentials(clientId, clientSecret);
  }

  // RFC 6749 §2.3.1: client_id and client_secret in Basic auth are
  // application/x-www-form-urlencoded encoded before Base64.
  private static String urlDecode(String value) throws InvalidClientCredentialsException {
    try {
      return URLDecoder.decode(value, StandardCharsets.UTF_8);
    } catch (IllegalArgumentException e) {
      throw new InvalidClientCredentialsException(
          "Malformed percent-encoding in Authorization header");
    }
  }

  public static class InvalidClientCredentialsException extends Exception {
    public InvalidClientCredentialsException(String message) {
      super(message);
    }
  }
}
