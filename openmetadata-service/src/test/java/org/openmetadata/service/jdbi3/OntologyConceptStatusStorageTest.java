package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.net.URI;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyDefinitionStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyCaptureFixture.Fixture;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

class OntologyConceptStatusStorageTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void lifecycleStatusNeverReachesTheRowOrTheVersionHistory(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final OntologyConcept created =
              fixture.concepts.create(
                  null, concept(fixture).withLifecycleStatus(OntologyDefinitionStatus.APPROVED));
          final OntologyConcept loadedWithStatus =
              fixture
                  .concepts
                  .get(null, created.getId(), fixture.concepts.getFields(""))
                  .withLifecycleStatus(OntologyDefinitionStatus.APPROVED);
          fixture.concepts.update(
              null,
              loadedWithStatus,
              JsonUtils.deepCopy(loadedWithStatus, OntologyConcept.class)
                  .withDescription("A customer")
                  .withLifecycleStatus(OntologyDefinitionStatus.IN_REVIEW),
              "admin");
          final CollectionDAO dao = fixture.handle.attach(CollectionDAO.class);
          final JsonNode row =
              JsonUtils.readTree(
                  dao.ontologyConceptDAO().findJsonByIdForUpdate(created.getId(), Include.ALL));
          final JsonNode firstVersion =
              JsonUtils.readTree(
                  dao.entityExtensionDAO()
                      .getExtension(
                          created.getId(),
                          EntityUtil.getVersionExtension(Entity.ONTOLOGY_CONCEPT, 0.1)));

          assertAll(
              () -> assertNull(created.getLifecycleStatus()),
              () -> assertEquals("A customer", row.get("description").asText()),
              () -> assertFalse(row.has("lifecycleStatus"), row.toString()),
              () -> assertEquals(0.1, firstVersion.get("version").asDouble()),
              () -> assertFalse(firstVersion.has("lifecycleStatus"), firstVersion.toString()));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void patchesThatSetLifecycleStatusAreRejectedAsServerDerived(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final UUID conceptId = fixture.concepts.create(null, concept(fixture)).getId();

          assertEquals(
              "400 Concept lifecycleStatus is derived by the server from ontology releases",
              rejectionOf(
                  fixture,
                  conceptId,
                  Json.createPatchBuilder().add("/lifecycleStatus", "Approved").build()));
          assertEquals(
              "400 Concept lifecycleStatus is derived by the server from ontology releases",
              rejectionOf(
                  fixture,
                  conceptId,
                  Json.createPatchBuilder().replace("/lifecycleStatus", "Draft").build()));
        });
  }

  private static String rejectionOf(Fixture fixture, UUID conceptId, JsonPatch patch) {
    final BadRequestException rejected =
        assertThrows(
            BadRequestException.class,
            () -> fixture.concepts.patch(null, conceptId, "admin", patch));
    return rejected.getResponse().getStatus() + " " + rejected.getMessage();
  }

  private static OntologyConcept concept(Fixture fixture) {
    return new OntologyConcept()
        .withId(UUID.randomUUID())
        .withName("Customer")
        .withOntology(fixture.ontology.getEntityReference())
        .withIri(URI.create("urn:class:Customer"))
        .withConceptType(OntologyConceptType.OWL_CLASS)
        .withVersion(0.1)
        .withUpdatedAt(1L)
        .withUpdatedBy("admin");
  }
}
