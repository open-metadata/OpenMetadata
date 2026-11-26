package org.openmetadata.mcp.server.auth.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import org.openmetadata.service.security.TokenAudience;

/**
 * Validates and canonicalizes RFC 8707 resource indicators for MCP OAuth.
 *
 * <p>Only absolute, hierarchical {@code http}/{@code https} URIs without userinfo, query,
 * fragment, dangling port colons, invalid port numbers, dot-segments, or repeated slashes are
 * accepted. Scheme and host fold case using {@link Locale#ROOT}; explicit default ports ({@code
 * :80} for {@code http}, {@code :443} for {@code https}) are removed; raw paths are compared
 * case-sensitively without percent-decoding, allowing at most one trailing slash when the path has
 * more than one character.
 */
public final class McpResourceUri {

  public static final int MAX_RESOURCE_LENGTH = 2048;
  public static final String INVALID_TARGET_ERROR = "invalid_target";
  public static final String INVALID_TARGET_DESCRIPTION =
      "The requested resource is not valid for this server";

  private static final String HTTP_SCHEME = "http";
  private static final String HTTPS_SCHEME = "https";
  private static final int DEFAULT_HTTP_PORT = 80;
  private static final int DEFAULT_HTTPS_PORT = 443;
  private static final int MIN_PORT = 1;
  private static final int MAX_PORT = 65535;
  private static final Set<String> ALLOWED_SCHEMES = Set.of(HTTP_SCHEME, HTTPS_SCHEME);

  private record CanonicalAuthority(String host, int port) {}

  private McpResourceUri() {}

  /**
   * Parses and canonicalizes a raw RFC 8707 resource indicator.
   *
   * @param raw the untrusted resource URI string
   * @return the canonical URI if valid, or empty otherwise
   */
  public static Optional<URI> parseValid(final String raw) {
    if (!isSyntaxCandidate(raw)) {
      return Optional.empty();
    }
    final URI parsed = parseUri(raw);
    return parsed == null ? Optional.empty() : canonicalizeParsed(parsed);
  }

  /**
   * Canonicalizes an already-constructed {@link URI} using the same RFC 8707 validation rules.
   *
   * @param uri the URI to canonicalize
   * @return the canonical URI if valid, or empty when {@code uri} is null or invalid
   */
  public static Optional<URI> canonicalize(final URI uri) {
    return uri == null ? Optional.empty() : parseValid(uri.toString());
  }

  /**
   * Returns true if {@code candidate} is a valid RFC 8707 resource URI matching {@code
   * expectedCanonical}. Fails closed when {@code expectedCanonical} is null or invalid.
   */
  public static boolean matches(final String candidate, final URI expectedCanonical) {
    final Optional<URI> expected = canonicalize(expectedCanonical);
    return expected.isPresent() && matchesCanonical(candidate, expected.get());
  }

  /**
   * The audience rule of an entry point serving {@code resource}, read on every check because a
   * base URL reload moves it: an {@code aud} value names it when it {@link #matches} the current
   * value, and nothing names it while the resource is unresolved.
   */
  public static TokenAudience tokenAudienceOf(final Supplier<URI> resource) {
    return TokenAudience.servedResourceNamedBy(audience -> matches(audience, resource.get()));
  }

  /**
   * Validates all {@code resource} parameter values supplied on an authorization or token request.
   *
   * <p>An absent parameter ({@code null} or empty list) is accepted for backward compatibility with
   * MCP clients that omit {@code resource}. When one or more values are present, every value must
   * be a valid RFC 8707 URI matching {@code expectedCanonical}; a {@code null} expected URI fails
   * closed.
   */
  public static boolean validateRequested(
      final List<String> requestedValues, final URI expectedCanonical) {
    if (nullOrEmpty(requestedValues)) {
      return true;
    }
    final Optional<URI> expected = canonicalize(expectedCanonical);
    if (expected.isEmpty()) {
      return false;
    }
    for (final String value : requestedValues) {
      if (!matchesCanonical(value, expected.get())) {
        return false;
      }
    }
    return true;
  }

