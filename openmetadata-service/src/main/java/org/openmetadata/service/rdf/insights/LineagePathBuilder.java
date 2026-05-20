package org.openmetadata.service.rdf.insights;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Builds the SPARQL fragments used by {@link LineagePathFinder} to walk one BFS frontier step
 * across the lineage graph.
 *
 * <p>The lineage graph is built from three predicates emitted by {@code RdfPropertyMapper}:
 *
 * <ul>
 *   <li>{@code prov:wasDerivedFrom} — entity → its upstream source
 *   <li>{@code om:upstream} — same direction, OpenMetadata-flavored alias
 *   <li>{@code om:downstream} — entity → an entity that derives from it
 * </ul>
 *
 * <p>For an "upstream" walk from {@code A}, the algorithm follows {@code A prov:wasDerivedFrom ?x}
 * and {@code A om:upstream ?x}. For a "downstream" walk it inverts {@code prov:wasDerivedFrom}
 * (asks for {@code ?x prov:wasDerivedFrom A}) and follows {@code A om:downstream ?x}. {@code both}
 * does both.
 *
 * <p>All inputs are validated; any URI not recognized by {@link URI} is rejected before SPARQL is
 * emitted. The class is intentionally side-effect-free so it can be exhaustively unit-tested.
 */
public final class LineagePathBuilder {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String PROV_NS = "http://www.w3.org/ns/prov#";

  /** Default upper bound on BFS depth. */
  public static final int DEFAULT_MAX_HOPS = 6;

  /** Hard cap so a buggy caller can't ask for thousands of frontier expansions. */
  public static final int HARD_MAX_HOPS = 25;

  private LineagePathBuilder() {}

  /** Allowed walk directions for {@link #frontierQuery(Collection, Direction)}. */
  public enum Direction {
    UPSTREAM,
    DOWNSTREAM,
    BOTH;

    public static Direction parse(String value) {
      if (value == null || value.isBlank()) return UPSTREAM;
      return switch (value.trim().toLowerCase(Locale.ROOT)) {
        case "upstream" -> UPSTREAM;
        case "downstream" -> DOWNSTREAM;
        case "both" -> BOTH;
        default -> throw new IllegalArgumentException(
            "direction must be one of: upstream, downstream, both (got: " + value + ")");
      };
    }
  }

  /** Validate a node URI. Returns the URI string. Throws if missing/blank/malformed. */
  public static String validateNodeUri(String label, String uri) {
    if (uri == null || uri.isBlank()) {
      throw new IllegalArgumentException(label + " is required");
    }
    String trimmed = uri.trim();
    if (trimmed.contains(">") || trimmed.contains("<") || trimmed.contains("\n")) {
      throw new IllegalArgumentException(label + " contains illegal characters");
    }
    URI parsed;
    try {
      parsed = new URI(trimmed);
    } catch (URISyntaxException e) {
      throw new IllegalArgumentException(label + " is not a valid URI: " + e.getMessage());
    }
    if (!parsed.isAbsolute()) {
      throw new IllegalArgumentException(label + " must be an absolute URI");
    }
    String scheme = parsed.getScheme();
    if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
      throw new IllegalArgumentException(
          label + " must use http or https scheme (got: " + scheme + ")");
    }
    return trimmed;
  }

  /** Clamp maxHops to [1, HARD_MAX_HOPS]; null or < 1 falls back to DEFAULT_MAX_HOPS. */
  public static int clampMaxHops(Integer requested) {
    if (requested == null || requested < 1) return DEFAULT_MAX_HOPS;
    return Math.min(requested, HARD_MAX_HOPS);
  }

  /**
   * Build a SPARQL SELECT that, given a frontier of node URIs, returns every
   * (?from, ?to, ?predicate) triple reachable in one hop in the requested direction. The result is
   * always written so that ?from is the frontier node being expanded — i.e. for a downstream walk
   * the inverse of {@code prov:wasDerivedFrom} is rewritten so the caller can treat ?from as
   * "current" and ?to as "next" without branching.
   */
  public static String frontierQuery(Collection<String> frontier, Direction direction) {
    if (frontier == null || frontier.isEmpty()) {
      throw new IllegalArgumentException("frontier must contain at least one URI");
    }
    Set<String> validated = new LinkedHashSet<>();
    for (String uri : frontier) validated.add(validateNodeUri("frontier node", uri));

    StringBuilder values = new StringBuilder();
    for (String uri : validated) values.append("    <").append(uri).append(">\n");

    StringBuilder unions = new StringBuilder();
    if (direction == Direction.UPSTREAM || direction == Direction.BOTH) {
      unions.append(union("?from prov:wasDerivedFrom ?to", "prov:wasDerivedFrom"));
      unions.append(" UNION\n");
      unions.append(union("?from om:upstream ?to", "om:upstream"));
    }
    if (direction == Direction.DOWNSTREAM || direction == Direction.BOTH) {
      if (unions.length() > 0) unions.append(" UNION\n");
      unions.append(union("?to prov:wasDerivedFrom ?from", "^prov:wasDerivedFrom"));
      unions.append(" UNION\n");
      unions.append(union("?from om:downstream ?to", "om:downstream"));
    }

    return String.join(
        "\n",
        "PREFIX om: <" + OM_NS + ">",
        "PREFIX prov: <" + PROV_NS + ">",
        "SELECT ?from ?to ?predicate WHERE {",
        "  VALUES ?from {",
        values.toString().stripTrailing(),
        "  }",
        "  {",
        unions.toString(),
        "  }",
        "  FILTER(?to != ?from)",
        "}");
  }

  /**
   * Build a SPARQL SELECT that returns the rdf:type values for a set of nodes. Used to decorate
   * the final path with class info without round-tripping per node.
   */
  public static String typesQuery(Collection<String> nodes) {
    if (nodes == null || nodes.isEmpty()) {
      throw new IllegalArgumentException("nodes must contain at least one URI");
    }
    Set<String> validated = new LinkedHashSet<>();
    for (String uri : nodes) validated.add(validateNodeUri("node", uri));

    StringBuilder values = new StringBuilder();
    for (String uri : validated) values.append("    <").append(uri).append(">\n");

    return String.join(
        "\n",
        "PREFIX om: <" + OM_NS + ">",
        "SELECT ?node ?type WHERE {",
        "  VALUES ?node {",
        values.toString().stripTrailing(),
        "  }",
        "  ?node a ?type .",
        "  FILTER(STRSTARTS(STR(?type), \"" + OM_NS + "\"))",
        "}");
  }

  private static String union(String triple, String predicateLabel) {
    return "    { " + triple + " . BIND(\"" + predicateLabel + "\" AS ?predicate) }";
  }
}
