package org.openmetadata.service.rdf.insights;

/**
 * SPARQL builder for Phase 3.4 dataset recommendations. Given an entity URI, scores every other
 * entity by graph-topology similarity along three dimensions:
 *
 * <ul>
 *   <li><b>Tag overlap</b> — number of distinct {@code om:hasTag} values shared with the seed.
 *   <li><b>Glossary overlap</b> — number of distinct {@code om:hasGlossaryTerm} values shared.
 *   <li><b>Lineage proximity</b> — number of distinct lineage neighbours both entities share, where
 *       a "neighbour" is reachable in one hop along {@code om:upstream}, {@code om:downstream},
 *       {@code prov:wasDerivedFrom}, or its inverse.
 * </ul>
 *
 * <p>The composite score is {@code 1.0·tags + 1.5·glossary + 2.0·lineage}. Lineage proximity is
 * weighted highest because it's a stronger structural signal than tag co-occurrence — two tables
 * that derive from the same source are tightly coupled, whereas two tables sharing a "PII" tag may
 * be entirely unrelated.
 *
 * <p>The query is a single SPARQL aggregate with three sub-SELECTs unioned together so the engine
 * can compute each dimension once and the outer GROUP BY sums them; this keeps the query plan
 * cache-friendly and keeps the result set naturally sparse — entities with zero overlap on any
 * dimension never appear in the union and so never reach the score formula.
 */
public final class RecommendationsQueryBuilder {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String PROV_NS = "http://www.w3.org/ns/prov#";

  /** Default top-N when caller doesn't specify. */
  public static final int DEFAULT_LIMIT = 10;

  /** Hard cap so a buggy caller can't ask for hundreds of recommendations. */
  public static final int MAX_LIMIT = 50;

  static final double WEIGHT_TAG = 1.0;
  static final double WEIGHT_GLOSSARY = 1.5;
  static final double WEIGHT_LINEAGE = 2.0;

  private RecommendationsQueryBuilder() {}

  /**
   * Build the recommendations SPARQL.
   *
   * @param entityUri seed entity URI; validated as absolute http(s)
   * @param limit number of recommendations; clamped to [1, {@link #MAX_LIMIT}]
   */
  public static String build(String entityUri, int limit) {
    String safeUri = LineagePathBuilder.validateNodeUri("entityUri", entityUri);
    int safeLimit = clamp(limit, 1, MAX_LIMIT);
    return String.join(
        "\n",
        "PREFIX om: <" + OM_NS + ">",
        "PREFIX prov: <" + PROV_NS + ">",
        "SELECT ?candidate",
        "       (SUM(?t) AS ?tagOverlap)",
        "       (SUM(?g) AS ?glossaryOverlap)",
        "       (SUM(?l) AS ?lineageOverlap)",
        "       ((SUM(?t) * " + WEIGHT_TAG + ")",
        "        + (SUM(?g) * " + WEIGHT_GLOSSARY + ")",
        "        + (SUM(?l) * " + WEIGHT_LINEAGE + ") AS ?score)",
        "WHERE {",
        "  {",
        "    SELECT ?candidate (COUNT(DISTINCT ?tag) AS ?t) (0 AS ?g) (0 AS ?l) WHERE {",
        "      <" + safeUri + "> om:hasTag ?tag .",
        "      ?candidate om:hasTag ?tag .",
        "      FILTER(?candidate != <" + safeUri + ">)",
        "    } GROUP BY ?candidate",
        "  } UNION {",
        "    SELECT ?candidate (0 AS ?t) (COUNT(DISTINCT ?term) AS ?g) (0 AS ?l) WHERE {",
        "      <" + safeUri + "> om:hasGlossaryTerm ?term .",
        "      ?candidate om:hasGlossaryTerm ?term .",
        "      FILTER(?candidate != <" + safeUri + ">)",
        "    } GROUP BY ?candidate",
        "  } UNION {",
        "    SELECT ?candidate (0 AS ?t) (0 AS ?g) (COUNT(DISTINCT ?n) AS ?l) WHERE {",
        "      <"
            + safeUri
            + "> (om:upstream|om:downstream|prov:wasDerivedFrom|^prov:wasDerivedFrom) ?n .",
        "      ?candidate (om:upstream|om:downstream|prov:wasDerivedFrom|^prov:wasDerivedFrom) ?n .",
        "      FILTER(?candidate != <" + safeUri + ">)",
        "    } GROUP BY ?candidate",
        "  }",
        "}",
        "GROUP BY ?candidate",
        "ORDER BY DESC(?score) ?candidate",
        "LIMIT " + safeLimit);
  }

  private static int clamp(int v, int lo, int hi) {
    if (v < lo) return lo;
    return Math.min(v, hi);
  }
}
