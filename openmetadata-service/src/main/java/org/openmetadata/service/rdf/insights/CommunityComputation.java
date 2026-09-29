package org.openmetadata.service.rdf.insights;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfIriValidator;
import org.openmetadata.service.rdf.RdfRepository;

/**
 * Phase 3.2 community-detection driver. Pulls a sub-graph out of Fuseki for one
 * {@link GraphType graph kind} (lineage or tag-co-occurrence) restricted to one entity type, runs
 * {@link Louvain}, and persists the resulting partition under a dedicated named graph
 * {@code <om:insights/communities/{graphType}/{entityType}>}.
 *
 * <p>Each persisted community is an {@code om:Community} resource with {@code om:hasMember},
 * {@code om:modularity}, {@code om:communityType}, and {@code om:communitySize}. The
 * {@code modularity} value is the same on every community of a given run — it describes the
 * partition as a whole, not any single cluster.
 *
 * <p>Determinism: {@code Louvain} processes nodes in the SPARQL result iteration order, so as long
 * as Fuseki returns rows in a stable order (Jena's TDB does, modulo equal-cost solutions), the
 * persisted membership is reproducible.
 */
@Slf4j
public final class CommunityComputation {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String INSIGHTS_GRAPH_PREFIX = OM_NS + "insights/communities/";
  private static final String COMMUNITY_URI_PREFIX = OM_NS + "instance/Community/";

  private final RdfRepository repository;
  private final Louvain louvain;

  public CommunityComputation(RdfRepository repository) {
    this(repository, new Louvain());
  }

  CommunityComputation(RdfRepository repository, Louvain louvain) {
    this.repository = repository;
    this.louvain = louvain;
  }

  public Result computeAndPersist(String entityType, String graphType) {
    String safeType = ImportanceQueryBuilder.validateEntityType(entityType);
    GraphType gt = GraphType.parse(graphType);
    String classLocalName = capitalize(safeType);

    Map<String, Map<String, Double>> graph = extractGraph(classLocalName, gt);
    if (graph.isEmpty()) {
      LOG.info(
          "No edges of kind {} found for entity type {}; skipping community run",
          gt,
          classLocalName);
      return new Result(safeType, gt.label, 0, 0, 0.0);
    }
    Louvain.Result<String> partition = louvain.compute(graph);
    persistCommunities(classLocalName, gt, partition);
    return new Result(
        safeType,
        gt.label,
        partition.communityCount(),
        partition.communityByNode().size(),
        partition.modularity());
  }

  /**
   * Build the SPARQL SELECT used by GET /v1/rdf/insights/communities to list previously persisted
   * communities for the given (entityType, graphType) pair.
   */
  public static String listingSparql(String entityType, String graphType) {
    String safeType = ImportanceQueryBuilder.validateEntityType(entityType);
    GraphType gt = GraphType.parse(graphType);
    String classLocalName = capitalize(safeType);
    String graphUri =
        INSIGHTS_GRAPH_PREFIX + gt.label + "/" + classLocalName.toLowerCase(Locale.ROOT);
    return String.join(
        "\n",
        "PREFIX om: <" + OM_NS + ">",
        "SELECT ?community ?size ?modularity ?member",
        "FROM <" + graphUri + ">",
        "WHERE {",
        "  ?community a om:Community ;",
        "    om:communitySize ?size ;",
        "    om:modularity ?modularity ;",
        "    om:hasMember ?member .",
        "}",
        "ORDER BY DESC(?size) ?community ?member");
  }

  Map<String, Map<String, Double>> extractGraph(String classLocalName, GraphType graphType) {
    String sparql =
        switch (graphType) {
          case LINEAGE -> lineageGraphSparql(classLocalName);
          case TAG_CO_OCCURRENCE -> tagCoOccurrenceSparql(classLocalName);
        };
    String json;
    try {
      json = repository.executeSparqlQuery(sparql, "application/sparql-results+json");
    } catch (Exception e) {
      LOG.error("Failed to extract {} graph for {}", graphType, classLocalName, e);
      return Map.of();
    }
    return parseGraph(json);
  }

  static String lineageGraphSparql(String classLocalName) {
    return String.join(
        "\n",
        "PREFIX om: <" + OM_NS + ">",
        "PREFIX prov: <http://www.w3.org/ns/prov#>",
        "SELECT ?from ?to (1.0 AS ?weight) WHERE {",
        "  ?from a om:" + classLocalName + " .",
        "  ?to a om:" + classLocalName + " .",
        "  {",
        "    ?from prov:wasDerivedFrom ?to .",
        "  } UNION {",
        "    ?from om:upstream ?to .",
        "  } UNION {",
        "    ?to om:downstream ?from .",
        "  }",
        "  FILTER(?from != ?to)",
        "}");
  }

  static String tagCoOccurrenceSparql(String classLocalName) {
    return String.join(
        "\n",
        "PREFIX om: <" + OM_NS + ">",
        "SELECT ?from ?to (COUNT(?shared) AS ?weight) WHERE {",
        "  ?from a om:" + classLocalName + " .",
        "  ?to a om:" + classLocalName + " .",
        "  {",
        "    ?from om:hasTag ?shared .",
        "    ?to om:hasTag ?shared .",
        "  } UNION {",
        "    ?from om:hasGlossaryTerm ?shared .",
        "    ?to om:hasGlossaryTerm ?shared .",
        "  }",
        "  FILTER(STR(?from) < STR(?to))",
        "}",
        "GROUP BY ?from ?to");
  }