  private static boolean matchesCanonical(final String candidate, final URI canonicalExpected) {
    final Optional<URI> parsed = parseValid(candidate);
    return parsed.isPresent() && parsed.get().toString().equals(canonicalExpected.toString());
  }

  private static boolean isSyntaxCandidate(final String raw) {
    return raw != null
        && !raw.isEmpty()
        && raw.length() <= MAX_RESOURCE_LENGTH
        && raw.codePoints().noneMatch(Character::isWhitespace);
  }

  private static URI parseUri(final String raw) {
    try {
      return new URI(raw);
    } catch (URISyntaxException e) {
      return null;
    }
  }

  private static Optional<URI> canonicalizeParsed(final URI uri) {
    if (!uri.isAbsolute() || uri.isOpaque() || hasForbiddenComponents(uri)) {
      return Optional.empty();
    }
    final String scheme = normalizeScheme(uri.getScheme());
    if (scheme == null) {
      return Optional.empty();
    }
    final Optional<CanonicalAuthority> authority = canonicalizeAuthority(uri, scheme);
    final Optional<String> rawPath = canonicalizeRawPath(uri.getRawPath());
    if (authority.isEmpty() || rawPath.isEmpty()) {
      return Optional.empty();
    }
    final CanonicalAuthority auth = authority.get();
    final String portSuffix = auth.port() == -1 ? "" : ":" + auth.port();
    return Optional.of(URI.create(scheme + "://" + auth.host() + portSuffix + rawPath.get()));
  }

  private static boolean hasForbiddenComponents(final URI uri) {
    return uri.getRawFragment() != null
        || uri.getRawQuery() != null
        || uri.getRawUserInfo() != null;
  }

  private static String normalizeScheme(final String rawScheme) {
    if (rawScheme == null) {
      return null;
    }
    final String scheme = rawScheme.toLowerCase(Locale.ROOT);
    return ALLOWED_SCHEMES.contains(scheme) ? scheme : null;
  }

  private static Optional<CanonicalAuthority> canonicalizeAuthority(
      final URI uri, final String scheme) {
    final String rawAuthority = uri.getRawAuthority();
    final String rawHost = uri.getHost();
    if (nullOrEmpty(rawAuthority) || nullOrEmpty(rawHost) || rawHost.isBlank()) {
      return Optional.empty();
    }
    final int port = uri.getPort();
    // Java's URI parses a dangling colon ("example.com:" or "[::1]:") with port == -1.
    if (port == -1 && !rawAuthority.equals(rawHost)) {
      return Optional.empty();
    }
    if (port != -1 && (port < MIN_PORT || port > MAX_PORT)) {
      return Optional.empty();
    }
    final int effectivePort = isDefaultPort(scheme, port) ? -1 : port;
    return Optional.of(new CanonicalAuthority(rawHost.toLowerCase(Locale.ROOT), effectivePort));
  }

  private static boolean isDefaultPort(final String scheme, final int port) {
    return (HTTPS_SCHEME.equals(scheme) && port == DEFAULT_HTTPS_PORT)
        || (HTTP_SCHEME.equals(scheme) && port == DEFAULT_HTTP_PORT);
  }

  private static Optional<String> canonicalizeRawPath(final String rawPath) {
    if (rawPath == null) {
      return Optional.of("");
    }
    if (rawPath.contains("//") || hasDotSegment(rawPath)) {
      return Optional.empty();
    }
    final String normalized =
        rawPath.length() > 1 && rawPath.endsWith("/")
            ? rawPath.substring(0, rawPath.length() - 1)
            : rawPath;
    return Optional.of(normalized);
  }

  private static boolean hasDotSegment(final String rawPath) {
    for (final String segment : rawPath.split("/", -1)) {
      if (".".equals(segment) || "..".equals(segment)) {
        return true;
      }
    }
    return false;
  }
}
