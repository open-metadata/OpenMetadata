package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

class OntologyReleaseReaderTest {
  @Test
  void captureContentExcludesLiveMetadata() {
    final OntologyConcept concept =
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName("Customer")
            .withIri(URI.create("urn:Customer"))
            .withVersion(0.2)
            .withUpdatedBy("author")
            .withHref(URI.create("https://catalog/concept"));
    final var payload = OntologyReleaseContent.project(concept);
    for (String field :
        List.of(
            "version", "updatedBy", "href", "owners", "reviewers", "superClasses", "subClasses")) {
      assertFalse(payload.has(field), field);
    }
    assertEquals("urn:Customer", payload.path("iri").asText());
  }

  @Test
  void historicalOperationalFieldsDoNotBreakFrozenDefinitions() {
    final UUID id = UUID.randomUUID();
    final var payload = JsonUtils.getObjectNode();
    payload.put("id", id.toString());
    payload.put("iri", "urn:Customer");
    payload.put("entityStatus", "Approved");
    payload.put("retiredField", true);
    payload
        .putObject("ontology")
        .put("id", UUID.randomUUID().toString())
        .put("retiredNestedField", 1);
    final var member =
        OntologyReleaseManifest.member(UUID.randomUUID(), MemberKind.CONCEPT, id, payload);

    final var concept = (OntologyConcept) OntologyReleaseReader.definition(member);

    assertEquals(id, concept.getId());
    assertEquals("urn:Customer", concept.getIri().toString());
    assertEquals(
        payload.path("ontology").path("id").asText(), concept.getOntology().getId().toString());
    assertThrows(
        BadRequestException.class,
        () -> OntologyReleaseReader.definition(member.withMemberId(UUID.randomUUID())));
  }
}
