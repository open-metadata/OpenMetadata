package org.openmetadata.service.rdf.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.rdf.RdfRepository;

/**
 * Tests for {@link LineagePathFinder}. Two kinds of tests:
 *
 * <ol>
 *   <li>Pure parsing — {@link LineagePathFinder#parseFrontierResult} and
 *       {@link LineagePathFinder#parseTypesResult} given hand-built SPARQL JSON.
 *   <li>End-to-end BFS — {@link LineagePathFinder#findPath} against a mocked {@link RdfRepository}.
 *       The mock dispatches on SPARQL shape (frontier vs types) and on which frontier URIs are
 *       embedded in the query, so each test reads as a tiny graph definition.
 * </ol>
 */
class LineagePathFinderTest {

  private static final String EMPTY = "{\"results\":{\"bindings\":[]}}";

  private static String frontierRow(String from, String to, String predicate) {
    return "{\"from\":{\"value\":\""
        + from
        + "\"},\"to\":{\"value\":\""
        + to
        + "\"},\"predicate\":{\"value\":\""
        + predicate
        + "\"}}";
  }

  private static String frontierBody(String... rows) {
    return "{\"results\":{\"bindings\":[" + String.join(",", rows) + "]}}";
  }

  private static String typesRow(String node, String type) {
    return "{\"node\":{\"value\":\"" + node + "\"},\"type\":{\"value\":\"" + type + "\"}}";
  }

  private static String typesBody(String... rows) {
    return "{\"results\":{\"bindings\":[" + String.join(",", rows) + "]}}";
  }

  @Nested
  @DisplayName("Frontier result parsing")
  class FrontierParsing {

    @Test
    @DisplayName("Empty / null / blank input → empty map")
    void empty() {
      Set<String> visited = new HashSet<>();
      assertTrue(LineagePathFinder.parseFrontierResult(null, visited).isEmpty());
      assertTrue(LineagePathFinder.parseFrontierResult("", visited).isEmpty());
      assertTrue(LineagePathFinder.parseFrontierResult("not json", visited).isEmpty());
      assertTrue(
          LineagePathFinder.parseFrontierResult("{\"results\":{\"bindings\":[]}}", visited)
              .isEmpty());
    }

    @Test
    @DisplayName("Already-visited 'to' nodes are dropped")
    void visitedDropped() {
      Set<String> visited = Set.of("urn:b");
      Map<String, LineagePathFinder.ParentEdge> next =
          LineagePathFinder.parseFrontierResult(
              frontierBody(frontierRow("urn:a", "urn:b", "prov:wasDerivedFrom")), visited);
      assertTrue(next.isEmpty(), "Already-visited target must not be re-added to next frontier");
    }

    @Test
    @DisplayName("First parent wins when multiple frontier rows mention same target")
    void firstParentWins() {
      Set<String> visited = new HashSet<>();
      Map<String, LineagePathFinder.ParentEdge> next =
          LineagePathFinder.parseFrontierResult(
              frontierBody(
                  frontierRow("urn:a", "urn:b", "prov:wasDerivedFrom"),
                  frontierRow("urn:c", "urn:b", "om:upstream")),
              visited);
      assertEquals("urn:a", next.get("urn:b").parent());
      assertEquals("prov:wasDerivedFrom", next.get("urn:b").predicate());
    }

    @Test
    @DisplayName("Rows with missing fields are skipped")
    void partialRows() {
      String partial = "{\"results\":{\"bindings\":[{\"from\":{\"value\":\"urn:a\"}}]}}";
      assertTrue(LineagePathFinder.parseFrontierResult(partial, new HashSet<>()).isEmpty());
    }
  }

  @Nested
  @DisplayName("Types result parsing")
  class TypesParsing {

    @Test
    @DisplayName("Empty / null / blank input → empty map")
    void empty() {
      assertTrue(LineagePathFinder.parseTypesResult(null).isEmpty());
      assertTrue(LineagePathFinder.parseTypesResult("").isEmpty());
      assertTrue(LineagePathFinder.parseTypesResult("garbage").isEmpty());
    }

