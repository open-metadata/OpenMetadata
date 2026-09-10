package org.openmetadata.service.search.vector;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import lombok.experimental.UtilityClass;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.security.ContextMemorySearchVisibility;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@UtilityClass
public class VectorSearchQueryBuilder {
  private static final Logger LOG = LoggerFactory.getLogger(VectorSearchQueryBuilder.class);
  private static final String ANY = "__ANY__";
  private static final String NONE = "__NONE__";
  public static final int DEFAULT_KNN_NUM_CANDIDATES_MULTIPLIER = 2;

  /**
   * Consulted only for its engine-independent predicates ({@code isSubjectResolvable}) and field
   * constants, so this builder decides who is restricted from the same rule the search managers use.
   * The factory is irrelevant here — this class renders raw JSON, never OMQueryBuilder clauses.
   */
  private static final ContextMemorySearchVisibility MEMORY_VISIBILITY =
      new ContextMemorySearchVisibility(new OpenSearchQueryBuilderFactory());

  /**
   * Build a full search request body (size + _source + query) for standalone vector search. Context
   * memory visibility is enforced fail-closed: with no subject, only org-wide memories match. See
   * {@link #appendMemoryVisibilityClause}.
   */
  public static String build(
      float[] vector,
      int size,
      int from,
      int k,
      Map<String, List<String>> filters,
      double threshold) {
    return build(vector, size, from, k, filters, threshold, null);
  }

  /** As {@link #build}, constraining context memories to those {@code subjectContext} may see. */
  public static String build(
      float[] vector,
      int size,
      int from,
      int k,
      Map<String, List<String>> filters,
      double threshold,
      SubjectContext subjectContext) {
    StringBuilder sb =
        new StringBuilder(512)
            .append("{\"size\":")
            .append(size)
            .append(",\"from\":")
            .append(from)
            .append(",\"_source\":{\"excludes\":[\"embedding\"]}")
            .append(",\"query\":");
    appendKnnQuery(sb, vector, k, filters, threshold, subjectContext);
    sb.append('}');
    return sb.toString();
  }

  /**
   * Build only the KNN query JSON (no size/_source wrapper). Used by hybrid search to embed as a
   * sub-query inside a hybrid query. Context memory visibility is enforced fail-closed.
   */
  public static String buildQuery(
      float[] vector, int k, Map<String, List<String>> filters, double threshold) {
    return buildQuery(vector, k, filters, threshold, null);
  }

  /**
   * As {@link #buildQuery}, constraining context memories to those {@code subjectContext} may see.
   */
  public static String buildQuery(
      float[] vector,
      int k,
      Map<String, List<String>> filters,
      double threshold,
      SubjectContext subjectContext) {
    StringBuilder sb = new StringBuilder(512);
    appendKnnQuery(sb, vector, k, filters, threshold, subjectContext);
    return sb.toString();
  }

  private static void appendKnnQuery(
      StringBuilder sb,
      float[] vector,
      int k,
      Map<String, List<String>> filters,
      double threshold,
      SubjectContext subjectContext) {
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
    appendFilterMustClauses(sb, filters);
    sb.append("]"); // close must array
    appendMemoryVisibilityFilter(sb, subjectContext);
    sb.append("}}"); // close bool and filter

    sb.append("}}}"); // close embedding, knn, query
  }

  public static String buildNativeESQuery(
      float[] vector, int size, int from, int k, Map<String, List<String>> filters) {
    return buildNativeESQuery(
        vector, size, from, k, filters, DEFAULT_KNN_NUM_CANDIDATES_MULTIPLIER);
  }

  public static String buildNativeESQuery(
      float[] vector,
      int size,
      int from,
      int k,
      Map<String, List<String>> filters,
      int numCandidatesMultiplier) {
    return buildNativeESQuery(vector, size, from, k, filters, numCandidatesMultiplier, null);
  }

