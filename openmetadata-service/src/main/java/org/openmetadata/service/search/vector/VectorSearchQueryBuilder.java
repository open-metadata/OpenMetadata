package org.openmetadata.service.search.vector;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import lombok.experimental.UtilityClass;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@UtilityClass
public class VectorSearchQueryBuilder {
  private static final Logger LOG = LoggerFactory.getLogger(VectorSearchQueryBuilder.class);
  private static final String ANY = "__ANY__";
  private static final String NONE = "__NONE__";

  /** Build a full search request body (size + _source + query) for standalone vector search. */
  public static String build(
      float[] vector,
      int size,
      int from,
      int k,
      Map<String, List<String>> filters,
      double threshold) {
    StringBuilder sb =
        new StringBuilder(512)
            .append("{\"size\":")
            .append(size)
            .append(",\"from\":")
            .append(from)
            .append(",\"_source\":{\"excludes\":[\"embedding\"]}")
            .append(",\"query\":");
    appendKnnQuery(sb, vector, k, filters, threshold);
    sb.append('}');
    return sb.toString();
  }

  /**
   * Build only the KNN query JSON (no size/_source wrapper). Used by hybrid search to embed as a
   * sub-query inside a hybrid query.
   */
  public static String buildQuery(
      float[] vector, int k, Map<String, List<String>> filters, double threshold) {
    StringBuilder sb = new StringBuilder(512);
    appendKnnQuery(sb, vector, k, filters, threshold);
    return sb.toString();
  }

  private static void appendKnnQuery(
      StringBuilder sb,
      float[] vector,
      int k,
      Map<String, List<String>> filters,
      double threshold) {
    sb.append("{\"knn\":{\"embedding\":{\"vector\":").append(Arrays.toString(vector));

    // OpenSearch KNN supports either min_score or k, not both. When min_score is set,
    // it returns all neighbors above the threshold (unbounded count, capped by the outer
    // "size" parameter). When k is set, it returns exactly k nearest neighbors.
    if (threshold > 0.0) {
      sb.append(",\"min_score\":").append(threshold);
    } else {
      sb.append(",\"k\":").append(k);
    }

    // Build filter inside knn for efficient k-NN filtering
    sb.append(",\"filter\":{\"bool\":{\"must\":[");

    // Only include documents where deleted=false
    sb.append("{\"term\":{\"deleted\":false}}");

    // Then add user-specified filters
    for (var e : filters.entrySet()) {
      String field = e.getKey();
      List<String> values = e.getValue();
      if (values == null || values.isEmpty()) continue;

      // Handle custom properties that will come with "customProperties.<name>"
      if (field.startsWith("customProperties.")) {
        sb.append(',');
        appendCustomPropertiesFilter(sb, field, values);
      } else {
        switch (field) {
          case "owners" -> {
            sb.append(',');
            appendOwnersFilter(sb, values);
          }
          case "tags" -> {
            sb.append(',');
            appendFlat(sb, "tags.tagFQN", values);
          }
          case "domains" -> {
            sb.append(',');
            appendFlat(sb, "domains.name", values);
          }
          case "tier" -> {
            sb.append(',');
            appendFlat(sb, "tier.tagFQN", values);
          }
          case "certification" -> {
            sb.append(',');
            appendFlat(sb, "certification.tagLabel.tagFQN", values);
          }
          case "entityType" -> {
            sb.append(',');
            appendFlat(sb, "entityType", values);
          }
          case "serviceType" -> {
            sb.append(',');
            appendFlat(sb, "serviceType", values);
          }
          case "service" -> {
            sb.append(',');
            appendFlatOr(sb, "service.name", "service.displayName", values);
          }
          case "database" -> {
            sb.append(',');
            appendFlatOr(sb, "database.name", "database.displayName", values);
          }
          default -> LOG.debug("Ignoring unrecognized filter key: {}", field);
        }
      }
    }

    sb.append("]}}"); // close must array and bool

    sb.append("}}}"); // close embedding, knn, wrapper
  }

