package org.openmetadata.mcp.server.auth.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.security.TokenAudience;

/** Validates RFC 8707 indicators for the single resource advertised by MCP discovery. */
@Slf4j
public final class McpResourceUri {

  public static final int MAX_RESOURCE_LENGTH = 2048;
  public static final String INVALID_TARGET_ERROR = "invalid_target";
  public static final String INVALID_TARGET_DESCRIPTION =
      "The requested resource is not valid for this server";

  private static final Pattern UNSUPPORTED_PATH = Pattern.compile("//|/\\.{1,2}(?:/|$)");
  private static final int MAX_PORT = 65535;

  private McpResourceUri() {}

  /**
   * Normalizes an HTTP(S) resource URI for exact comparison. Raw paths keep their case and
   * escaping, with a single trailing slash optional.
   */
  public static Optional<String> canonicalize(final String resource) {
    return parseUri(resource).flatMap(McpResourceUri::canonicalizeUri);
  }

  /** Returns whether the candidate and configured URIs are valid and name the same resource. */
  public static boolean matches(final String candidate, final String expectedResource) {
    final Optional<String> expected = canonicalize(expectedResource);
    return expected.isPresent() && matchesCanonical(candidate, expected.get());
  }

  /** The live issuer may change when the MCP base URL is reloaded. */
  public static TokenAudience tokenAudienceOf(final Supplier<String> issuer) {
    return TokenAudience.servedResourceNamedBy(audience -> matches(audience, issuer.get()));
  }

  /**
   * An omitted resource parameter remains valid for legacy clients. Every supplied value must
   * name the configured resource. Log the first mismatch so repeated values cannot flood one entry.
   */
  public static boolean validateRequested(
      final List<String> requestedValues, final String expectedResource, final String endpoint) {
    boolean valid = true;
    if (!nullOrEmpty(requestedValues)) {
      final Optional<String> expected = canonicalize(expectedResource);
      for (final String received : requestedValues) {
        if (expected.isEmpty() || !matchesCanonical(received, expected.get())) {
          LOG.warn(
              "Rejected MCP OAuth resource on {}. Expected '{}', received '{}'.",
              endpoint,
              describeForLogging(expectedResource),
              describeForLogging(received));
          valid = false;
          break;
        }
      }
    }
    return valid;
  }

  /** Keeps the URI components useful for diagnostics and redacts credential-bearing components. */
  public static String describeForLogging(final String resource) {
    return parseUri(resource)
        .filter(uri -> uri.getScheme() != null && uri.getRawAuthority() != null)
        .map(McpResourceUri::redactUri)
        .orElse(resource == null ? "<unset>" : "<invalid URI>");
  }

  private static String redactUri(final URI uri) {
    final String authority = uri.getRawAuthority();
    final String hostAndPort = authority.substring(authority.lastIndexOf('@') + 1);
    final String query = uri.getRawQuery() == null ? "" : "?[redacted]";
    final String fragment = uri.getRawFragment() == null ? "" : "#[redacted]";
    return uri.getScheme() + "://" + hostAndPort + uri.getRawPath() + query + fragment;
  }

  private static boolean matchesCanonical(final String candidate, final String expected) {
    return canonicalize(candidate).filter(expected::equals).isPresent();
  }

  private static Optional<URI> parseUri(final String raw) {
    Optional<URI> parsed = Optional.empty();
    if (raw != null
        && raw.length() <= MAX_RESOURCE_LENGTH
        && raw.codePoints().noneMatch(Character::isWhitespace)) {
      try {
        parsed = Optional.of(new URI(raw));
      } catch (URISyntaxException ignored) {
        // Its message contains the raw URI, which can include credentials.
      }
    }
    return parsed;
  }

  private static Optional<String> canonicalizeUri(final URI uri) {
    final String scheme = Objects.toString(uri.getScheme(), "").toLowerCase(Locale.ROOT);
    final int defaultPort =
        switch (scheme) {
          case "http" -> 80;
          case "https" -> 443;
          default -> -1;
        };
    return defaultPort != -1 && hasValidComponents(uri)
        ? Optional.of(normalizeUri(uri, scheme, defaultPort))
        : Optional.empty();
  }

  private static boolean hasValidComponents(final URI uri) {
    final int port = uri.getPort();
    return uri.getHost() != null
        && uri.getRawUserInfo() == null
        && uri.getRawQuery() == null
        && uri.getRawFragment() == null
        && !uri.getRawAuthority().endsWith(":")
        && (port == -1 || (port > 0 && port <= MAX_PORT))
        && !UNSUPPORTED_PATH.matcher(uri.getRawPath()).find();
  }

  private static String normalizeUri(final URI uri, final String scheme, final int defaultPort) {
    final int port = uri.getPort();
    final String portSuffix = port == -1 || port == defaultPort ? "" : ":" + port;
    final String path = uri.getRawPath();
    final String normalizedPath =
        path.length() > 1 && path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
    return scheme + "://" + uri.getHost().toLowerCase(Locale.ROOT) + portSuffix + normalizedPath;
  }
}