  /**
   * As {@link #buildNativeESQuery}, constraining context memories to those {@code subjectContext}
   * may see. Elasticsearch has no chunk index, so this filters memory entity documents, which carry
   * the same visibility fields.
   */
  public static String buildNativeESQuery(
      float[] vector,
      int size,
      int from,
      int k,
      Map<String, List<String>> filters,
      int numCandidatesMultiplier,
      SubjectContext subjectContext) {
    // Compute in long to avoid int overflow when k * numCandidatesMultiplier exceeds
    // Integer.MAX_VALUE; clamp to Integer.MAX_VALUE so num_candidates is always positive.
    long candidatesLong = (long) k * (long) numCandidatesMultiplier;
    int numCandidates = (int) Math.max(100, Math.min(candidatesLong, (long) Integer.MAX_VALUE));
    StringBuilder sb =
        new StringBuilder(512)
            .append("{\"size\":")
            .append(size)
            .append(",\"from\":")
            .append(from)
            .append(",\"_source\":{\"excludes\":[\"embedding\"]}")
            .append(",\"knn\":{")
            .append("\"field\":\"embedding\"")
            .append(",\"query_vector\":")
            .append(Arrays.toString(vector))
            .append(",\"k\":")
            .append(k)
            .append(",\"num_candidates\":")
            .append(numCandidates);

    sb.append(",\"filter\":{\"bool\":{\"must\":[");
    appendFilterMustClauses(sb, filters);
    sb.append("]"); // close must array
    appendMemoryVisibilityFilter(sb, subjectContext);
    sb.append("}}"); // close bool and filter

    sb.append("}}"); // close knn object
    return sb.toString();
  }

  /**
   * Constrain context memory documents to those the subject may see. Non-memory documents always
   * pass, so this is safe to AND into every vector query — and it is applied unconditionally,
   * because a caller cannot be trusted to remember a privacy filter.
   *
   * <p>Note the deliberate difference from {@link
   * ContextMemorySearchVisibility#buildVisibilityFilter}, where a null or unresolvable subject means
   * "no filter" and each call site opts into {@code buildOrgWideOnlyFilter}: this builder serves
   * callers that pass no identity at all, so the safe default lives here rather than in call-site
   * discipline. Unknown subject means org-wide memories only; admins get no clause.
   */
  private static void appendMemoryVisibilityFilter(
      StringBuilder sb, SubjectContext subjectContext) {
    boolean widen = MEMORY_VISIBILITY.isVisibilityEnforced(subjectContext);
    if (MEMORY_VISIBILITY.isSubjectResolvable(subjectContext) && !widen) {
      return; // an identified admin sees every memory, so no clause at all
    }
    // A sibling `filter` array rather than another `must` entry: a security constraint must not
    // contribute to the relevance score, and keeping it out of `must` also keeps the
    // caller-supplied
    // filter list exactly as the caller expressed it.
    sb.append(",\"filter\":[{\"bool\":{\"should\":[");
    // Branch 1: anything that is not a context memory.
    sb.append("{\"bool\":{\"must_not\":[")
        .append(termClause(ContextMemorySearchVisibility.FIELD_ENTITY_TYPE, Entity.CONTEXT_MEMORY))
        .append("]}}");
    // Branch 2: a context memory this subject may see.
    sb.append(",{\"bool\":{\"must\":[")
        .append(termClause(ContextMemorySearchVisibility.FIELD_ENTITY_TYPE, Entity.CONTEXT_MEMORY))
        .append(',');
    appendVisibleMemoryClause(sb, widen ? subjectContext : null);
    sb.append("]}}");
    sb.append("]}}]");
  }

  /** Mirrors {@code ContextMemorySearchVisibility#buildVisibleToUserClause}. */
  private static void appendVisibleMemoryClause(StringBuilder sb, SubjectContext subjectContext) {
    // A document lacking `visibility` satisfies no branch, so a memory chunk written before it was
    // stamped is excluded until a Search Reindex restamps it — it may be a Private one.
    sb.append("{\"bool\":{\"should\":[")
        .append(
            termClause(
                ContextMemorySearchVisibility.FIELD_VISIBILITY, MemoryVisibility.ENTITY.value()));
    if (subjectContext != null) {
      User user = subjectContext.user();
      // ignore_unmapped mirrors QueryBuilderFactory#nestedQuery, and is not optional: a KNN query
      // spans an alias of many indices, and OpenSearch fails the whole request with a 400 if any of
      // them does not map `owners` as nested. Without it a single such index breaks search outright
      // for every non-admin caller.
      sb.append(",{\"nested\":{\"path\":\"")
          .append(ContextMemorySearchVisibility.FIELD_OWNERS)
          .append("\",\"ignore_unmapped\":true,\"query\":")
          .append(
              termClause(ContextMemorySearchVisibility.FIELD_OWNERS_ID, user.getId().toString()))
          .append("}}");
      sb.append(",{\"bool\":{\"must\":[")
          .append(
              termClause(
                  ContextMemorySearchVisibility.FIELD_VISIBILITY, MemoryVisibility.SHARED.value()))
          .append(',');
      appendFlat(
          sb,
          ContextMemorySearchVisibility.FIELD_SHARED_WITH_IDS,
          ContextMemorySearchVisibility.sharedPrincipalIds(user));
      sb.append("]}}");
    }
    sb.append("]}}");
  }

