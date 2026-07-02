package org.openmetadata.service.rdf;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * Validates user-supplied IRIs before they are interpolated into SPARQL queries.
 *
 * <p>SPARQL angle-bracket-delimited IRI references must not contain characters that can escape the
 * template (newlines, {@code #} comments, quotes, control characters, etc.). Stripping {@code >}
 * alone is not enough — see the {@code DESCRIBE <…>} injection finding from the May 2026 PR
 * review. This single utility is shared by every code path that builds a SPARQL DESCRIBE / CLEAR
 * GRAPH query around a user-supplied URI so updates only need to land in one place.
 *
 * <p>Accepted form: {@code http(s)://host[/path][?query][#fragment]} with no whitespace, no angle
 * brackets, no quotes, no backticks, and no control characters. Maximum 2048 characters.
 */
public final class RdfIriValidator {

  /** Soft cap. 2 KiB is well above legitimate OM URIs and keeps logs bounded. */
  static final int MAX_LENGTH = 2048;

  private RdfIriValidator() {}

  /**
   * Returns the sanitized IRI when valid, {@code null} otherwise. Trims leading/trailing
   * whitespace before validation; the validated form is the trimmed candidate.
   */
  public static String validateEntityIri(String raw) {
    String candidate = sanitizeStoredIri(raw);
    if (candidate == null) {
      return null;
    }
    try {
      URI uri = new URI(candidate);
      if (!uri.isAbsolute()) {
        return null;
      }
      String scheme = uri.getScheme();
      if (scheme == null) {
        return null;
      }
      String schemeLower = scheme.toLowerCase(Locale.ROOT);
      if (!"http".equals(schemeLower) && !"https".equals(schemeLower)) {
        return null;
      }
    } catch (URISyntaxException e) {
      return null;
    }
    return candidate;
  }

  /**
   * Defense-in-depth sanitizer for IRIs that already come from the triplestore (e.g. SPARQL
   * SELECT bindings) rather than from a user request. Rejects only the characters that could
   * break out of an angle-bracket-delimited IRI reference in a SPARQL template — control
   * characters, whitespace, angle brackets, quotes, backticks — without enforcing the
   * absolute http(s) scheme that {@link #validateEntityIri} requires, since stored IRIs
   * legitimately use other schemes ({@code urn:} and friends).
   *
   * @return the trimmed IRI when safe to interpolate, {@code null} otherwise.
   */
  public static String sanitizeStoredIri(String raw) {
    String result = null;
    if (raw != null) {
      String candidate = raw.trim();
      if (!candidate.isEmpty() && candidate.length() <= MAX_LENGTH && hasNoUnsafeChars(candidate)) {
        result = candidate;
      }
    }
    return result;
  }

  private static boolean hasNoUnsafeChars(String candidate) {
    boolean safe = true;
    for (int i = 0; i < candidate.length() && safe; i++) {
      char c = candidate.charAt(i);
      if (c < 0x20 || c == 0x7F || c == ' ' || c == '<' || c == '>' || c == '"' || c == '\''
          || c == '`') {
        safe = false;
      }
    }
    return safe;
  }
}