  /**
   * Parses the SPARQL bindings into a directed adjacency map (one weighted entry per edge). The
   * companion SPARQL query already canonicalises with {@code FILTER(STR(?from) &lt; STR(?to))} so
   * each pair appears once. {@link Louvain#addAllEdges} is responsible for symmetrising the
   * adjacency internally — emitting both directions here would double-count every edge weight.
   *
   * <p>Each target node is still registered as a (possibly-empty) key so that Louvain's
   * {@code graph.keySet()} includes every participating node, not only the ones that appear as a
   * source.
   */
  static Map<String, Map<String, Double>> parseGraph(String selectJson) {
    Map<String, Map<String, Double>> graph = new LinkedHashMap<>();
    if (selectJson == null || selectJson.isBlank()) return graph;
    try {
      JsonNode root = JsonUtils.readTree(selectJson);
      JsonNode bindings = root.path("results").path("bindings");
      if (!bindings.isArray()) return graph;
      for (JsonNode row : bindings) {
        String from = textValue(row, "from");
        String to = textValue(row, "to");
        if (from == null || to == null || from.equals(to)) continue;
        double weight = doubleValue(row, "weight", 1.0);
        if (weight <= 0) continue;
        graph.computeIfAbsent(from, k -> new HashMap<>()).merge(to, weight, Double::sum);
        // Register the target as a node too, without adding the reverse edge weight. Louvain
        // will symmetrise the adjacency itself; we just need every node visible to it.
        graph.computeIfAbsent(to, k -> new HashMap<>());
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse community graph SPARQL result: {}", e.getMessage());
    }
    return graph;
  }

  void persistCommunities(
      String classLocalName, GraphType graphType, Louvain.Result<String> partition) {
    String graphUri =
        INSIGHTS_GRAPH_PREFIX + graphType.label + "/" + classLocalName.toLowerCase(Locale.ROOT);
    Map<Integer, List<String>> members = partition.membersByCommunity();

    StringBuilder update = new StringBuilder();
    update.append("PREFIX om: <").append(OM_NS).append(">\n");
    update.append("PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n");
    update
        .append("WITH <")
        .append(graphUri)
        .append("> DELETE { ?s ?p ?o } WHERE { ?s a om:Community ; ?p ?o } ;\n");
    update.append("INSERT DATA { GRAPH <").append(graphUri).append("> {\n");
    for (Map.Entry<Integer, List<String>> entry : members.entrySet()) {
      String communityUri =
          COMMUNITY_URI_PREFIX
              + graphType.label
              + "/"
              + classLocalName.toLowerCase(Locale.ROOT)
              + "/"
              + entry.getKey();
      update
          .append("  <")
          .append(communityUri)
          .append("> a om:Community ; om:communityType \"")
          .append(graphType.label)
          .append("\" ; om:communitySize \"")
          .append(entry.getValue().size())
          .append("\"^^xsd:integer ; om:modularity \"")
          .append(partition.modularity())
          .append("\"^^xsd:double");
      for (String member : entry.getValue()) {
        String memberIri = RdfIriValidator.sanitizeStoredIri(member);
        if (memberIri == null) {
          LOG.warn("Skipping community member with malformed IRI: {}", member);
          continue;
        }
        update.append(" ; om:hasMember <").append(memberIri).append(">");
      }
      update.append(" .\n");
    }
    update.append("} }");
    try {
      repository.executeSparqlUpdate(update.toString());
    } catch (Exception e) {
      LOG.error("Failed to persist communities for {} / {}", classLocalName, graphType, e);
    }
  }

  private static String textValue(JsonNode row, String varName) {
    JsonNode node = row.path(varName);
    if (node.isMissingNode() || node.isNull()) return null;
    JsonNode value = node.path("value");
    return value.isMissingNode() || value.isNull() ? null : value.asText();
  }

  private static double doubleValue(JsonNode row, String varName, double fallback) {
    JsonNode node = row.path(varName);
    if (node.isMissingNode() || node.isNull()) return fallback;
    JsonNode value = node.path("value");
    if (value.isMissingNode() || value.isNull()) return fallback;
    try {
      return Double.parseDouble(value.asText());
    } catch (NumberFormatException e) {
      return fallback;
    }
  }

  private static String capitalize(String s) {
    if (s == null || s.isEmpty()) return s;
    return Character.toUpperCase(s.charAt(0)) + s.substring(1);
  }

  /** Source graph kinds supported by community detection. */
  public enum GraphType {
    LINEAGE("lineage"),
    TAG_CO_OCCURRENCE("tagCoOccurrence");

    public final String label;

    GraphType(String label) {
      this.label = label;
    }

    public static GraphType parse(String value) {
      if (value == null || value.isBlank()) return LINEAGE;
      String norm = value.trim().toLowerCase(Locale.ROOT);
      return switch (norm) {
        case "lineage" -> LINEAGE;
        case "tagcooccurrence",
            "tag",
            "tags",
            "tag-co-occurrence",
            "tag_co_occurrence" -> TAG_CO_OCCURRENCE;
        default -> throw new IllegalArgumentException(
            "graphType must be one of: lineage, tagCoOccurrence (got: " + value + ")");
      };
    }
  }

  /** Result of a community-detection run. */
  public record Result(
      String entityType, String graphType, int communities, int membersTotal, double modularity) {}
}
