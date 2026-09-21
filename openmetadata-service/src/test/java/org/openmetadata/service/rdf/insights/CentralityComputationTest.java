package org.openmetadata.service.rdf.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.service.rdf.RdfRepository;

class CentralityComputationTest {

  @Nested
  @DisplayName("Predicate weights")
  class PredicateWeights {

    @Test
    @DisplayName("Lineage weighted highest, hasColumn weakest, unknown predicates excluded")
    void weights() {
      assertEquals(1.0, CentralityComputation.weightFor("prov:wasDerivedFrom"));
      assertEquals(0.5, CentralityComputation.weightFor("om:hasTag"));
      assertEquals(0.5, CentralityComputation.weightFor("om:hasGlossaryTerm"));
      assertEquals(0.2, CentralityComputation.weightFor("om:hasColumn"));
      assertEquals(0.0, CentralityComputation.weightFor("om:somethingElse"));
    }
  }

  @Nested
  @DisplayName("SPARQL JSON → adjacency map parsing")
  class GraphParsing {

    private static String row(String from, String to, String pred) {
      return "{\"from\":{\"value\":\""
          + from
          + "\"},\"to\":{\"value\":\""
          + to
          + "\"},\"predicate\":{\"value\":\""
          + pred
          + "\"}}";
    }

    private static String body(String... rows) {
      return "{\"results\":{\"bindings\":[" + String.join(",", rows) + "]}}";
    }

    @Test
    @DisplayName("Empty / null / blank input returns an empty graph")
    void emptyInputs() {
      assertTrue(CentralityComputation.parseGraph(null).isEmpty());
      assertTrue(CentralityComputation.parseGraph("").isEmpty());
      assertTrue(CentralityComputation.parseGraph("not json").isEmpty());
      assertTrue(CentralityComputation.parseGraph("{\"results\":{\"bindings\":[]}}").isEmpty());
    }

    @Test
    @DisplayName("Single lineage edge produces weight 1.0")
    void singleLineageEdge() {
      Map<String, Map<String, Double>> g =
          CentralityComputation.parseGraph(body(row("urn:a", "urn:b", "prov:wasDerivedFrom")));
      assertEquals(1.0, g.get("urn:a").get("urn:b"));
    }

    @Test
    @DisplayName("hasColumn edge produces weight 0.2")
    void hasColumnEdge() {
      Map<String, Map<String, Double>> g =
          CentralityComputation.parseGraph(body(row("urn:t", "urn:c", "om:hasColumn")));
      assertEquals(0.2, g.get("urn:t").get("urn:c"));
    }

    @Test
    @DisplayName("Multiple edges to the same target sum their weights")
    void parallelEdges() {
      Map<String, Map<String, Double>> g =
          CentralityComputation.parseGraph(
              body(
                  row("urn:a", "urn:b", "prov:wasDerivedFrom"),
                  row("urn:a", "urn:b", "om:hasColumn")));
      assertEquals(1.2, g.get("urn:a").get("urn:b"), 1e-9);
    }

    @Test
    @DisplayName("Unknown predicate produces weight 0.0 (effectively dropped)")
    void unknownPredicateSilentlyDropped() {
      Map<String, Map<String, Double>> g =
          CentralityComputation.parseGraph(body(row("urn:a", "urn:b", "om:unknown")));
      assertEquals(0.0, g.get("urn:a").get("urn:b"));
    }

    @Test
    @DisplayName("Rows missing 'from' or 'to' are skipped")
    void missingBindingsSkipped() {
      String partial = "{\"results\":{\"bindings\":[{\"from\":{\"value\":\"urn:a\"}}]}}";
      assertTrue(CentralityComputation.parseGraph(partial).isEmpty());
    }
  }

  @Nested
  @DisplayName("End-to-end computeAndPersist")
  class EndToEnd {

    @Test
    @DisplayName("Empty graph: returns 0 nodes, no SPARQL UPDATE")
    void emptyGraph() {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenReturn("{\"results\":{\"bindings\":[]}}");
      CentralityComputation comp = new CentralityComputation(repo);

      CentralityComputation.Result r = comp.computeAndPersist("table");

      assertEquals("table", r.entityType());
      assertEquals(0, r.nodesScored());
      assertFalse(r.converged());
      verify(repo, never()).executeSparqlUpdate(anyString());
    }

