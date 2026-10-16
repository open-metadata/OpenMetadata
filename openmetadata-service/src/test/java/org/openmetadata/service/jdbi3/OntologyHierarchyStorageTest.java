package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import jakarta.json.Json;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.OntologyValidationException;
import org.openmetadata.service.jdbi3.OntologyCaptureFixture.Fixture;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

class OntologyHierarchyStorageTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void previewsDoNotWaitForWriters(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var customer = concept(fixture, "Customer");
          final var party = concept(fixture, "Party");
          try (var readers = Executors.newSingleThreadExecutor()) {
            fixture.handle.begin();
            try {
              fixture
                  .handle
                  .attach(CollectionDAO.class)
                  .ontologyStateDAO()
                  .lock(fixture.ontology.getId());
              final var preview =
                  readers.submit(
                      () -> new OntologyAxiomRepository().validate(subclass(customer, party)));
              assertTrue(preview.get(3, TimeUnit.SECONDS).getValid());
            } finally {
              fixture.handle.rollback();
            }
          } catch (InterruptedException | ExecutionException | TimeoutException failure) {
            throw new AssertionError(failure);
          }
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void unrelatedInvalidDefinitionsDoNotBlockEditingOrRepair(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var customer = concept(fixture, "Customer");
          final var party = concept(fixture, "Party");
          final var axioms = new OntologyAxiomRepository();
          final var invalid = subclass(customer, party).withSubjectIri(URI.create("urn:missing"));
          axioms.setFullyQualifiedName(invalid);
          axioms.getDao().insert(invalid, invalid.getFullyQualifiedName());

          fixture.concepts.patch(
              null,
              party.getId(),
              "admin",
              Json.createPatchBuilder().add("/description", "Updated documentation").build());
          concept(fixture, "Unrelated");
          assertThrows(OntologyValidationException.class, () -> fixture.capture(ignored -> {}));

          axioms.patch(
              null,
              invalid.getId(),
              "admin",
              Json.createPatchBuilder()
                  .replace("/subjectIri", customer.getIri().toString())
                  .build());
          assertEquals(5, fixture.capture(ignored -> {}).getMemberCount());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void previewsUseTheWholeWorkingHierarchyWithoutChangingRowsOrRevisions(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          var customer = concept(fixture, "Customer");
          var party = concept(fixture, "Party");
          var axioms = new OntologyAxiomRepository();
          var parents = axioms.create(null, subclass(customer, party));
          var states = fixture.handle.attach(CollectionDAO.class).ontologyStateDAO();
          var revision = states.get(fixture.ontology.getId()).getWorkingRevision();
          assertFalse(axioms.validate(subclass(party, customer)).getValid());
          var unknown = new OntologyConcept().withIri(URI.create("urn:unknown"));
          assertFalse(axioms.validate(subclass(customer, unknown)).getValid());
          assertTrue(axioms.validate(parents).getValid());
          assertTrue(
              axioms.validate(subclass(party, customer).withName(parents.getName())).getValid());
          assertFalse(axioms.validate(subclass(customer)).getValid());
          assertEquals(1, fixture.rowCount("ontology_axiom_entity"));
          assertEquals(revision, states.get(fixture.ontology.getId()).getWorkingRevision());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void hierarchyReadsAreDerivedAndReferencesProtectDeclarations(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          var customer = concept(fixture, "Customer");
          var party = concept(fixture, "Party");
          var legal = concept(fixture, "LegalEntity");
          var axioms = new OntologyAxiomRepository();
          var parents = axioms.create(null, subclass(customer, party, legal));
          var fields = fixture.concepts.getFields("superClasses,subClasses");
          var current = fixture.concepts.get(null, customer.getId(), fields);
          assertEquals(List.of(legal.getIri(), party.getIri()), current.getSuperClasses());
          assertEquals(
              List.of(customer.getIri()),
              fixture.concepts.get(null, party.getId(), fields).getSubClasses());
          assertNull(
              fixture
                  .concepts
                  .get(null, customer.getId(), fixture.concepts.getFields(""))
                  .getSuperClasses());
          assertThrows(
              OntologyValidationException.class,
              () -> axioms.create(null, subclass(party, customer)));
          assertThrows(
              OntologyValidationException.class,
              () -> fixture.concepts.delete("admin", party.getId(), false, false));
          assertThrows(
              OntologyValidationException.class,
              () ->
                  fixture.concepts.patch(
                      null,
                      party.getId(),
                      "admin",
                      Json.createPatchBuilder().replace("/conceptType", "SKOS_CONCEPT").build()));
          assertThrows(
              BadRequestException.class,
              () ->
                  fixture.concepts.patch(
                      null,
                      customer.getId(),
                      "admin",
                      Json.createPatchBuilder()
                          .add("/superClasses", Json.createArrayBuilder().build())
                          .build()));

          fixture.concepts.patch(
              null,
              customer.getId(),
              "admin",
              Json.createPatchBuilder().add("/description", "A customer").build());
          assertFalse(
              fixture
                  .handle
                  .attach(CollectionDAO.class)
                  .ontologyConceptDAO()
                  .findJsonByIdForUpdate(customer.getId(), Include.ALL)
                  .contains("superClasses"));
          assertFalse(
              fixture
                  .handle
                  .attach(CollectionDAO.class)
                  .entityExtensionDAO()
                  .getExtension(
                      customer.getId(),
                      EntityUtil.getVersionExtension(Entity.ONTOLOGY_CONCEPT, 0.1))
                  .contains("superClasses"));
          axioms.delete("admin", parents.getId(), false, false);
          assertEquals(
              List.of(), fixture.concepts.get(null, customer.getId(), fields).getSuperClasses());
          fixture.concepts.delete("admin", party.getId(), false, false);
          assertThrows(
              OntologyValidationException.class,
              () -> axioms.restoreEntity("admin", parents.getId()));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void concurrentOppositeEdgesCannotCommitACycleEvenWithAnOlderReadSnapshot(
      ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          var first = concept(fixture, "First");
          var second = concept(fixture, "Second");
          var ready = new CountDownLatch(2);
          try (var writers = Executors.newFixedThreadPool(2)) {
            var left =
                writers.submit(() -> insertAfterRead(fixture, subclass(first, second), ready));
            var right =
                writers.submit(() -> insertAfterRead(fixture, subclass(second, first), ready));
            assertEquals(1, left.get(30, TimeUnit.SECONDS) + right.get(30, TimeUnit.SECONDS));
          } catch (InterruptedException | ExecutionException | TimeoutException failure) {
            throw new AssertionError(failure);
          }
          assertEquals(1, fixture.rowCount("ontology_axiom_entity"));
        });
  }

  private static int insertAfterRead(Fixture fixture, OntologyAxiom axiom, CountDownLatch ready) {
    var axioms = new OntologyAxiomRepository();
    try {
      return fixture.ontologies.executeInTransaction(
          () -> {
            axioms.getDao().listCount(new ListFilter(Include.NON_DELETED));
            ready.countDown();
            try {
              assertTrue(ready.await(10, TimeUnit.SECONDS));
            } catch (InterruptedException interrupted) {
              Thread.currentThread().interrupt();
              throw new AssertionError(interrupted);
            }
            axioms.create(null, axiom);
            return 1;
          });
    } catch (OntologyValidationException rejected) {
      assertTrue(rejected.getMessage().contains("cycle"), rejected.getMessage());
      return 0;
    }
  }

  private static OntologyConcept concept(Fixture fixture, String name) {
    return fixture.concepts.create(
        null,
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName(name)
            .withOntology(fixture.ontology.getEntityReference())
            .withIri(URI.create("urn:class:" + name))
            .withConceptType(OntologyConceptType.OWL_CLASS)
            .withVersion(0.1)
            .withUpdatedAt(1L)
            .withUpdatedBy("admin"));
  }

  private static OntologyAxiom subclass(OntologyConcept source, OntologyConcept... targets) {
    var id = UUID.randomUUID();
    return new OntologyAxiom()
        .withId(id)
        .withName("Subclass" + id)
        .withOntology(source.getOntology())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(source.getIri())
        .withExpressions(
            Arrays.stream(targets)
                .map(
                    target ->
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.NAMED_CLASS)
                            .withClassIri(target.getIri()))
                .toList())
        .withVersion(0.1)
        .withUpdatedAt(1L)
        .withUpdatedBy("admin");
  }
}