  private static void appendFlat(StringBuilder sb, String field, List<String> vals) {
    if (vals.size() == 1) {
      appendOneFlat(sb, field, vals.get(0));
    } else {
      boolean allNormal = vals.stream().noneMatch(v -> v.equals(ANY) || v.equals(NONE));
      if (allNormal) {
        sb.append("{\"terms\":{\"").append(field).append("\":[");
        for (int i = 0; i < vals.size(); i++) {
          if (i > 0) sb.append(',');
          sb.append('"').append(escape(vals.get(i))).append('"');
        }
        sb.append("]}}");
      } else {
        sb.append("{\"bool\":{\"should\":[");
        boolean first = true;
        for (String v : vals) {
          if (!first) sb.append(',');
          first = false;
          appendOneFlat(sb, field, v);
        }
        sb.append("]}}");
      }
    }
  }

  private static void appendOneFlat(StringBuilder sb, String field, String val) {
    switch (val) {
      case ANY -> sb.append("{\"exists\":{\"field\":\"").append(field).append("\"}}");
      case NONE -> sb.append("{\"bool\":{\"must_not\":{\"exists\":{\"field\":\"")
          .append(field)
          .append("\"}}}}");
      default -> sb.append("{\"term\":{\"")
          .append(field)
          .append("\":\"")
          .append(escape(val))
          .append("\"}}");
    }
  }

  private static void appendFlatOr(
      StringBuilder sb, String nameField, String displayNameField, List<String> vals) {
    sb.append("{\"bool\":{\"should\":[");
    boolean first = true;
    for (String v : vals) {
      if (!first) sb.append(',');
      first = false;
      if (ANY.equals(v) || NONE.equals(v)) {
        appendOneFlat(sb, nameField, v);
      } else {
        sb.append("{\"bool\":{\"should\":[");
        sb.append("{\"term\":{\"")
            .append(nameField)
            .append("\":\"")
            .append(escape(v))
            .append("\"}},");
        sb.append("{\"term\":{\"")
            .append(displayNameField)
            .append("\":\"")
            .append(escape(v))
            .append("\"}}");
        sb.append("]}}");
      }
    }
    sb.append("]}}");
  }

  public static String escape(String s) {
    return s.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private static void appendCustomPropertiesFilter(
      StringBuilder sb, String field, List<String> vals) {
    if (nullOrEmpty(vals)) {
      return;
    }
    boolean first = true;
    for (String v : vals) {
      if (!first) sb.append(',');
      first = false;

      if (field.endsWith(".name")) {
        sb.append(String.format("{\"term\":{\"%s\":\"%s\"}}", field, escape(v)));
      } else {
        // We have a fuzzy search
        sb.append("{\"match\":{")
            .append(String.format("\"%s\":{", field))
            .append(String.format("\"query\": \"%s\",", escape(v)))
            .append("\"fuzziness\": \"AUTO\"")
            .append("}}}");
      }
    }
  }

  private static void appendOwnersFilter(StringBuilder sb, List<String> vals) {
    final String path = "owners";
    final String field = "owners.name";

    // case: no owner (__NONE__)
    if (vals.size() == 1 && NONE.equals(vals.get(0))) {
      sb.append("{\"bool\":{\"must_not\":{")
          .append("\"nested\":{\"path\":\"")
          .append(path)
          .append("\",\"query\":{\"exists\":{\"field\":\"")
          .append(field)
          .append("\"}}}")
          .append("}}}");
      return;
    }

    // Mix of values, allows for combination of OR conditions
    sb.append("{\"bool\":{\"should\":[");
    boolean first = true;

    for (String v : vals) {
      if (!first) sb.append(',');
      first = false;

      if (ANY.equals(v)) {
        // case: any owner
        sb.append("{\"nested\":{\"path\":\"")
            .append(path)
            .append("\",\"query\":{\"exists\":{\"field\":\"")
            .append(field)
            .append("\"}}}}");
      } else if (NONE.equals(v)) {
        // no owners at all
        sb.append("{\"bool\":{\"must_not\":{")
            .append("\"nested\":{\"path\":\"")
            .append(path)
            .append("\",\"query\":{\"exists\":{\"field\":\"")
            .append(field)
            .append("\"}}}")
            .append("}}}");
      } else {
        // case: specific owner name
        sb.append("{\"nested\":{\"path\":\"")
            .append(path)
            .append("\",\"query\":")
            .append("{\"term\":{\"")
            .append(field)
            .append("\":\"")
            .append(escape(v))
            .append("\"}}}}");
      }
    }

    sb.append("]}}");
  }
}