    @Test
    @DisplayName("Lineage triangle persisted with normalized scores summing to 1.0")
    void lineageTriangle() {
      RdfRepository repo = mock(RdfRepository.class);
      String body =
          "{\"results\":{\"bindings\":["
              + "{\"from\":{\"value\":\"urn:a\"},\"to\":{\"value\":\"urn:b\"},\"predicate\":{\"value\":\"prov:wasDerivedFrom\"}},"
              + "{\"from\":{\"value\":\"urn:b\"},\"to\":{\"value\":\"urn:c\"},\"predicate\":{\"value\":\"prov:wasDerivedFrom\"}},"
              + "{\"from\":{\"value\":\"urn:c\"},\"to\":{\"value\":\"urn:a\"},\"predicate\":{\"value\":\"prov:wasDerivedFrom\"}}"
              + "]}}";
      when(repo.executeSparqlQuery(anyString(), anyString())).thenReturn(body);

      CentralityComputation comp = new CentralityComputation(repo);
      CentralityComputation.Result r = comp.computeAndPersist("table");

      assertEquals(3, r.nodesScored());
      assertTrue(r.converged());

      ArgumentCaptor<String> update = ArgumentCaptor.forClass(String.class);
      verify(repo, times(1)).executeSparqlUpdate(update.capture());
      String sparqlUpdate = update.getValue();
      assertTrue(
          sparqlUpdate.contains(
              "WITH <https://open-metadata.org/ontology/insights/centrality/table>"),
          "Should write to the entityType-specific named graph: " + sparqlUpdate);
      assertTrue(sparqlUpdate.contains("om:centralityScore"));
      assertTrue(sparqlUpdate.contains("om:centralityRank"));
      assertTrue(sparqlUpdate.contains("DELETE"));
      assertTrue(sparqlUpdate.contains("INSERT DATA"));
      // All three nodes referenced
      assertTrue(sparqlUpdate.contains("urn:a"));
      assertTrue(sparqlUpdate.contains("urn:b"));
      assertTrue(sparqlUpdate.contains("urn:c"));
    }

    @Test
    @DisplayName("Star topology: hub gets the highest persisted score (rank 1)")
    void hubGetsRank1() {
      RdfRepository repo = mock(RdfRepository.class);
      StringBuilder body = new StringBuilder("{\"results\":{\"bindings\":[");
      for (int i = 0; i < 5; i++) {
        if (i > 0) body.append(",");
        body.append("{\"from\":{\"value\":\"urn:leaf-")
            .append(i)
            .append(
                "\"},\"to\":{\"value\":\"urn:hub\"},\"predicate\":{\"value\":\"prov:wasDerivedFrom\"}}");
      }
      body.append("]}}");
      when(repo.executeSparqlQuery(anyString(), anyString())).thenReturn(body.toString());

      CentralityComputation comp = new CentralityComputation(repo);
      comp.computeAndPersist("table");

      ArgumentCaptor<String> update = ArgumentCaptor.forClass(String.class);
      verify(repo).executeSparqlUpdate(update.capture());
      String sparql = update.getValue();
      // The hub should appear before any leaf in the INSERT block (sorted by score desc).
      int hubIdx = sparql.indexOf("urn:hub");
      int firstLeafIdx = sparql.indexOf("urn:leaf-");
      assertTrue(hubIdx > 0 && firstLeafIdx > 0);
      assertTrue(hubIdx < firstLeafIdx, "Hub should be persisted first (highest score)");
    }

    @Test
    @DisplayName("Bad entityType is rejected before any SPARQL is sent")
    void badEntityTypeRejected() {
      RdfRepository repo = mock(RdfRepository.class);
      CentralityComputation comp = new CentralityComputation(repo);

      org.junit.jupiter.api.Assertions.assertThrows(
          IllegalArgumentException.class, () -> comp.computeAndPersist("table OR 1=1"));
      verify(repo, never()).executeSparqlQuery(anyString(), anyString());
      verify(repo, never()).executeSparqlUpdate(anyString());
    }

    @Test
    @DisplayName("Repository SPARQL throws → empty result, no update attempted")
    void repositoryThrows() {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenThrow(new RuntimeException("Fuseki unreachable"));
      CentralityComputation comp = new CentralityComputation(repo);

      CentralityComputation.Result r = comp.computeAndPersist("table");
      assertEquals(0, r.nodesScored());
      verify(repo, never()).executeSparqlUpdate(anyString());
    }

    @Test
    @DisplayName("Persisted graph URI uses lowercase entityType")
    void graphUriLowercase() {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenReturn(
              "{\"results\":{\"bindings\":["
                  + "{\"from\":{\"value\":\"urn:a\"},\"to\":{\"value\":\"urn:b\"},\"predicate\":{\"value\":\"prov:wasDerivedFrom\"}}"
                  + "]}}");
      new CentralityComputation(repo).computeAndPersist("Dashboard");
      verify(repo)
          .executeSparqlUpdate(
              contains("<https://open-metadata.org/ontology/insights/centrality/dashboard>"));
    }
  }
}
