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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

class FindByTagToolTest {

  private static final Authorizer AUTHORIZER = mock(Authorizer.class);
  private static final CatalogSecurityContext SEC = mock(CatalogSecurityContext.class);

  @Test
  @DisplayName("Missing tagFqn is rejected")
  void missingTagFqn() throws IOException {
    Map<String, Object> result = new FindByTagTool().execute(AUTHORIZER, SEC, Map.of());
    assertEquals("'tagFqn' parameter is required", result.get("error"));
  }

  @Test
  @DisplayName("tagFqn containing a quote is rejected (defends against SPARQL string injection)")
  void illegalQuoteRejected() throws IOException {
    Map<String, Object> result =
        new FindByTagTool().execute(AUTHORIZER, SEC, Map.of("tagFqn", "PII\".Sensitive"));
    assertEquals("'tagFqn' contains illegal characters", result.get("error"));
  }

  @Test
  @DisplayName("tagFqn with backslash or newline is rejected")
  void illegalControlCharsRejected() throws IOException {
    Map<String, Object> result =
        new FindByTagTool().execute(AUTHORIZER, SEC, Map.of("tagFqn", "PII.Sens\nitive"));
    assertEquals("'tagFqn' contains illegal characters", result.get("error"));

    Map<String, Object> result2 =
        new FindByTagTool().execute(AUTHORIZER, SEC, Map.of("tagFqn", "PII\\Sensitive"));
    assertEquals("'tagFqn' contains illegal characters", result2.get("error"));
  }

  @Test
  @DisplayName("Non-alphanumeric entityType is rejected")
  void badEntityTypeRejected() throws IOException {
    Map<String, Object> result =
        new FindByTagTool()
            .execute(
                AUTHORIZER, SEC, Map.of("tagFqn", "PII.Sensitive", "entityType", "table OR 1=1"));
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
          new FindByTagTool().execute(AUTHORIZER, SEC, Map.of("tagFqn", "PII.Sensitive"));
      assertNotNull(result.get("error"));
    }
  }

  @Test
  @DisplayName("Successful call returns parsed entities with FQN, type, label")
  void successfulCall() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenReturn(
              "{\"results\":{\"bindings\":["
                  + "{\"entity\":{\"value\":\"https://open-metadata.org/entity/table/abc\"},"
                  + " \"entityType\":{\"value\":\"https://open-metadata.org/ontology/Table\"},"
                  + " \"fqn\":{\"value\":\"svc.db.s.t\"},"
                  + " \"label\":{\"value\":\"t\"}}"
                  + "]}}");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new FindByTagTool().execute(AUTHORIZER, SEC, Map.of("tagFqn", "PII.Sensitive"));
      assertNull(result.get("error"));
      assertEquals(1, result.get("returnedCount"));
      @SuppressWarnings("unchecked")
      java.util.List<Map<String, Object>> rows =
          (java.util.List<Map<String, Object>>) result.get("results");
      assertEquals("svc.db.s.t", rows.get(0).get("fullyQualifiedName"));
    }
  }

  @Test
  @DisplayName(
      "buildSparql escapes embedded quotes via the regex earlier; the final query is parameterized correctly")
  void buildSparqlContainsEscapedFqn() {
    String sparql = FindByTagTool.buildSparql("PII.Sensitive", "table", 50, 0);
    assertTrue(sparql.contains("\"PII.Sensitive\""));
    assertTrue(sparql.contains("LIMIT 50"));
    assertTrue(sparql.contains("OFFSET 0"));
    assertTrue(sparql.contains("ontology/Table"));
  }

  @Test
  @DisplayName("buildSparql matches GlossaryTerm by om:fullyQualifiedName, not only om:tagFQN")
  void buildSparqlMatchesGlossaryFqn() {
    String sparql = FindByTagTool.buildSparql("MyGlossary.PII", null, 50, 0);
    assertTrue(
        sparql.contains("om:tagFQN \"MyGlossary.PII\""), "must still match Tags by om:tagFQN");
    assertTrue(
        sparql.contains("om:fullyQualifiedName \"MyGlossary.PII\""),
        "must also match GlossaryTerms by om:fullyQualifiedName");
  }

  @Test
  @DisplayName("Empty result set returns empty list, not error")
  void emptyResultSet() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenReturn("{\"results\":{\"bindings\":[]}}");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new FindByTagTool().execute(AUTHORIZER, SEC, Map.of("tagFqn", "PII.None"));
      assertNull(result.get("error"));
      assertEquals(0, result.get("returnedCount"));
    }
  }

  @Test
  @DisplayName("Limit beyond hard max is clamped to 500")
  void limitClamped() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.executeSparqlQuery(anyString(), anyString()))
          .thenReturn("{\"results\":{\"bindings\":[]}}");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new FindByTagTool()
              .execute(AUTHORIZER, SEC, Map.of("tagFqn", "PII.None", "limit", 999_999));
      assertEquals(500, result.get("limit"));
    }
  }
}
