package org.openmetadata.service.rdf.insights;

/**
 * SPARQL builders for Phase 3.5 catalog-wide insights — pure aggregate views over the existing
 * triples, no precomputation. Each method is a standalone SPARQL SELECT with input validation;
 * callers ({@code RdfResource}) hand the query verbatim to the SPARQL endpoint and stream the
 * results back as SPARQL-JSON.
 *
 * <ul>
 *   <li>{@link #tagCoOccurrence(int, int)} — pairs of tags that get applied to the same entity, by
 *       overlap count. Pairs are canonicalised (str(a) &lt; str(b)) so each pair is reported once.
 *   <li>{@link #glossaryReach(int, int)} — glossary terms ranked by the number of distinct domains
 *       they appear under. Useful for "term used across the most domains" insight in Phase 3.5.
 * </ul>
 */
public final class CoOccurrenceQueryBuilder {

  private static final String OM_NS = "https://open-metadata.org/ontology/";

  /** Default top-N when caller doesn't specify. */
  public static final int DEFAULT_LIMIT = 20;

  /** Hard cap so a buggy caller can't ask for tens of thousands of rows. */
  public static final int MAX_LIMIT = 100;

  /** Default minimum overlap threshold — pairs that co-occur on fewer entities are dropped. */
  public static final int DEFAULT_MIN_COUNT = 2;

  private CoOccurrenceQueryBuilder() {}

  /**
   * Tag co-occurrence: pairs of tags applied to the same entity together at least {@code minCount}
   * times. Result columns: ?tagA, ?tagB, ?count.
   *
   * @param minCount minimum number of shared entities; values &lt; 1 are clamped to 1
   * @param limit number of rows; clamped to [1, {@link #MAX_LIMIT}]
   */
  public static String tagCoOccurrence(int minCount, int limit) {
    int safeMin = clamp(minCount, 1, Integer.MAX_VALUE);
    int safeLimit = clamp(limit, 1, MAX_LIMIT);
    return String.join(
        "\n",
        "PREFIX om: <" + OM_NS + ">",
        "SELECT ?tagA ?tagB (COUNT(?entity) AS ?count) WHERE {",
        "  ?entity om:hasTag ?tagA .",
        "  ?entity om:hasTag ?tagB .",
        "  FILTER(STR(?tagA) < STR(?tagB))",
        "}",
        "GROUP BY ?tagA ?tagB",
        "HAVING (COUNT(?entity) >= " + safeMin + ")",
        "ORDER BY DESC(?count) ?tagA ?tagB",
        "LIMIT " + safeLimit);
  }

  /**
   * Glossary reach: each glossary term + the number of distinct domains it shows up in. A term
   * that's used by tables across many domains is more cross-cutting and signals a richer concept.
   *
   * <p>Result columns: ?term, ?domainCount.
   *
   * @param minDomains floor on the count; values &lt; 1 become 1
   * @param limit number of rows; clamped to [1, {@link #MAX_LIMIT}]
   */
  public static String glossaryReach(int minDomains, int limit) {
    int safeMin = clamp(minDomains, 1, Integer.MAX_VALUE);
    int safeLimit = clamp(limit, 1, MAX_LIMIT);
    return String.join(
        "\n",
        "PREFIX om: <" + OM_NS + ">",
        "SELECT ?term (COUNT(DISTINCT ?domain) AS ?domainCount) WHERE {",
        "  ?entity om:hasGlossaryTerm ?term .",
        "  ?entity om:hasDomain ?domain .",
        "}",
        "GROUP BY ?term",
        "HAVING (COUNT(DISTINCT ?domain) >= " + safeMin + ")",
        "ORDER BY DESC(?domainCount) ?term",
        "LIMIT " + safeLimit);
  }

  /**
   * Tag popularity: tags ranked by the number of entities they're applied to. Result columns:
   * ?tag, ?entityCount.
   */
  public static String tagPopularity(int limit) {
    int safeLimit = clamp(limit, 1, MAX_LIMIT);
    return String.join(
        "\n",
        "PREFIX om: <" + OM_NS + ">",
        "SELECT ?tag (COUNT(DISTINCT ?entity) AS ?entityCount) WHERE {",
        "  ?entity om:hasTag ?tag .",
        "}",
        "GROUP BY ?tag",
        "ORDER BY DESC(?entityCount) ?tag",
        "LIMIT " + safeLimit);
  }

  private static int clamp(int v, int lo, int hi) {
    if (v < lo) return lo;
    return Math.min(v, hi);
  }
}
