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

class OntologyDescribeToolTest {

  private static final Authorizer AUTHORIZER = mock(Authorizer.class);
  private static final CatalogSecurityContext SEC = mock(CatalogSecurityContext.class);

  @Test
  @DisplayName(
      "No 'resource' returns the full ontology from classpath without touching the triplestore")
  void fullOntologyServedFromClasspath() throws IOException {
    Map<String, Object> result = new OntologyDescribeTool().execute(AUTHORIZER, SEC, Map.of());
    assertNull(result.get("error"));
    assertEquals("full-ontology", result.get("scope"));
    String body = (String) result.get("body");
    assertNotNull(body);
    assertTrue(
        body.contains("om:") || body.contains("ontology"),
        "Full ontology body must look like RDF, got: "
            + body.substring(0, Math.min(200, body.length())));
  }

  @Test
  @DisplayName("Non-URI 'resource' is rejected")
  void nonUriResourceRejected() throws IOException {
    Map<String, Object> result =
        new OntologyDescribeTool().execute(AUTHORIZER, SEC, Map.of("resource", "Column"));
    assertEquals(
        "'resource' must be a valid absolute http(s) IRI (no whitespace, control characters,"
            + " angle brackets, or quotes)",
        result.get("error"));
  }

  @Test
  @DisplayName("RDF disabled while DESCRIBE-ing a single class returns service-unavailable error")
  void describeRequiresRdf() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(null);
      Map<String, Object> result =
          new OntologyDescribeTool()
              .execute(
                  AUTHORIZER, SEC, Map.of("resource", "https://open-metadata.org/ontology/Column"));
      assertNotNull(result.get("error"));
    }
  }

  @Test
  @DisplayName("Successful DESCRIBE call returns turtle by default")
  void successfulDescribe() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.executeSparqlQueryDirect(
              anyString(), org.mockito.ArgumentMatchers.eq("text/turtle")))
          .thenReturn("@prefix om: <https://open-metadata.org/ontology/> .");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new OntologyDescribeTool()
              .execute(
                  AUTHORIZER, SEC, Map.of("resource", "https://open-metadata.org/ontology/Column"));
      assertEquals("describe", result.get("scope"));
      assertEquals("turtle", result.get("format"));
      assertEquals("text/turtle", result.get("mediaType"));
      assertNotNull(result.get("body"));
    }
  }

  @Test
  @DisplayName("Format normalizes 'json-ld' to 'jsonld'")
  void formatNormalization() throws IOException {
    Map<String, Object> result =
        new OntologyDescribeTool().execute(AUTHORIZER, SEC, Map.of("format", "json-ld"));
    assertEquals("jsonld", result.get("format"));
  }
}