    @Test
    @DisplayName("Multiple types per node are aggregated and deduplicated")
    void multipleTypes() {
      String body =
          typesBody(
              typesRow("urn:t", "https://open-metadata.org/ontology/Table"),
              typesRow("urn:t", "https://open-metadata.org/ontology/DataAsset"),
              typesRow("urn:t", "https://open-metadata.org/ontology/Table"));
      Map<String, List<String>> result = LineagePathFinder.parseTypesResult(body);
      List<String> types = result.get("urn:t");
      assertEquals(2, types.size(), "Duplicate types must be dropped");
      assertTrue(types.contains("https://open-metadata.org/ontology/Table"));
      assertTrue(types.contains("https://open-metadata.org/ontology/DataAsset"));
    }
  }

  @Nested
  @DisplayName("End-to-end BFS")
  class EndToEnd {

    private static final String A = "https://open-metadata.org/instance/Table/a";
    private static final String B = "https://open-metadata.org/instance/Table/b";
    private static final String C = "https://open-metadata.org/instance/Table/c";
    private static final String D = "https://open-metadata.org/instance/Table/d";

    private RdfRepository mockRepo() {
      RdfRepository repo = mock(RdfRepository.class);
      lenient().when(repo.executeSparqlQuery(anyString(), anyString())).thenReturn(EMPTY);
      return repo;
    }

    @Test
    @DisplayName("from == to: trivial single-node path returned immediately")
    void trivialIdentity() {
      RdfRepository repo = mockRepo();
      LineagePathFinder.Path path =
          new LineagePathFinder(repo).findPath(A, A, LineagePathBuilder.Direction.UPSTREAM, 6);
      assertTrue(path.found());
      assertEquals(0, path.hops());
      assertEquals(1, path.nodes().size());
      assertEquals(A, path.nodes().get(0).node());
      assertNull(path.nodes().get(0).predicate());
    }

    @Test
    @DisplayName("Direct neighbour found in one hop")
    void directNeighbour() {
      RdfRepository repo = mockRepo();
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenAnswer(
              inv -> {
                String sparql = inv.getArgument(0);
                if (sparql.contains("?node ?type")) return typesBody();
                if (sparql.contains("<" + A + ">")) {
                  return frontierBody(frontierRow(A, B, "prov:wasDerivedFrom"));
                }
                return EMPTY;
              });

      LineagePathFinder.Path path =
          new LineagePathFinder(repo).findPath(A, B, LineagePathBuilder.Direction.UPSTREAM, 6);
      assertTrue(path.found());
      assertEquals(1, path.hops());
      assertEquals(List.of(A, B), nodeUris(path));
      assertNull(path.nodes().get(0).predicate());
      assertEquals("prov:wasDerivedFrom", path.nodes().get(1).predicate());
    }

    @Test
    @DisplayName("Multi-hop A → B → C → D resolves with three predicate-tagged hops")
    void multiHop() {
      RdfRepository repo = mockRepo();
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenAnswer(
              inv -> {
                String sparql = inv.getArgument(0);
                if (sparql.contains("?node ?type")) return typesBody();
                if (sparql.contains("<" + A + ">")) {
                  return frontierBody(frontierRow(A, B, "prov:wasDerivedFrom"));
                }
                if (sparql.contains("<" + B + ">")) {
                  return frontierBody(frontierRow(B, C, "om:upstream"));
                }
                if (sparql.contains("<" + C + ">")) {
                  return frontierBody(frontierRow(C, D, "prov:wasDerivedFrom"));
                }
                return EMPTY;
              });

      LineagePathFinder.Path path =
          new LineagePathFinder(repo).findPath(A, D, LineagePathBuilder.Direction.UPSTREAM, 6);
      assertTrue(path.found());
      assertEquals(3, path.hops());
      assertEquals(List.of(A, B, C, D), nodeUris(path));
      assertEquals("prov:wasDerivedFrom", path.nodes().get(1).predicate());
      assertEquals("om:upstream", path.nodes().get(2).predicate());
      assertEquals("prov:wasDerivedFrom", path.nodes().get(3).predicate());
    }

