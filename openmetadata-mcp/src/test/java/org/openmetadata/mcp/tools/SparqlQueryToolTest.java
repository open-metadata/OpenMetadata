package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Failure-mode tests for SparqlQueryTool. Each test names the bad input it is exercising —
 * these are the queries we expect adversarial or sloppy MCP clients to send.
 */
class SparqlQueryToolTest {

  private static final Authorizer AUTHORIZER = mock(Authorizer.class);
  private static final CatalogSecurityContext SEC = mock(CatalogSecurityContext.class);

  private static SparqlQueryTool newTool() {
    return new SparqlQueryTool();
  }

  @Test
  @DisplayName("Missing 'query' parameter returns a clean error")
  void missingQueryParam() throws IOException {
    Map<String, Object> result = newTool().execute(AUTHORIZER, SEC, Map.of());
    assertEquals("'query' parameter is required", result.get("error"));
  }

  @Test
  @DisplayName("Empty / blank query is rejected")
  void blankQueryRejected() throws IOException {
    Map<String, Object> result = newTool().execute(AUTHORIZER, SEC, Map.of("query", "   "));
    assertNotNull(result.get("error"));
  }

  @Test
  @DisplayName("Garbage SPARQL surfaces as a parse error rather than a 500")
  void garbageQuerySurfacesParseError() throws IOException {
    Map<String, Object> result =
        newTool().execute(AUTHORIZER, SEC, Map.of("query", "not sparql at all {{}}"));
    assertNotNull(result.get("error"));
    assertTrue(((String) result.get("error")).startsWith("SPARQL parse error"));
  }

  @Test
  @DisplayName("INSERT DATA is rejected — only read-only queries allowed via this tool")
  void insertDataRejected() throws IOException {
    String q = "INSERT DATA { <urn:s> <urn:p> <urn:o> }";
    Map<String, Object> result = newTool().execute(AUTHORIZER, SEC, Map.of("query", q));
    String err = (String) result.get("error");
    // INSERT DATA fails the SPARQL Query parser (it's an update operation), so we surface a
    // parse error. Either way, the tool refuses it.
    assertNotNull(err);
  }

  @Test
  @DisplayName("DELETE WHERE is rejected — only read-only queries allowed via this tool")
  void deleteRejected() throws IOException {
    String q = "DELETE WHERE { ?s ?p ?o }";
    Map<String, Object> result = newTool().execute(AUTHORIZER, SEC, Map.of("query", q));
    assertNotNull(result.get("error"));
  }

  @Test
  @DisplayName("DROP GRAPH is rejected")
  void dropRejected() throws IOException {
    String q = "DROP GRAPH <urn:graph>";
    Map<String, Object> result = newTool().execute(AUTHORIZER, SEC, Map.of("query", q));
    assertNotNull(result.get("error"));
  }

