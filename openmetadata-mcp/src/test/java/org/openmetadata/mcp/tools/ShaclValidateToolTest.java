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

class ShaclValidateToolTest {

  private static final Authorizer AUTHORIZER = mock(Authorizer.class);
  private static final CatalogSecurityContext SEC = mock(CatalogSecurityContext.class);

  @Test
  @DisplayName("RDF disabled returns service-unavailable error")
  void rdfDisabled() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(null);
      Map<String, Object> result = new ShaclValidateTool().execute(AUTHORIZER, SEC, Map.of());
      assertNotNull(result.get("error"));
    }
  }

  @Test
  @DisplayName("Non-URI entityUri is rejected")
  void nonUriEntityUri() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getBaseUri()).thenReturn("https://open-metadata.org/");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new ShaclValidateTool().execute(AUTHORIZER, SEC, Map.of("entityUri", "not-an-http-uri"));
      assertEquals("'entityUri' must be a valid absolute http(s) IRI", result.get("error"));
    }
  }

  @Test
  @DisplayName("entityId without entityType is rejected")
  void entityIdWithoutType() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getBaseUri()).thenReturn("https://open-metadata.org/");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new ShaclValidateTool()
              .execute(AUTHORIZER, SEC, Map.of("entityId", UUID.randomUUID().toString()));
      assertNotNull(result.get("error"));
    }
  }

  @Test
  @DisplayName("Non-UUID entityId is rejected")
  void badEntityId() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getBaseUri()).thenReturn("https://open-metadata.org/");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new ShaclValidateTool()
              .execute(AUTHORIZER, SEC, Map.of("entityId", "abc", "entityType", "table"));
      assertEquals("'entityId' must be a UUID", result.get("error"));
    }
  }

  @Test
  @DisplayName("Successful entity-scoped validation reports conforms with violationCount")
  void successfulEntityScopedValidation() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getBaseUri()).thenReturn("https://open-metadata.org/");
      // Conforming subgraph: a typed entity with the required label and FQN.
      String turtleSubgraph =
          "@prefix om: <https://open-metadata.org/ontology/> .\n"
              + "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n"
              + "<https://open-metadata.org/entity/table/abc> a om:Table ;\n"
              + "   rdfs:label \"abc\" ;\n"
              + "   om:fullyQualifiedName \"svc.db.s.abc\" ;\n"
              + "   om:hasColumn <https://open-metadata.org/entity/column/svc.db.s.abc.id> .\n"
              + "<https://open-metadata.org/entity/column/svc.db.s.abc.id> a om:Column ;\n"
              + "   om:fullyQualifiedName \"svc.db.s.abc.id\" .";
      when(repo.executeSparqlQueryDirect(
              anyString(), org.mockito.ArgumentMatchers.eq("text/turtle")))
          .thenReturn(turtleSubgraph);
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new ShaclValidateTool()
              .execute(
                  AUTHORIZER,
                  SEC,
                  Map.of(
                      "entityId", "11111111-1111-1111-1111-111111111111", "entityType", "table"));
      assertNull(result.get("error"));
      assertEquals("entity", result.get("scope"));
      assertNotNull(result.get("conforms"));
      assertNotNull(result.get("report"));
    }
  }

  @Test
  @DisplayName("Subgraph that violates a shape returns conforms=false and a non-empty report")
  void violationDetected() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getBaseUri()).thenReturn("https://open-metadata.org/");
      // Bad column lineage: fromColumn is a literal where shape requires om:Column.
      String bad =
          "@prefix om: <https://open-metadata.org/ontology/> .\n"
              + "<https://open-metadata.org/lin/1> a om:ColumnLineage ;\n"
              + "  om:fromColumn \"svc.db.s.t.col_a\" .";
      when(repo.executeSparqlQueryDirect(anyString(), anyString())).thenReturn(bad);
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new ShaclValidateTool()
              .execute(AUTHORIZER, SEC, Map.of("entityUri", "https://open-metadata.org/lin/1"));
      assertEquals(false, result.get("conforms"));
      assertTrue(((Long) result.get("violationCount")) > 0);
    }
  }

  @Test
  @DisplayName("Empty body from triplestore is handled gracefully")
  void emptyBodyHandled() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getBaseUri()).thenReturn("https://open-metadata.org/");
      when(repo.executeSparqlQueryDirect(anyString(), anyString())).thenReturn(null);
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      Map<String, Object> result =
          new ShaclValidateTool()
              .execute(
                  AUTHORIZER,
                  SEC,
                  Map.of(
                      "entityId", "11111111-1111-1111-1111-111111111111", "entityType", "table"));
      assertNull(result.get("error"));
      assertNotNull(result.get("conforms"));
    }
  }

  @Test
  @DisplayName("fullGraph=true → full-graph validation")
  void fullGraphScope() throws IOException {
    try (MockedStatic<RdfRepository> mocked = mockStatic(RdfRepository.class)) {
      RdfRepository repo = mock(RdfRepository.class);
      when(repo.isEnabled()).thenReturn(true);
      when(repo.getBaseUri()).thenReturn("https://open-metadata.org/");
      when(repo.executeSparqlQueryDirect(anyString(), anyString())).thenReturn("");
      mocked.when(RdfRepository::getInstanceOrNull).thenReturn(repo);

      // Whole-graph validation is opt-in to avoid an unbounded scan; pass fullGraph=true.
      Map<String, Object> result =
          new ShaclValidateTool().execute(AUTHORIZER, SEC, Map.of("fullGraph", true));
      assertEquals("full-graph", result.get("scope"));
    }
  }
}
