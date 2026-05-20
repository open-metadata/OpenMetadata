package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class EntityNeighborhoodToolTest {

  private static final Authorizer AUTHORIZER = mock(Authorizer.class);
  private static final CatalogSecurityContext SEC = mock(CatalogSecurityContext.class);

  @Test
  @DisplayName("Missing entityId is rejected")
  void missingEntityId() throws IOException {
    Map<String, Object> result =
        new EntityNeighborhoodTool().execute(AUTHORIZER, SEC, Map.of("entityType", "table"));
    assertEquals("'entityId' parameter is required", result.get("error"));
  }

  @Test
  @DisplayName("Missing entityType is rejected")
  void missingEntityType() throws IOException {
    Map<String, Object> result =
        new EntityNeighborhoodTool()
            .execute(AUTHORIZER, SEC, Map.of("entityId", UUID.randomUUID().toString()));
    assertEquals("'entityType' parameter is required", result.get("error"));
  }

  @Test
  @DisplayName("Non-UUID entityId is rejected with a clean error")
  void nonUuidEntityIdRejected() throws IOException {
    Map<String, Object> result =
        new EntityNeighborhoodTool()
            .execute(AUTHORIZER, SEC, Map.of("entityId", "not-a-uuid", "entityType", "table"));
    assertEquals("'entityId' must be a UUID", result.get("error"));
  }

  @Test
  @DisplayName("Non-alphanumeric entityType is rejected (defends against URI injection)")
  void badEntityTypeRejected() throws IOException {
    Map<String, Object> result =
        new EntityNeighborhoodTool()
            .execute(
                AUTHORIZER,
                SEC,
                Map.of("entityId", UUID.randomUUID().toString(), "entityType", "table> ; DROP --"));
    assertEquals("'entityType' must be alphanumeric", result.get("error"));
  }

  @Test
  @DisplayName("RDF disabled returns service-unavailable error")
  void rdfDisabled() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(false);
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new EntityNeighborhoodTool()
              .execute(
                  AUTHORIZER,
                  SEC,
                  Map.of("entityId", UUID.randomUUID().toString(), "entityType", "table"));
      assertNotNull(result.get("error"));
    }
  }

  @Test
  @DisplayName("Successful call returns triples + edges + clamped depth")
  void successfulCall() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getBaseUri()).thenReturn("https://open-metadata.org/");
      when(repo.executeSparqlQuery(anyString(), org.mockito.ArgumentMatchers.eq("text/turtle")))
          .thenReturn(
              "<https://open-metadata.org/entity/table/abc> <https://open-metadata.org/ontology/hasColumn> <urn:c1> .");
      when(repo.executeSparqlQuery(
              anyString(), org.mockito.ArgumentMatchers.eq("application/sparql-results+json")))
          .thenReturn(
              "{\"results\":{\"bindings\":["
                  + "{\"direction\":{\"value\":\"outgoing\"},\"predicate\":{\"value\":\"https://open-metadata.org/ontology/hasColumn\"},\"neighbor\":{\"value\":\"urn:c1\"}}"
                  + "]}}");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new EntityNeighborhoodTool()
              .execute(
                  AUTHORIZER,
                  SEC,
                  Map.of(
                      "entityId",
                      "11111111-1111-1111-1111-111111111111",
                      "entityType",
                      "table",
                      "depth",
                      99));

      assertNull(result.get("error"));
      assertEquals(3, result.get("depth"), "Depth must be clamped to 3");
      assertNotNull(result.get("triples"));
      @SuppressWarnings("unchecked")
      var edges = (java.util.List<Map<String, Object>>) result.get("edges");
      assertEquals(1, edges.size());
      assertEquals("outgoing", edges.get(0).get("direction"));
    }
  }

  @Test
  @DisplayName("buildConstructQuery includes inverse direction (incoming edges)")
  void constructQueryIncludesInverse() {
    String q =
        EntityNeighborhoodTool.buildConstructQuery(
            "https://open-metadata.org/entity/table/abc", 2, 100);
    // Incoming arm now binds ?o = <entity> and matches ?s ?p <entity>
    assertTrue(q.contains("?s ?p <https://open-metadata.org/entity/table/abc>"));
  }

  @Test
  @DisplayName("buildConstructQuery respects depth")
  void constructQueryDepthBounds() {
    String d1 = EntityNeighborhoodTool.buildConstructQuery("urn:e", 1, 100);
    String d3 = EntityNeighborhoodTool.buildConstructQuery("urn:e", 3, 100);
    // depth-1: only outgoing + incoming arms (split by UNION = 2 pieces + 1 = 3)
    assertTrue(d1.split("UNION").length <= 3, "Depth 1 should not contain 2/3-hop unions");
    assertTrue(d3.contains("?n3"), "Depth 3 must include the 3-hop chain variable");
  }

  @Test
  @DisplayName("buildConstructQuery preserves real subjects on multi-hop arms")
  void constructQueryPreservesMultiHopSubjects() {
    String q = EntityNeighborhoodTool.buildConstructQuery("urn:e", 2, 100);
    // The 2-hop "second-edge" arm must NOT bind ?s to the start entity — it must let the
    // intermediate node be ?s so the emitted triple is faithful to the real graph.
    assertTrue(
        q.contains("<urn:e> ?p1 ?s . ?s ?p ?o"),
        "Depth-2 second-edge arm must bind ?s to the intermediate node, not <urn:e>");
  }

  @Test
  @DisplayName("Repository throws → tool returns clean error")
  void repositoryThrows() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getBaseUri()).thenReturn("https://open-metadata.org/");
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenThrow(new RuntimeException("boom"));
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new EntityNeighborhoodTool()
              .execute(
                  AUTHORIZER,
                  SEC,
                  Map.of(
                      "entityId",
                      "22222222-2222-2222-2222-222222222222",
                      "entityType",
                      "pipeline"));
      assertTrue(((String) result.get("error")).contains("Neighborhood query failed"));
    }
  }
}
