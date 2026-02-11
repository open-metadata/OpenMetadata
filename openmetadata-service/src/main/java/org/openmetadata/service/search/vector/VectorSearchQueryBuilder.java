package org.openmetadata.service.search.vector;

import java.util.List;
import java.util.Map;
import lombok.experimental.UtilityClass;

@UtilityClass
public class VectorSearchQueryBuilder {
  private static final String ANY_MARKER = "__ANY__";
  private static final String NONE_MARKER = "__NONE__";

  public static String build(float[] vector, int size, int k, Map<String, List<String>> filters) {
    StringBuilder sb = new StringBuilder(512);
    sb.append("{\"size\":").append(size);
    sb.append(",\"_source\":{\"excludes\":[\"embedding\"]}");
    sb.append(",\"query\":{\"knn\":{\"embedding\":{\"vector\":[");
    for (int i = 0; i < vector.length; i++) {
      if (i > 0) sb.append(',');
      sb.append(vector[i]);
    }
    sb.append("],\"k\":").append(k);

    sb.append(",\"filter\":{\"bool\":{\"must\":[");
    sb.append("{\"term\":{\"deleted\":false}}");

    if (filters != null) {
      for (Map.Entry<String, List<String>> entry : filters.entrySet()) {
        String key = entry.getKey();
        List<String> values = entry.getValue();
        if (values == null || values.isEmpty()) continue;

        String clause = buildFilterClause(key, values);
        if (clause != null) {
          sb.append(',');
          sb.append(clause);
        }
      }
    }

    sb.append("]}}}}}}");
    return sb.toString();
  }

  private static String buildFilterClause(String key, List<String> values) {
    return switch (key) {
      case "tags" -> appendNested("tags", "tags.tagFQN", values);
      case "owners" -> appendOwnersFilter(values);
      case "domains" -> buildFlatFilter("domains.name", values);
      case "tier" -> buildFlatFilter("tier.tagFQN", values);
      case "certification" -> buildFlatFilter("certification.tagFQN", values);
      case "entityType" -> buildFlatFilter("entityType", values);
      case "serviceType" -> buildFlatFilter("serviceType", values);
      default -> {
        if (key.startsWith("customProperties.")) {
          yield buildCustomPropertyFilter(key.substring("customProperties.".length()), values);
        }
        yield null;
      }
    };
  }

  private static String appendNested(String path, String field, List<String> values) {
    boolean hasAny = values.contains(ANY_MARKER);
    boolean hasNone = values.contains(NONE_MARKER);
    List<String> regularValues =
        values.stream().filter(v -> !ANY_MARKER.equals(v) && !NONE_MARKER.equals(v)).toList();

    if (hasAny && !hasNone && regularValues.isEmpty()) {
      return "{\"nested\":{\"path\":\""
          + path
          + "\",\"query\":{\"exists\":{\"field\":\""
          + field
          + "\"}}}}";
    }
    if (hasNone && !hasAny && regularValues.isEmpty()) {
      return "{\"bool\":{\"must_not\":[{\"nested\":{\"path\":\""
          + path
          + "\",\"query\":{\"exists\":{\"field\":\""
          + field
          + "\"}}}}]}}";
    }

    if (!regularValues.isEmpty() && !hasAny && !hasNone) {
      if (regularValues.size() == 1) {
        return "{\"nested\":{\"path\":\""
            + path
            + "\",\"query\":{\"term\":{\""
            + field
            + "\":\""
            + escape(regularValues.getFirst())
            + "\"}}}}";
      }
      return "{\"nested\":{\"path\":\""
          + path
          + "\",\"query\":{\"terms\":{\""
          + field
          + "\":"
          + toJsonArray(regularValues)
          + "}}}}";
    }

    StringBuilder sb = new StringBuilder("{\"bool\":{\"should\":[");
    boolean first = true;
    if (!regularValues.isEmpty()) {
      sb.append("{\"nested\":{\"path\":\"")
          .append(path)
          .append("\",\"query\":{\"terms\":{\"")
          .append(field)
          .append("\":")
          .append(toJsonArray(regularValues))
          .append("}}}}");
      first = false;
    }
    if (hasAny) {
      if (!first) sb.append(',');
      sb.append("{\"nested\":{\"path\":\"")
          .append(path)
          .append("\",\"query\":{\"exists\":{\"field\":\"")
          .append(field)
          .append("\"}}}}");
      first = false;
    }
    if (hasNone) {
      if (!first) sb.append(',');
      sb.append("{\"bool\":{\"must_not\":[{\"nested\":{\"path\":\"")
          .append(path)
          .append("\",\"query\":{\"exists\":{\"field\":\"")
          .append(field)
          .append("\"}}}}]}}");
    }
    sb.append("],\"minimum_should_match\":1}}");
    return sb.toString();
  }

