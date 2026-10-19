package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.migrate;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.withDatabase;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.apache.commons.codec.digest.DigestUtils;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyReference;
import org.openmetadata.schema.type.OntologyReferenceRole;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class OntologyReferenceDAOTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void reverseLookupIsExactAndScopedToTheOwningModule(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          migrate(handle, dialect);
          var dao = handle.attach(CollectionDAO.class).ontologyReferenceDAO();
          UUID ontology = UUID.randomUUID();
          UUID source = UUID.randomUUID();
          List<String> iris =
              List.of(
                  "urn:example:Customer",
                  "URN:example:Customer",
                  "urn:example:café",
                  "urn:example:café");
          for (String iri : iris) {
            dao.insert(reference(ontology, source, iri), DigestUtils.sha256Hex(iri));
          }
          String selected = iris.getFirst();
          dao.insert(
              reference(UUID.randomUUID(), UUID.randomUUID(), selected),
              DigestUtils.sha256Hex(selected));
          // A hash match must still compare the full IRI.
          dao.insert(
              reference(ontology, UUID.randomUUID(), "urn:wrong"), DigestUtils.sha256Hex(selected));
          for (String iri : iris) {
            var matches = dao.list(ontology, DigestUtils.sha256Hex(iri), iri, "", "", "", 10);
            assertEquals(1, matches.size());
            assertEquals(iri, matches.getFirst().getIri().toString());
            assertEquals(source, matches.getFirst().getSource().getId());
            assertEquals(1, dao.count(ontology, DigestUtils.sha256Hex(iri), iri));
          }
          migrate(handle, dialect);
          assertEquals(1, dao.count(ontology, DigestUtils.sha256Hex(selected), selected));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void referencesHaveStablePagingAndShareTheirWritersTransaction(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          migrate(handle, dialect);
          var dao = handle.attach(CollectionDAO.class).ontologyReferenceDAO();
          UUID ontology = UUID.randomUUID();
          UUID source = UUID.randomUUID();
          String iri = "urn:target";
          String hash = DigestUtils.sha256Hex(iri);
          OntologyReference domain =
              reference(ontology, source, iri).withRole(OntologyReferenceRole.DOMAIN);
          OntologyReference range =
              reference(ontology, source, iri).withRole(OntologyReferenceRole.RANGE);
          dao.insert(range, hash);
          dao.insert(domain, hash);
          var first = dao.list(ontology, hash, iri, "", "", "", 1).getFirst();
          assertEquals(OntologyReferenceRole.DOMAIN, first.getRole());
          var second =
              dao.list(
                      ontology,
                      hash,
                      iri,
                      first.getSource().getType(),
                      first.getSource().getId().toString(),
                      first.getRole().value(),
                      1)
                  .getFirst();
          assertEquals(OntologyReferenceRole.RANGE, second.getRole());
          assertThrows(
              IllegalStateException.class,
              () ->
                  handle.useTransaction(
                      ignored -> {
                        dao.delete("ontologyProperty", source);
                        throw new IllegalStateException("Rollback definition write");
                      }));
          assertEquals(2, dao.count(ontology, hash, iri));
          dao.delete("ontologyConcept", source);
          assertEquals(2, dao.count(ontology, hash, iri));
          dao.delete("ontologyProperty", source);
          assertEquals(0, dao.count(ontology, hash, iri));
        });
  }

  private static OntologyReference reference(UUID ontology, UUID source, String iri) {
    return new OntologyReference()
        .withOntologyId(ontology)
        .withSource(new EntityReference().withType("ontologyProperty").withId(source))
        .withRole(OntologyReferenceRole.DOMAIN)
        .withIri(URI.create(iri));
  }
}
