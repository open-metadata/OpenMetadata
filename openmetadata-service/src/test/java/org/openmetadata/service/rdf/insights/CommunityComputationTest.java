package org.openmetadata.service.rdf.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.apache.jena.query.QueryFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.service.rdf.RdfRepository;

class CommunityComputationTest {

  @Nested
  @DisplayName("GraphType parsing")
  class GraphTypeParsing {

    @Test
    @DisplayName("Defaults to lineage when null/blank")
    void defaults() {
      assertEquals(
          CommunityComputation.GraphType.LINEAGE, CommunityComputation.GraphType.parse(null));
      assertEquals(
          CommunityComputation.GraphType.LINEAGE, CommunityComputation.GraphType.parse(""));
      assertEquals(
          CommunityComputation.GraphType.LINEAGE, CommunityComputation.GraphType.parse("   "));
    }

    @Test
    @DisplayName("Aliases for tagCoOccurrence are accepted")
    void tagAliases() {
      assertEquals(
          CommunityComputation.GraphType.TAG_CO_OCCURRENCE,
          CommunityComputation.GraphType.parse("tagCoOccurrence"));
      assertEquals(
          CommunityComputation.GraphType.TAG_CO_OCCURRENCE,
          CommunityComputation.GraphType.parse("tags"));
      assertEquals(
          CommunityComputation.GraphType.TAG_CO_OCCURRENCE,
          CommunityComputation.GraphType.parse("TAG"));
      assertEquals(
          CommunityComputation.GraphType.TAG_CO_OCCURRENCE,
          CommunityComputation.GraphType.parse("tag-co-occurrence"));
    }

    @Test
    @DisplayName("Unknown values are rejected")
    void unknown() {
      assertThrows(
          IllegalArgumentException.class,
          () -> CommunityComputation.GraphType.parse("citation_network"));
    }
  }

  @Nested
  @DisplayName("SPARQL well-formedness")
  class WellFormed {

    @Test
    @DisplayName("Lineage graph SPARQL parses with Jena and uses both upstream/downstream edges")
    void lineageSparqlParses() {
      String sparql = CommunityComputation.lineageGraphSparql("Table");
      QueryFactory.create(sparql);
      assertTrue(sparql.contains("prov:wasDerivedFrom"));
      assertTrue(sparql.contains("om:upstream"));
      assertTrue(sparql.contains("om:downstream"));
      assertTrue(sparql.contains("a om:Table"));
    }

    @Test
    @DisplayName("Tag co-occurrence SPARQL parses and groups by pair with COUNT(?shared)")
    void tagSparqlParses() {
      String sparql = CommunityComputation.tagCoOccurrenceSparql("Dashboard");
      QueryFactory.create(sparql);
      assertTrue(sparql.contains("om:hasTag"));
      assertTrue(sparql.contains("om:hasGlossaryTerm"));
      assertTrue(sparql.contains("COUNT(?shared)"));
      assertTrue(
          sparql.contains("STR(?from) < STR(?to)"),
          "Pairs must be canonicalized to avoid double-counting");
    }

    @Test
    @DisplayName("Listing SPARQL targets the entityType-specific named graph")
    void listingSparqlTargetsNamedGraph() {
      String sparql = CommunityComputation.listingSparql("table", "lineage");
      QueryFactory.create(sparql);
      assertTrue(
          sparql.contains(
              "FROM <https://open-metadata.org/ontology/insights/communities/lineage/table>"));
      assertTrue(sparql.contains("ORDER BY DESC(?size)"));
    }

    @Test
    @DisplayName("Listing SPARQL rejects bad entity / graph type before emitting SPARQL")
    void listingSparqlValidatesInput() {
      assertThrows(
          IllegalArgumentException.class,
          () -> CommunityComputation.listingSparql("table OR 1=1", "lineage"));
      assertThrows(
          IllegalArgumentException.class,
          () -> CommunityComputation.listingSparql("table", "elsewhere"));
    }
  }

  @Nested
  @DisplayName("SPARQL JSON → adjacency parsing")
  class GraphParsing {

    private static String row(String from, String to, String weight) {
      String w = weight == null ? "" : ",\"weight\":{\"value\":\"" + weight + "\"}";
      return "{\"from\":{\"value\":\"" + from + "\"},\"to\":{\"value\":\"" + to + "\"}" + w + "}";
    }

    private static String body(String... rows) {
      return "{\"results\":{\"bindings\":[" + String.join(",", rows) + "]}}";
    }

    @Test
    @DisplayName("Empty / null / blank input → empty adjacency")
    void empty() {
      assertTrue(CommunityComputation.parseGraph(null).isEmpty());
      assertTrue(CommunityComputation.parseGraph("").isEmpty());
      assertTrue(CommunityComputation.parseGraph("not json").isEmpty());
      assertTrue(CommunityComputation.parseGraph("{\"results\":{\"bindings\":[]}}").isEmpty());
    }

    @Test
    @DisplayName("Single edge yields one directed entry (Louvain symmetrizes internally)")
    void directedSingleEdge() {
      Map<String, Map<String, Double>> g =
          CommunityComputation.parseGraph(body(row("urn:a", "urn:b", "1.0")));
      assertEquals(1.0, g.get("urn:a").get("urn:b"));
      // The target node is registered (so Louvain sees it) but the reverse weight is NOT added —
      // Louvain.addAllEdges adds both directions to its internal adjacency. Duplicating here
      // would double-count every edge weight.
      assertTrue(g.containsKey("urn:b"), "target node must be a key so Louvain enumerates it");
      assertTrue(
          g.get("urn:b") == null || !g.get("urn:b").containsKey("urn:a"),
          "reverse-direction weight must not be populated by parseGraph");
    }