    @Test
    @DisplayName("BFS prefers shorter paths even when a longer one is also reachable")
    void bfsShortest() {
      RdfRepository repo = mockRepo();
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenAnswer(
              inv -> {
                String sparql = inv.getArgument(0);
                if (sparql.contains("?node ?type")) return typesBody();
                if (sparql.contains("<" + A + ">")) {
                  return frontierBody(
                      frontierRow(A, B, "prov:wasDerivedFrom"),
                      frontierRow(A, D, "prov:wasDerivedFrom"));
                }
                if (sparql.contains("<" + B + ">") || sparql.contains("<" + D + ">")) {
                  return frontierBody(frontierRow(B, C, "prov:wasDerivedFrom"));
                }
                return EMPTY;
              });

      LineagePathFinder.Path path =
          new LineagePathFinder(repo).findPath(A, D, LineagePathBuilder.Direction.UPSTREAM, 6);
      assertTrue(path.found());
      assertEquals(1, path.hops(), "BFS must take the direct A→D edge, not the A→B→D detour");
    }

    @Test
    @DisplayName("Cycle A → B → A does not loop forever; resolves to nearest path")
    void cycleSafe() {
      RdfRepository repo = mockRepo();
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenAnswer(
              inv -> {
                String sparql = inv.getArgument(0);
                if (sparql.contains("?node ?type")) return typesBody();
                if (sparql.contains("<" + A + ">")) {
                  return frontierBody(frontierRow(A, B, "prov:wasDerivedFrom"));
                }
                if (sparql.contains("<" + B + ">")) {
                  return frontierBody(
                      frontierRow(B, A, "prov:wasDerivedFrom"),
                      frontierRow(B, C, "prov:wasDerivedFrom"));
                }
                return EMPTY;
              });

      LineagePathFinder.Path path =
          new LineagePathFinder(repo).findPath(A, C, LineagePathBuilder.Direction.UPSTREAM, 6);
      assertTrue(path.found());
      assertEquals(2, path.hops());
      assertEquals(List.of(A, B, C), nodeUris(path));
    }

    @Test
    @DisplayName("Disconnected target: BFS exhausts the frontier and reports found=false")
    void disconnected() {
      RdfRepository repo = mockRepo();
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenAnswer(
              inv -> {
                String sparql = inv.getArgument(0);
                if (sparql.contains("?node ?type")) return typesBody();
                if (sparql.contains("<" + A + ">")) {
                  return frontierBody(frontierRow(A, B, "prov:wasDerivedFrom"));
                }
                return EMPTY;
              });

      LineagePathFinder.Path path =
          new LineagePathFinder(repo).findPath(A, D, LineagePathBuilder.Direction.UPSTREAM, 6);
      assertFalse(path.found());
      assertEquals(0, path.hops());
      assertTrue(path.nodes().isEmpty());
      assertEquals(A, path.from());
      assertEquals(D, path.to());
    }

    @Test
    @DisplayName("maxHops budget is honoured; deeper targets are not found")
    void maxHopsBudget() {
      RdfRepository repo = mockRepo();
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenAnswer(
              inv -> {
                String sparql = inv.getArgument(0);
                if (sparql.contains("?node ?type")) return typesBody();
                if (sparql.contains("<" + A + ">")) {
                  return frontierBody(frontierRow(A, B, "prov:wasDerivedFrom"));
                }
                if (sparql.contains("<" + B + ">")) {
                  return frontierBody(frontierRow(B, C, "prov:wasDerivedFrom"));
                }
                if (sparql.contains("<" + C + ">")) {
                  return frontierBody(frontierRow(C, D, "prov:wasDerivedFrom"));
                }
                return EMPTY;
              });

      LineagePathFinder.Path path =
          new LineagePathFinder(repo).findPath(A, D, LineagePathBuilder.Direction.UPSTREAM, 2);
      assertFalse(path.found(), "Three hops cannot fit in a budget of two");
      assertEquals(2, path.maxHops());
    }

