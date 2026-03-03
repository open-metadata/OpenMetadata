package org.openmetadata.service.util;

import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import org.apache.commons.text.TextStringBuilder;

/**
 * A YAML-safe variant of Dropwizard's {@link EnvironmentVariableSubstitutor} that automatically
 * quotes substituted values containing YAML special characters.
 *
 * <p>Environment variable substitution in Dropwizard happens at the text level before YAML parsing.
 * If an environment variable value contains YAML special characters (e.g., {@code >}, {@code |},
 * {@code #}, {@code {}}, {@code []}), the resulting YAML becomes malformed.
 *
 * <p>For example, a database password like {@code >8fYhD>dkcxy#HkVi8~ET} set via
 * {@code DB_USER_PASSWORD} would produce:
 *
 * <pre>
 *   password: >8fYhD>dkcxy#HkVi8~ET
 * </pre>
 *
 * The {@code >} is a YAML block scalar indicator, causing a parse error. This substitutor wraps
 * such values in double quotes:
 *
 * <pre>
 *   password: ">8fYhD>dkcxy#HkVi8~ET"
 * </pre>
 *
 * <p>Values that look like YAML flow sequences ({@code [...]}) or flow mappings ({@code {...}}) are
 * left unquoted to preserve their structural meaning.
 *
 * @see <a href="https://github.com/open-metadata/OpenMetadata/issues/21176">Issue #21176</a>
 */
public class YamlSafeSubstitutor extends EnvironmentVariableSubstitutor {

  public YamlSafeSubstitutor(boolean strict) {
    super(strict);
  }

  @Override
  protected String resolveVariable(
      String variableName, TextStringBuilder buf, int startPos, int endPos) {
    String value = super.resolveVariable(variableName, buf, startPos, endPos);
    if (value == null || !needsYamlQuoting(value)) {
      return value;
    }
    // Don't quote values that are embedded within a larger string (e.g., JDBC URLs like
    // jdbc:${DB_SCHEME:-mysql}://${DB_HOST:-localhost}:${DB_PORT:-3306}/...).
    // Quoting inline values would insert literal '"' characters into the surrounding string.
    if (isInlineSubstitution(buf, startPos, endPos)) {
      return value;
    }
    return yamlDoubleQuote(value);
  }

  /**
   * Checks whether the ${...} placeholder is embedded within a larger YAML value rather than being
   * the entire value. A substitution is inline if there is non-whitespace content immediately before
   * or after the placeholder on the same line.
   */
  static boolean isInlineSubstitution(TextStringBuilder buf, int startPos, int endPos) {
    if (startPos > 0) {
      char before = buf.charAt(startPos - 1);
      if (before != ' ' && before != '\t' && before != '\n' && before != '\r') {
        return true;
      }
    }
    if (endPos < buf.length()) {
      char after = buf.charAt(endPos);
      if (after != ' ' && after != '\t' && after != '\n' && after != '\r') {
        return true;
      }
    }
    return false;
  }

  /**
   * Wraps the value in YAML double quotes if it contains special characters that would break YAML
   * parsing. Returns the value unchanged if quoting is not needed.
   */
  public static String quoteIfNeeded(String value) {
    if (value != null && needsYamlQuoting(value)) {
      return yamlDoubleQuote(value);
    }
    return value;
  }

  static boolean needsYamlQuoting(String value) {
    if (value.isEmpty()) {
      return false;
    }

    // Don't quote values that look like YAML flow sequences or mappings,
    // as quoting would turn them into plain strings
    if ((value.startsWith("[") && value.endsWith("]"))
        || (value.startsWith("{") && value.endsWith("}"))) {
      return false;
    }

    char first = value.charAt(0);

    // Characters that are YAML indicators when they appear at the start of a scalar value:
    // >  block scalar (folded)
    // |  block scalar (literal)
    // *  alias
    // &  anchor
    // !  tag
    // %  directive
    // @  reserved
    // `  reserved
    // '  single quote
    // "  double quote
    // {  flow mapping start (not matched by flow-mapping check above, e.g. "{broken")
    // [  flow sequence start (not matched by flow-sequence check above, e.g. "[broken")
    // ?  mapping key indicator
    // ,  flow collection separator
    // #  comment indicator
    switch (first) {
      case '>':
      case '|':
      case '*':
      case '&':
      case '!':
      case '%':
      case '@':
      case '`':
      case '\'':
      case '"':
      case '{':
      case '[':
      case '?':
      case ',':
      case '#':
        return true;
      default:
        break;
    }

    // "- " at start is a block sequence entry indicator
    if (first == '-' && value.length() > 1 && value.charAt(1) == ' ') {
      return true;
    }

    // " #" anywhere starts a YAML comment (hash preceded by whitespace)
    if (value.contains(" #") || value.contains("\t#")) {
      return true;
    }

    // ": " or ":" at end of value is a mapping indicator
    if (value.contains(": ") || value.endsWith(":")) {
      return true;
    }

    // Leading or trailing whitespace
    char last = value.charAt(value.length() - 1);
    if (first == ' ' || first == '\t' || last == ' ' || last == '\t') {
      return true;
    }

    // Newlines would break YAML block structure
    if (value.indexOf('\n') >= 0 || value.indexOf('\r') >= 0) {
      return true;
    }

    return false;
  }

  static String yamlDoubleQuote(String value) {
    // Escape backslashes first (before introducing new ones), then double quotes and newlines
    String escaped =
        value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
    return "\"" + escaped + "\"";
  }
}