    @Test
    @DisplayName("Missing weight defaults to 1.0")
    void weightDefaults() {
      Map<String, Map<String, Double>> g =
          CommunityComputation.parseGraph(body(row("urn:a", "urn:b", null)));
      assertEquals(1.0, g.get("urn:a").get("urn:b"));
    }

    @Test
    @DisplayName("Self-loops are dropped")
    void selfLoopsDropped() {
      Map<String, Map<String, Double>> g =
          CommunityComputation.parseGraph(body(row("urn:a", "urn:a", "1.0")));
      assertTrue(g.isEmpty());
    }

    @Test
    @DisplayName("Non-positive weights are dropped")
    void nonPositiveDropped() {
      Map<String, Map<String, Double>> g =
          CommunityComputation.parseGraph(
              body(row("urn:a", "urn:b", "0"), row("urn:c", "urn:d", "-1")));
      assertTrue(g.isEmpty());
    }

    @Test
    @DisplayName("Non-numeric weights fall back to default and the edge is kept")
    void nonNumericFallback() {
      Map<String, Map<String, Double>> g =
          CommunityComputation.parseGraph(body(row("urn:a", "urn:b", "garbage")));
      assertEquals(1.0, g.get("urn:a").get("urn:b"));
    }
  }

  @Nested
  @DisplayName("End-to-end computeAndPersist")
  class EndToEnd {

    @Test
    @DisplayName("Empty graph: returns 0 communities, no SPARQL UPDATE")
    void emptyGraph() {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenReturn("{\"results\":{\"bindings\":[]}}");
      CommunityComputation comp = new CommunityComputation(repo);
      CommunityComputation.Result r = comp.computeAndPersist("table", "lineage");
      assertEquals(0, r.communities());
      assertEquals(0, r.membersTotal());
      verify(repo, never()).executeSparqlUpdate(anyString());
    }

    @Test
    @DisplayName("Two cliques persist as two om:Community resources with correct members")
    void twoCliques() {
      RdfRepository repo = mock(RdfRepository.class);
      String body =
          "{\"results\":{\"bindings\":["
              + edge("urn:a", "urn:b")
              + ","
              + edge("urn:b", "urn:c")
              + ","
              + edge("urn:a", "urn:c")
              + ","
              + edge("urn:x", "urn:y")
              + ","
              + edge("urn:y", "urn:z")
              + ","
              + edge("urn:x", "urn:z")
              + ","
              + edge("urn:c", "urn:x")
              + "]}}";
      when(repo.executeSparqlQuery(anyString(), anyString())).thenReturn(body);

      CommunityComputation.Result r =
          new CommunityComputation(repo).computeAndPersist("table", "lineage");
      assertEquals(2, r.communities());
      assertEquals(6, r.membersTotal());

      ArgumentCaptor<String> update = ArgumentCaptor.forClass(String.class);
      verify(repo, times(1)).executeSparqlUpdate(update.capture());
      String sparql = update.getValue();
      assertTrue(sparql.contains("om:Community"));
      assertTrue(sparql.contains("om:hasMember"));
      assertTrue(sparql.contains("om:communitySize"));
      assertTrue(sparql.contains("om:modularity"));
      assertTrue(
          sparql.contains(
              "WITH <https://open-metadata.org/ontology/insights/communities/lineage/table>"),
          "Must persist into lineage/table named graph: " + sparql);
      assertTrue(sparql.contains("urn:a"));
      assertTrue(sparql.contains("urn:z"));
    }

    @Test
    @DisplayName("Bad entity type is rejected before any SPARQL is sent")
    void badEntityTypeRejected() {
      RdfRepository repo = mock(RdfRepository.class);
      assertThrows(
          IllegalArgumentException.class,
          () -> new CommunityComputation(repo).computeAndPersist("foo OR 1=1", "lineage"));
      verify(repo, never()).executeSparqlQuery(anyString(), anyString());
    }

    @Test
    @DisplayName("Unknown graphType is rejected before any SPARQL is sent")
    void badGraphType() {
      RdfRepository repo = mock(RdfRepository.class);
      assertThrows(
          IllegalArgumentException.class,
          () -> new CommunityComputation(repo).computeAndPersist("table", "weather"));
      verify(repo, never()).executeSparqlQuery(anyString(), anyString());
    }

    @Test
    @DisplayName("SPARQL exception during extraction → empty result, no update")
    void sparqlError() {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenThrow(new RuntimeException("Fuseki down"));
      CommunityComputation.Result r =
          new CommunityComputation(repo).computeAndPersist("table", "lineage");
      assertEquals(0, r.communities());
      verify(repo, never()).executeSparqlUpdate(anyString());
    }

    @Test
    @DisplayName("Tag-co-occurrence run uses the tagCoOccurrence named graph")
    void tagsTargetsTagGraph() {
      RdfRepository repo = mock(RdfRepository.class);
      String body = "{\"results\":{\"bindings\":[" + edgeWithWeight("urn:a", "urn:b", 3.0) + "]}}";
      when(repo.executeSparqlQuery(anyString(), anyString())).thenReturn(body);

      new CommunityComputation(repo).computeAndPersist("table", "tagCoOccurrence");
      verify(repo)
          .executeSparqlUpdate(
              contains(
                  "<https://open-metadata.org/ontology/insights/communities/tagCoOccurrence/table>"));
    }

    private static String edge(String from, String to) {
      return "{\"from\":{\"value\":\"" + from + "\"},\"to\":{\"value\":\"" + to + "\"}}";
    }

    private static String edgeWithWeight(String from, String to, double w) {
      return "{\"from\":{\"value\":\""
          + from
          + "\"},\"to\":{\"value\":\""
          + to
          + "\"},\"weight\":{\"value\":\""
          + w
          + "\"}}";
    }
  }
}