  @Test
  @DisplayName("RDF disabled on the server returns a service-unavailable error")
  void repositoryDisabled() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(false);
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          newTool().execute(AUTHORIZER, SEC, Map.of("query", "SELECT * WHERE { ?s ?p ?o }"));
      assertEquals(
          "RDF repository is not enabled on this OpenMetadata server", result.get("error"));
    }
  }

  @Test
  @DisplayName("RDF instance missing returns a service-unavailable error")
  void repositoryMissing() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(null);

      Map<String, Object> result =
          newTool().execute(AUTHORIZER, SEC, Map.of("query", "SELECT * WHERE { ?s ?p ?o }"));
      assertNotNull(result.get("error"));
    }
  }

  @Test
  @DisplayName("SERVICE clause to non-allowlisted endpoint is rejected")
  void serviceClauseRejected() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getConfig()).thenReturn(new RdfConfiguration());
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      String q = "SELECT * WHERE { SERVICE <https://attacker.example/sparql> { ?s ?p ?o } }";
      Map<String, Object> result = newTool().execute(AUTHORIZER, SEC, Map.of("query", q));
      assertNotNull(result.get("error"));
      assertTrue(((String) result.get("error")).contains("SERVICE"));
    }
  }

  @Test
  @DisplayName("Successful SELECT returns body, format, queryType, and untruncated metadata")
  void successfulSelect() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getConfig()).thenReturn(new RdfConfiguration());
      when(repo.executeSparqlQuery(
              "SELECT * WHERE { ?s ?p ?o } LIMIT 1", "application/sparql-results+json"))
          .thenReturn("{\"results\":{\"bindings\":[]}}");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          newTool()
              .execute(AUTHORIZER, SEC, Map.of("query", "SELECT * WHERE { ?s ?p ?o } LIMIT 1"));

      assertNull(result.get("error"));
      assertEquals("json", result.get("format"));
      assertEquals("SELECT", result.get("queryType"));
      assertFalse((Boolean) result.get("truncated"));
      assertNotNull(result.get("body"));
    }
  }

  @Test
  @DisplayName("Result larger than maxBytes is truncated and flagged")
  void resultTruncatedWhenOversized() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getConfig()).thenReturn(new RdfConfiguration());
      String hugeBody = "x".repeat(8_000);
      when(repo.executeSparqlQuery(
              "SELECT * WHERE { ?s ?p ?o }", "application/sparql-results+json"))
          .thenReturn(hugeBody);
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          newTool()
              .execute(
                  AUTHORIZER,
                  SEC,
                  Map.of("query", "SELECT * WHERE { ?s ?p ?o }", "maxBytes", 2048));
      assertTrue((Boolean) result.get("truncated"));
      assertTrue(((String) result.get("body")).length() <= 2048);
      assertEquals(8_000, result.get("byteCount"));
    }
  }

  @Test
  @DisplayName("Repository throws → tool returns clean error rather than propagating")
  void repositoryThrows() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getConfig()).thenReturn(new RdfConfiguration());
      when(repo.executeSparqlQuery(
              org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString()))
          .thenThrow(new RuntimeException("Fuseki connection refused"));
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          newTool().execute(AUTHORIZER, SEC, Map.of("query", "ASK { ?s ?p ?o }"));
      String err = (String) result.get("error");
      assertNotNull(err);
      assertTrue(err.contains("SPARQL execution failed"));
    }
  }

  @Test
  @DisplayName("Inference level 'rdfs' routes through the inference path")
  void inferenceLevelRouted() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getConfig()).thenReturn(new RdfConfiguration());
      when(repo.executeSparqlQueryWithInference(
              org.mockito.ArgumentMatchers.anyString(),
              org.mockito.ArgumentMatchers.anyString(),
              org.mockito.ArgumentMatchers.eq("rdfs")))
          .thenReturn("{}");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          newTool()
              .execute(
                  AUTHORIZER,
                  SEC,
                  Map.of("query", "SELECT * WHERE { ?s ?p ?o }", "inferenceLevel", "rdfs"));
      assertNull(result.get("error"));
      org.mockito.Mockito.verify(repo)
          .executeSparqlQueryWithInference(
              org.mockito.ArgumentMatchers.anyString(),
              org.mockito.ArgumentMatchers.anyString(),
              org.mockito.ArgumentMatchers.eq("rdfs"));
    }
  }

  @Test
  @DisplayName("Format defaults to json when unspecified or unrecognized")
  void formatDefaultsToJson() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getConfig()).thenReturn(new RdfConfiguration());
      when(repo.executeSparqlQuery(
              org.mockito.ArgumentMatchers.anyString(),
              org.mockito.ArgumentMatchers.eq("application/sparql-results+json")))
          .thenReturn("{}");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          newTool()
              .execute(
                  AUTHORIZER,
                  SEC,
                  Map.of("query", "SELECT * WHERE { ?s ?p ?o }", "format", "weirdformat"));
      assertEquals("json", result.get("format"));
    }
  }

  @Test
  @DisplayName("Limits-aware execute throws — write-tool contract not applicable")
  void writeContractNotSupported() {
    org.junit.jupiter.api.Assertions.assertThrows(
        UnsupportedOperationException.class,
        () -> newTool().execute(AUTHORIZER, null, SEC, Map.of("query", "ASK {}")));
  }
}