    @Test
    @DisplayName("SPARQL exception during frontier expansion → not-found, no exception bubbles")
    void sparqlError() {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenThrow(new RuntimeException("Fuseki down"));

      LineagePathFinder.Path path =
          new LineagePathFinder(repo).findPath(A, B, LineagePathBuilder.Direction.UPSTREAM, 6);
      assertFalse(path.found());
    }

    @Test
    @DisplayName("Bad URI: validation fires before any SPARQL is sent")
    void badUri() {
      RdfRepository repo = mock(RdfRepository.class);
      LineagePathFinder finder = new LineagePathFinder(repo);
      assertThrows(
          IllegalArgumentException.class,
          () -> finder.findPath("not a uri", B, LineagePathBuilder.Direction.UPSTREAM, 6));
      assertThrows(
          IllegalArgumentException.class,
          () -> finder.findPath(A, "ftp://x.com/y", LineagePathBuilder.Direction.UPSTREAM, 6));
    }

    @Test
    @DisplayName("Type decoration: each path node carries its om: rdf:types")
    void typeDecoration() {
      RdfRepository repo = mockRepo();
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenAnswer(
              inv -> {
                String sparql = inv.getArgument(0);
                if (sparql.contains("?node ?type")) {
                  return typesBody(
                      typesRow(A, "https://open-metadata.org/ontology/Table"),
                      typesRow(A, "https://open-metadata.org/ontology/DataAsset"),
                      typesRow(B, "https://open-metadata.org/ontology/Table"));
                }
                if (sparql.contains("<" + A + ">") && sparql.contains("?from ?to ?predicate")) {
                  return frontierBody(frontierRow(A, B, "prov:wasDerivedFrom"));
                }
                return EMPTY;
              });

      LineagePathFinder.Path path =
          new LineagePathFinder(repo).findPath(A, B, LineagePathBuilder.Direction.UPSTREAM, 6);
      assertTrue(path.found());
      assertEquals(2, path.nodes().get(0).rdfTypes().size());
      assertEquals(1, path.nodes().get(1).rdfTypes().size());
    }

    @Test
    @DisplayName("Type decoration failure does not break the path response")
    void typeDecorationFailure() {
      RdfRepository repo = mockRepo();
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenAnswer(
              inv -> {
                String sparql = inv.getArgument(0);
                if (sparql.contains("?node ?type")) {
                  throw new RuntimeException("Fuseki blip on type query");
                }
                if (sparql.contains("<" + A + ">")) {
                  return frontierBody(frontierRow(A, B, "prov:wasDerivedFrom"));
                }
                return EMPTY;
              });

      LineagePathFinder.Path path =
          new LineagePathFinder(repo).findPath(A, B, LineagePathBuilder.Direction.UPSTREAM, 6);
      assertTrue(path.found(), "Path must still be returned even if type decoration blows up");
      assertEquals(2, path.nodes().size());
      assertNotNull(path.nodes().get(0).rdfTypes());
      assertTrue(path.nodes().get(0).rdfTypes().isEmpty());
    }

    @Test
    @DisplayName("Direction defaults to upstream when null is passed")
    void directionDefault() {
      RdfRepository repo = mockRepo();
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenAnswer(
              inv -> {
                String sparql = inv.getArgument(0);
                if (sparql.contains("?node ?type")) return typesBody();
                if (sparql.contains("<" + A + ">")) {
                  return frontierBody(frontierRow(A, B, "prov:wasDerivedFrom"));
                }
                return EMPTY;
              });
      LineagePathFinder.Path path = new LineagePathFinder(repo).findPath(A, B, null, 6);
      assertTrue(path.found());
      assertEquals("upstream", path.direction());
    }
  }

  private static List<String> nodeUris(LineagePathFinder.Path path) {
    return path.nodes().stream().map(LineagePathFinder.Hop::node).toList();
  }
}
