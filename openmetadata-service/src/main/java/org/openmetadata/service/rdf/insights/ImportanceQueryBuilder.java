package org.openmetadata.service.rdf.insights;

/**
 * Builds the SPARQL query that ranks entities by an importance score blending OpenMetadata's
 * existing usage percentile (real query data) with downstream lineage count (graph topology).
 *
 * <p>Scoring formula:
 *
 * <pre>{@code
 * score = 0.6 * (usagePercentile / 100)
 *       + 0.4 * (downstreamCount / max(downstreamCount across the entity type))
 *       + 0.0 * centralityScore   // 3.1.b will plug PageRank here for null-usage entities
 * }</pre>
 *
 * <p>Both terms are 0–1 after normalization. Entities without usage data fall to the bottom
 * until 3.1.b's PageRank fallback lands and {@code om:centralityScore} starts populating.
 */
public final class ImportanceQueryBuilder {

  /** Hard-capped to keep the response page-sized. */
  static final int MIN_LIMIT = 1;

  static final int MAX_LIMIT = 100;
  static final int DEFAULT_LIMIT = 20;

  /** Allowed window values map to the matching `om:usage{Window}Percentile` predicate. */
  private static final java.util.Set<String> WINDOWS =
      java.util.Set.of("daily", "weekly", "monthly");

  private ImportanceQueryBuilder() {}

  public static String build(String entityType, String window, int limit) {
    String safeType = validateEntityType(entityType);
    String safeWindow = validateWindow(window);
    int safeLimit = clamp(limit, MIN_LIMIT, MAX_LIMIT);
    String classLocalName = capitalize(safeType);
    String pctPredicate = "usage" + capitalize(safeWindow) + "Percentile";

    return String.join(
        "\n",
        "PREFIX om: <https://open-metadata.org/ontology/>",
        "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>",
        "PREFIX prov: <http://www.w3.org/ns/prov#>",
        "PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>",
        "SELECT ?entity ?fqn ?label ?usagePct ?downstreamCount ?score WHERE {",
        "  {",
        "    SELECT ?entity (COUNT(?downstream) AS ?downstreamCount) WHERE {",
        "      ?entity a om:" + classLocalName + " .",
        "      OPTIONAL { ?downstream prov:wasDerivedFrom ?entity }",
        "    } GROUP BY ?entity",
        "  }",
        "  ?entity om:fullyQualifiedName ?fqn .",
        "  OPTIONAL { ?entity rdfs:label ?label }",
        "  OPTIONAL { ?entity om:" + pctPredicate + " ?usagePct }",
        "  OPTIONAL { ?entity om:centralityScore ?centrality }",
        "  {",
        "    SELECT (MAX(?dc) AS ?maxDownstream) WHERE {",
        "      SELECT (COUNT(?ds) AS ?dc) WHERE {",
        "        ?e a om:" + classLocalName + " .",
        "        OPTIONAL { ?ds prov:wasDerivedFrom ?e }",
        "      } GROUP BY ?e",
        "    }",
        "  }",
        "  BIND(COALESCE(?usagePct, 0.0) / 100.0 AS ?usageNorm)",
        "  BIND(",
        "    IF(?maxDownstream > 0,",
        "       xsd:double(?downstreamCount) / xsd:double(?maxDownstream),",
        "       0.0)",
        "    AS ?downstreamNorm)",
        "  BIND(COALESCE(?centrality, 0.0) AS ?centralityNorm)",
        "  BIND(",
        "    (0.6 * ?usageNorm) + (0.4 * ?downstreamNorm) + (0.0 * ?centralityNorm)",
        "    AS ?score)",
        "}",
        "ORDER BY DESC(?score) DESC(?downstreamCount)",
        "LIMIT " + safeLimit);
  }

  static String validateEntityType(String entityType) {
    if (entityType == null || entityType.isBlank()) {
      throw new IllegalArgumentException("'entityType' is required");
    }
    String trimmed = entityType.trim();
    if (!trimmed.matches("[a-zA-Z][a-zA-Z0-9]*")) {
      throw new IllegalArgumentException(
          "'entityType' must be alphanumeric (got '" + entityType + "')");
    }
    return trimmed;
  }

  static String validateWindow(String window) {
    if (window == null || window.isBlank()) {
      return "daily";
    }
    String lower = window.trim().toLowerCase(java.util.Locale.ROOT);
    if (!WINDOWS.contains(lower)) {
      throw new IllegalArgumentException(
          "'window' must be one of " + WINDOWS + " (got '" + window + "')");
    }
    return lower;
  }

  static int clamp(int v, int lo, int hi) {
    return Math.min(Math.max(v, lo), hi);
  }

  private static String capitalize(String s) {
    if (s == null || s.isEmpty()) return s;
    return Character.toUpperCase(s.charAt(0)) + s.substring(1);
  }
}