  private static String termClause(String field, String value) {
    return "{\"term\":{\"" + field + "\":\"" + escape(value) + "\"}}";
  }

  private static void appendFilterMustClauses(StringBuilder sb, Map<String, List<String>> filters) {
    sb.append("{\"term\":{\"deleted\":false}}");
    Map<String, List<String>> safeFilters = filters == null ? Map.of() : filters;
    for (var e : safeFilters.entrySet()) {
      String field = e.getKey();
      List<String> values = e.getValue();
      if (values == null || values.isEmpty()) continue;
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
          case "dataProducts" -> {
            sb.append(',');
            appendFlat(sb, "dataProducts.name", values);
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
          case "databaseSchema" -> {
            sb.append(',');
            appendFlat(sb, "databaseSchema.name", values);
          }
          case "primaryEntityId" -> {
            sb.append(',');
            appendFlat(sb, "primaryEntity.id", values);
          }
          case "parentId" -> {
            sb.append(',');
            appendFlat(sb, "parentId", values);
          }
            // Context memory facets: the Company Context tools scope their search to
            // file-extracted,
            // shared knowledge pills, and an unrecognised key here is dropped silently — which
            // would
            // widen those searches to every memory the caller can see.
          case "sourceType" -> {
            sb.append(',');
            appendFlat(sb, "sourceType", values);
          }
          case "visibility" -> {
            sb.append(',');
            appendFlat(sb, ContextMemorySearchVisibility.FIELD_VISIBILITY, values);
          }
            // Metric facets: semantic_search returns these on every metric result, so a caller
            // that sees "granularity": "MONTH" will reasonably filter by it.
          case "metricType" -> {
            sb.append(',');
            appendFlat(sb, "metricType", values);
          }
          case "granularity" -> {
            sb.append(',');
            appendFlat(sb, "granularity", values);
          }
            // Matches the raw enum or the custom text, because a metric whose unit is OTHER
            // displays its customUnitOfMeasurement ("basis points") and a caller will filter by
            // what they saw. Accepting only the stored enum would match nothing, silently.
          case "unitOfMeasurement" -> {
            sb.append(',');
            appendFlatOr(sb, "unitOfMeasurement", "customUnitOfMeasurement", values);
          }
          default -> LOG.debug("Ignoring unrecognized filter key: {}", field);
        }
      }
    }
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
    return s.replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
        .replace("\b", "\\b")
        .replace("\f", "\\f");
  }

  public static void appendCustomPropertiesFilter(
      StringBuilder sb, String field, List<String> vals) {
    if (nullOrEmpty(vals)) {
      return;
    }
    if (!field.startsWith("customProperties.")) {
      throw new IllegalArgumentException("field must start with 'customProperties.': " + field);
    }
    String propName = field.substring("customProperties.".length());

    // customPropertiesTyped is a nested field; each entry has a "name" keyword and typed value
    // sub-fields. Build a nested query that matches on name + value across all value sub-fields.
    sb.append("{\"bool\":{\"should\":[");
    for (int i = 0; i < vals.size(); i++) {
      if (i > 0) sb.append(',');
      String val = escape(vals.get(i));
      sb.append("{\"nested\":{\"path\":\"customPropertiesTyped\",\"query\":{\"bool\":{\"must\":[")
          .append("{\"term\":{\"customPropertiesTyped.name\":\"")
          .append(escape(propName))
          .append("\"}},")
          .append("{\"bool\":{\"should\":[")
          .append("{\"term\":{\"customPropertiesTyped.stringValue\":\"")
          .append(val)
          .append("\"}},")
          .append("{\"term\":{\"customPropertiesTyped.refFqn\":\"")
          .append(val)
          .append("\"}},")
          .append("{\"term\":{\"customPropertiesTyped.refName\":\"")
          .append(val)
          .append("\"}},")
          .append("{\"match\":{\"customPropertiesTyped.textValue\":\"")
          .append(val)
          .append("\"}}")
          .append("]}}")
          .append("]}}}}");
    }
    sb.append("]}}");
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
