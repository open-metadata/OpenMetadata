package org.openmetadata.service.monitoring;

import java.time.Duration;
import java.util.regex.Pattern;
import lombok.experimental.UtilityClass;

@UtilityClass
public class MetricUtils {

  // Compiled patterns for efficient operation type detection
  private static final Pattern LIST_PATTERN = Pattern.compile("^/?v1/[^/]+/?$");
  private static final Pattern GET_BY_ID_PATTERN =
      Pattern.compile(
          "^/?v1/[^/]+/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/?$");
  private static final Pattern GET_BY_FQN_PATTERN = Pattern.compile("^/?v1/[^/]+/name/[^?]+/?$");
  private static final Pattern RESOURCE_PATTERN = Pattern.compile("^/?v1/([^/?]+).*");

  /**
   * Operation types for API endpoint classification
   */
  public enum OperationType {
    LIST, // GET /v1/{resource} - list operations
    GET // GET /v1/{resource}/{id} or /v1/{resource}/name/{fqn} - single entity operations
  }

  /**
   * Determines the operation type based on the URI pattern.
   * This works for all OpenMetadata resources following the standard pattern:
   * - LIST: GET /v1/{resource} (with optional query params)
   * - GET: GET /v1/{resource}/{id} or GET /v1/{resource}/name/{fqn}
   *
   * @param uri the request URI (without query parameters)
   * @return the operation type (LIST or GET)
   */
  public static OperationType getOperationType(String uri) {
    if (uri == null || uri.isEmpty()) {
      return OperationType.LIST;
    }

    // Remove query parameters
    String cleanUri = uri.split("\\?")[0];

    // Check patterns in order of specificity
    if (GET_BY_FQN_PATTERN.matcher(cleanUri).matches()) {
      return OperationType.GET;
    }

    if (GET_BY_ID_PATTERN.matcher(cleanUri).matches()) {
      return OperationType.GET;
    }

    if (LIST_PATTERN.matcher(cleanUri).matches()) {
      return OperationType.LIST;
    }

    // For sub-resources (e.g., /v1/tables/{id}/columns), always classify as GET
    // since they operate on a specific entity
    return OperationType.GET;
  }

  /**
   * Extracts the resource name from a v1 API URI.
   *
   * @param uri the request URI
   * @return the resource name (e.g., "tables", "databases", "users") or "unknown"
   */
  public static String extractResourceName(String uri) {
    if (uri == null || uri.isEmpty()) {
      return "unknown";
    }

    String cleanUri = uri.split("\\?")[0];
    var matcher = RESOURCE_PATTERN.matcher(cleanUri);
    if (matcher.matches()) {
      return matcher.group(1);
    }

    return "unknown";
  }

  // Standard SLA buckets for all latency metrics (10 buckets total)
  public static final Duration[] LATENCY_SLA_BUCKETS = {
    Duration.ofMillis(10), // 10ms
    Duration.ofMillis(25), // 25ms
    Duration.ofMillis(50), // 50ms
    Duration.ofMillis(100), // 100ms
    Duration.ofMillis(250), // 250ms
    Duration.ofMillis(500), // 500ms
    Duration.ofSeconds(1), // 1s
    Duration.ofMillis(2500), // 2.5s
    Duration.ofSeconds(5), // 5s
    Duration.ofSeconds(30) // 30s
  };

  public static String normalizeUri(String uri) {
    // Normalize URIs to avoid high cardinality
    if (uri == null || uri.isEmpty()) {
      return "/unknown";
    }

    // Remove query parameters to reduce cardinality
    String normalizedUri = uri.split("\\?")[0];

    // Handle generic OpenMetadata v1 API patterns FIRST for proper differentiation
    // Pattern: /v1/{resource}/name/{fqn} -> /v1/{resource}/name/{fqn}
    normalizedUri = normalizedUri.replaceAll("(^|/)v1/([^/]+)/name/[^/]+$", "$1v1/$2/name/{fqn}");
    // Pattern: /v1/{resource}/name/{fqn}/{subresource} -> /v1/{resource}/name/{fqn}/{subresource}
    normalizedUri =
        normalizedUri.replaceAll("(^|/)v1/([^/]+)/name/[^/]+/([^/]+)$", "$1v1/$2/name/{fqn}/$3");

    // Handle special endpoints that don't follow the standard pattern
    normalizedUri =
        normalizedUri
            .replaceAll(
                "(^|/)v1/([^/]+)/entityRelationship/([^/]+)$",
                "$1v1/$2/entityRelationship/{direction}")
            .replaceAll("(^|/)v1/([^/]+)/entityRelationship$", "$1v1/$2/entityRelationship");

    // Replace various ID patterns with placeholders in order of specificity
    normalizedUri =
        normalizedUri
            // UUID patterns (e.g., /v1/tables/550e8400-e29b-41d4-a716-446655440000)
            .replaceAll(
                "/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
                "/{name}")
            // Numeric IDs (e.g., /v1/tables/123456)
            .replaceAll("/\\d+", "/{name}")
            // Entity names that contain special characters or spaces (encoded)
            .replaceAll("/[^/]*%[0-9a-fA-F]{2}[^/]*", "/{name}")
            // Long alphanumeric strings that might be encoded names (but not 'name' literal)
            .replaceAll("/(?!name)[a-zA-Z0-9_.-]{20,}", "/{name}")

            // Generic patterns for OpenMetadata resources with sub-resources
            // Pattern: /v1/{resource}/{identifier}/{subresource}/{subidentifier}
            .replaceAll("(^|/)v1/([^/]+)/\\{id\\}/([^/]+)/([^/]+)$", "$1v1/$2/{id}/$3/$4")
            // Pattern: /v1/{resource}/{identifier}/{subresource}
            .replaceAll("(^|/)v1/([^/]+)/\\{id\\}/([^/]+)$", "$1v1/$2/{id}/$3")
            // Pattern: /v1/{resource}/{identifier} (single resource access)
            .replaceAll("(^|/)v1/([^/]+)/\\{id\\}$", "$1v1/$2/{id}")

            // Handle timestamp patterns
            .replaceAll("/[0-9]{10,13}", "/{timestamp}");

    // Ensure we don't have empty path segments
    normalizedUri = normalizedUri.replaceAll("/+", "/");

    // Limit to reasonable URI length to prevent edge cases
    if (normalizedUri.length() > 100) {
      // For very long URIs, just use the first few path segments
      String[] segments = normalizedUri.split("/");
      if (segments.length > 5) {
        normalizedUri = String.join("/", java.util.Arrays.copyOfRange(segments, 0, 5)) + "/...";
      }
    }

    return normalizedUri.isEmpty() ? "/" : normalizedUri;
  }
}
