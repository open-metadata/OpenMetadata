package org.openmetadata.service.resources.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.utils.JsonUtils;

class GlossaryModelBoundaryTest {
  @ParameterizedTest
  @ValueSource(
      strings = {
        "attributes",
        "effectiveAttributes",
        "realizedIn",
        "conceptType",
        "ontologySource",
        "sourceMemoryIds"
      })
  void glossaryTermsRejectUnreleasedOntologyFields(String field) {
    String json = "{\"" + field + "\":null}";
    assertThrows(
        UnrecognizedPropertyException.class,
        () -> JsonUtils.getObjectMapper().readValue(json, GlossaryTerm.class));
  }

  @ParameterizedTest
  @ValueSource(strings = {"attributes", "realizedIn"})
  void termCreationRejectsOntologyModelingFields(String field) {
    String json = "{\"" + field + "\":[]}";
    assertThrows(
        UnrecognizedPropertyException.class,
        () -> JsonUtils.getObjectMapper().readValue(json, CreateGlossaryTerm.class));
  }

  @Test
  void glossaryConfigurationCannotTurnAGlossaryIntoAnOntology() {
    String json = "{\"ontologyConfiguration\":{}}";
    assertThrows(
        UnrecognizedPropertyException.class,
        () -> JsonUtils.getObjectMapper().readValue(json, Glossary.class));
    assertThrows(
        UnrecognizedPropertyException.class,
        () -> JsonUtils.getObjectMapper().readValue(json, CreateGlossary.class));
  }

  @Test
  void releasedTermRelationsAndExternalIdentityRoundTrip() throws Exception {
    String json =
        """
        {
          "name": "Employee",
          "iri": "https://example.org/Employee",
          "conceptMappings": [{
            "conceptIri": "https://example.org/Person",
            "mappingType": "CLOSE_MATCH"
          }],
          "relatedTerms": [{
            "relationType": "reportsTo",
            "term": {"id": "00000000-0000-0000-0000-000000000001", "type": "glossaryTerm"}
          }]
        }
        """;
    GlossaryTerm term = JsonUtils.getObjectMapper().readValue(json, GlossaryTerm.class);
    GlossaryTerm restored =
        JsonUtils.getObjectMapper().readValue(JsonUtils.pojoToJson(term), GlossaryTerm.class);

    assertEquals("reportsTo", restored.getRelatedTerms().getFirst().getRelationType());
    assertEquals(term.getRelatedTerms(), restored.getRelatedTerms());
    assertEquals(term.getIri(), restored.getIri());
    assertEquals(term.getConceptMappings(), restored.getConceptMappings());
  }
}
