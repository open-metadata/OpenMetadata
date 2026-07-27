package org.openmetadata.mcp.util;

import java.util.Map;

/**
 * Lenient coercion of MCP tool arguments. MCP clients send arguments as an untyped {@code
 * Map<String, Object>} where a numeric value may arrive as a JSON number <em>or</em> a string, so
 * every read tool was carrying its own {@code parseIntParam}/{@code parseBooleanParam}/{@code
 * parseDoubleParam} copy. This centralizes that logic.
 *
 * <p>All three readers share the same fall-through contract: a missing key, a present-but-null value
 * and an unparseable value all yield the supplied default. Range clamping (depth/size bounds) stays
 * with the caller because the valid range is tool-specific.
 */
public final class McpParams {

  private McpParams() {}

  public static int getInt(Map<String, Object> params, String key, int defaultValue) {
    int result = defaultValue;
    Object value = params.get(key);
    if (value instanceof Number number) {
      result = number.intValue();
    } else if (value instanceof String string) {
      result = parseInt(string, defaultValue);
    }
    return result;
  }

  public static double getDouble(Map<String, Object> params, String key, double defaultValue) {
    double result = defaultValue;
    Object value = params.get(key);
    if (value instanceof Number number) {
      result = number.doubleValue();
    } else if (value instanceof String string) {
      result = parseDouble(string, defaultValue);
    }
    return result;
  }

  public static boolean getBoolean(Map<String, Object> params, String key, boolean defaultValue) {
    boolean result = defaultValue;
    Object value = params.get(key);
    if (value instanceof Boolean bool) {
      result = bool;
    } else if (value instanceof String string) {
      result = Boolean.parseBoolean(string);
    }
    return result;
  }

  private static int parseInt(String value, int defaultValue) {
    int result = defaultValue;
    try {
      result = Integer.parseInt(value);
    } catch (NumberFormatException e) {
      result = defaultValue;
    }
    return result;
  }

  private static double parseDouble(String value, double defaultValue) {
    double result = defaultValue;
    try {
      result = Double.parseDouble(value);
    } catch (NumberFormatException e) {
      result = defaultValue;
    }
    return result;
  }
}