  private static String appendOwnersFilter(List<String> values) {
    return appendNested("owners", "owners.name", values);
  }

  private static String buildFlatFilter(String field, List<String> values) {
    boolean hasAny = values.contains(ANY_MARKER);
    boolean hasNone = values.contains(NONE_MARKER);
    List<String> regularValues =
        values.stream().filter(v -> !ANY_MARKER.equals(v) && !NONE_MARKER.equals(v)).toList();

    if (hasAny && !hasNone && regularValues.isEmpty()) {
      return "{\"exists\":{\"field\":\"" + field + "\"}}";
    }
    if (hasNone && !hasAny && regularValues.isEmpty()) {
      return "{\"bool\":{\"must_not\":[{\"exists\":{\"field\":\"" + field + "\"}}]}}";
    }

    if (!regularValues.isEmpty() && !hasAny && !hasNone) {
      if (regularValues.size() == 1) {
        return "{\"term\":{\"" + field + "\":\"" + escape(regularValues.getFirst()) + "\"}}";
      }
      return "{\"terms\":{\"" + field + "\":" + toJsonArray(regularValues) + "}}";
    }

    StringBuilder sb = new StringBuilder("{\"bool\":{\"should\":[");
    boolean first = true;
    if (!regularValues.isEmpty()) {
      sb.append("{\"terms\":{\"")
          .append(field)
          .append("\":")
          .append(toJsonArray(regularValues))
          .append("}}");
      first = false;
    }
    if (hasAny) {
      if (!first) sb.append(',');
      sb.append("{\"exists\":{\"field\":\"").append(field).append("\"}}");
      first = false;
    }
    if (hasNone) {
      if (!first) sb.append(',');
      sb.append("{\"bool\":{\"must_not\":[{\"exists\":{\"field\":\"")
          .append(field)
          .append("\"}}]}}");
    }
    sb.append("],\"minimum_should_match\":1}}");
    return sb.toString();
  }

  private static String buildCustomPropertyFilter(String key, List<String> values) {
    if (!key.matches("[a-zA-Z0-9_.]+")) {
      return null;
    }
    if (key.endsWith(".name")) {
      String field = "customProperties." + key;
      if (values.size() == 1) {
        return "{\"term\":{\"" + field + "\":\"" + escape(values.getFirst()) + "\"}}";
      }
      return "{\"terms\":{\"" + field + "\":" + toJsonArray(values) + "}}";
    }
    String field = "customProperties." + key;
    if (values.size() == 1) {
      return "{\"match\":{\""
          + field
          + "\":{\"query\":\""
          + escape(values.getFirst())
          + "\",\"fuzziness\":\"AUTO\"}}}";
    }
    StringBuilder sb = new StringBuilder("{\"bool\":{\"should\":[");
    for (int i = 0; i < values.size(); i++) {
      if (i > 0) sb.append(',');
      sb.append("{\"match\":{\"")
          .append(field)
          .append("\":{\"query\":\"")
          .append(escape(values.get(i)))
          .append("\",\"fuzziness\":\"AUTO\"}}}");
    }
    sb.append("],\"minimum_should_match\":1}}");
    return sb.toString();
  }

  static String escape(String value) {
    if (value == null) return "";
    return value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t");
  }

  private static String toJsonArray(List<String> values) {
    StringBuilder sb = new StringBuilder("[");
    for (int i = 0; i < values.size(); i++) {
      if (i > 0) sb.append(',');
      sb.append("\"").append(escape(values.get(i))).append("\"");
    }
    sb.append("]");
    return sb.toString();
  }
}
