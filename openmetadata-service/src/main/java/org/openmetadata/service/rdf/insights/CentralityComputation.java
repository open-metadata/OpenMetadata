package org.openmetadata.service.rdf.insights;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfIriValidator;
import org.openmetadata.service.rdf.RdfRepository;

/**
 * Pulls a graph snapshot of one entity type out of Fuseki, runs {@link PageRank} on it, and
 * persists the resulting scores back into the named graph
 * {@code <om:insights/centrality/{entityType}>}. The {@code /v1/rdf/insights/important}
 * endpoint reads those triples through the {@code om:centralityScore} predicate.
 *
 * <p>Edge weights chosen to reflect importance for governance purposes:
 *
 * <ul>
 *   <li>{@code prov:wasDerivedFrom} — 1.0 (lineage)
 *   <li>{@code om:hasTag}, {@code om:hasGlossaryTerm} — 0.5 (semantic linkage)
 *   <li>{@code om:hasColumn} — 0.2 (containment, weak)
 * </ul>
 *
 * <p>Scope: only entities of the requested type are added as nodes; off-type targets become
 * dangling sinks so they don't hijack mass. PageRank is run with default damping 0.85.
 */
@Slf4j
public final class CentralityComputation {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String INSIGHTS_GRAPH_PREFIX = OM_NS + "insights/centrality/";

  private final RdfRepository repository;
  private final PageRank pageRank;

  public CentralityComputation(RdfRepository repository) {
    this(repository, new PageRank());
  }

  CentralityComputation(RdfRepository repository, PageRank pageRank) {
    this.repository = repository;
    this.pageRank = pageRank;
  }

  /**
   * Run centrality for one entity type end-to-end: extract → compute → persist.
   *
   * @return summary describing what got computed.
   */
  public Result computeAndPersist(String entityType) {
    String safeType = ImportanceQueryBuilder.validateEntityType(entityType);
    String classLocalName = capitalize(safeType);

    Map<String, Map<String, Double>> graph = extractGraph(classLocalName);
    if (graph.isEmpty()) {
      LOG.info("No entities of type {} found; skipping centrality run", classLocalName);
      return new Result(safeType, 0, 0, false);
    }
    PageRank.Result<String> ranked = pageRank.compute(graph);
    persistScores(classLocalName, ranked.scores());
    return new Result(safeType, ranked.scores().size(), ranked.iterations(), ranked.converged());
  }

  /** Extract the graph snapshot from Fuseki via SPARQL. Visible for testing. */
  Map<String, Map<String, Double>> extractGraph(String classLocalName) {
    String sparql =
        String.join(
            "\n",
            "PREFIX om: <" + OM_NS + ">",
            "PREFIX prov: <http://www.w3.org/ns/prov#>",
            "SELECT ?from ?to ?predicate WHERE {",
            "  ?from a om:" + classLocalName + " .",
            "  {",
            "    ?from prov:wasDerivedFrom ?to .",
            "    BIND(\"prov:wasDerivedFrom\" AS ?predicate)",
            "  } UNION {",
            "    ?from om:hasTag ?to .",
            "    BIND(\"om:hasTag\" AS ?predicate)",
            "  } UNION {",
            "    ?from om:hasGlossaryTerm ?to .",
            "    BIND(\"om:hasGlossaryTerm\" AS ?predicate)",
            "  } UNION {",
            "    ?from om:hasColumn ?to .",
            "    BIND(\"om:hasColumn\" AS ?predicate)",
            "  }",
            "}");

    String json;
    try {
      json = repository.executeSparqlQuery(sparql, "application/sparql-results+json");
    } catch (Exception e) {
      LOG.error("Failed to extract centrality graph for {}", classLocalName, e);
      return Map.of();
    }
    return parseGraph(json);
  }

  /** Parse SPARQL JSON results into a weighted adjacency map. Visible for testing. */
  static Map<String, Map<String, Double>> parseGraph(String selectJson) {
    Map<String, Map<String, Double>> graph = new LinkedHashMap<>();
    if (selectJson == null || selectJson.isBlank()) {
      return graph;
    }
    try {
      JsonNode root = JsonUtils.readTree(selectJson);
      JsonNode bindings = root.path("results").path("bindings");
      if (!bindings.isArray()) return graph;
      for (JsonNode row : bindings) {
        String from = textValue(row, "from");
        String to = textValue(row, "to");
        String predicate = textValue(row, "predicate");
        if (from == null || to == null || predicate == null) continue;
        double weight = weightFor(predicate);
        graph.computeIfAbsent(from, k -> new HashMap<>()).merge(to, weight, Double::sum);
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse centrality SPARQL result: {}", e.getMessage());
    }
    return graph;
  }

  static double weightFor(String predicate) {
    return switch (predicate) {
      case "prov:wasDerivedFrom" -> 1.0;
      case "om:hasTag", "om:hasGlossaryTerm" -> 0.5;
      case "om:hasColumn" -> 0.2;
      default -> 0.0;
    };
  }

  /** Write the scores back to Fuseki under a dedicated named graph. Visible for testing. */
  void persistScores(String classLocalName, Map<String, Double> scores) {
    String graphUri = INSIGHTS_GRAPH_PREFIX + classLocalName.toLowerCase(java.util.Locale.ROOT);
    StringBuilder update = new StringBuilder();
    update.append("PREFIX om: <").append(OM_NS).append(">\n");
    update.append("PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n");
    update
        .append("WITH <")
        .append(graphUri)
        .append(
            "> DELETE { ?s om:centralityScore ?o ; om:centralityRank ?r } WHERE { ?s om:centralityScore ?o . OPTIONAL { ?s om:centralityRank ?r } } ;\n");
    update.append("INSERT DATA { GRAPH <").append(graphUri).append("> {\n");
    int rank = 1;
    for (Map.Entry<String, Double> e :
        scores.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .toList()) {
      String iri = RdfIriValidator.sanitizeStoredIri(e.getKey());
      if (iri == null) {
        LOG.warn("Skipping centrality score for malformed entity IRI: {}", e.getKey());
        continue;
      }
      update
          .append("  <")
          .append(iri)
          .append("> om:centralityScore \"")
          .append(e.getValue())
          .append("\"^^xsd:double ; om:centralityRank \"")
          .append(rank++)
          .append("\"^^xsd:integer .\n");
    }
    update.append("} }");
    try {
      repository.executeSparqlUpdate(update.toString());
    } catch (Exception e) {
      LOG.error("Failed to persist centrality scores for {}", classLocalName, e);
    }
  }

  private static String textValue(JsonNode row, String varName) {
    JsonNode node = row.path(varName);
    if (node.isMissingNode() || node.isNull()) return null;
    JsonNode value = node.path("value");
    return value.isMissingNode() || value.isNull() ? null : value.asText();
  }

  private static String capitalize(String s) {
    if (s == null || s.isEmpty()) return s;
    return Character.toUpperCase(s.charAt(0)) + s.substring(1);
  }

  /** Result of a centrality run. */
  public record Result(String entityType, int nodesScored, int iterations, boolean converged) {}

  /** Helper for tests to construct rows for parseGraph. */
  static List<String[]> exampleRows() {
    return List.of(
        new String[] {"urn:t1", "urn:t2", "prov:wasDerivedFrom"},
        new String[] {"urn:t1", "urn:c1", "om:hasColumn"});
  }
}
