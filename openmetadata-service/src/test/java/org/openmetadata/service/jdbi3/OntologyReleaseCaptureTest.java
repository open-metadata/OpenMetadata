package org.openmetadata.service.jdbi3;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import jakarta.ws.rs.ForbiddenException;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.OntologyReleaseExportOptions;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyProfileViolationCode;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.OntologyValidationException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.exception.TaskStateConflictException;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;
import org.openmetadata.service.rdf.BoundAssetLinks;
import org.openmetadata.service.rdf.OntologyExportFormat;
import org.openmetadata.service.rdf.OntologyReleaseExporter;

class OntologyReleaseCaptureTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void decidedReleasesCannotBeSubmittedForAnotherReview(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var release = fixture.capture(ignored -> {});
          for (final var status : List.of(EntityStatus.APPROVED, EntityStatus.REJECTED)) {
            fixture.releases.getDao().update(release.withEntityStatus(status));
            final var task =
                new Task().withId(UUID.randomUUID()).withAbout(release.getEntityReference());
            assertThrows(
                TaskStateConflictException.class, () -> fixture.releases.prepareReview(task));
            assertEquals(
                status,
                fixture.releases.getDao().findEntityById(release.getId()).getEntityStatus());
          }
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void invalidStoredContentCannotAllocateAReleaseAndReportsTheFailingMember(
      ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var invalid =
              new OntologyAxiom()
                  .withId(UUID.randomUUID())
                  .withName("Invalid")
                  .withOntology(fixture.ontology.getEntityReference())
                  .withVersion(0.1)
                  .withUpdatedAt(1L)
                  .withUpdatedBy("admin")
                  .withSubjectIri(URI.create("urn:undeclared"))
                  .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                  .withExpressions(
                      List.of(
                          new OntologyExpression()
                              .withKind(OntologyExpressionKind.NAMED_CLASS)
                              .withClassIri(URI.create(OWL2.Thing.getURI()))));
          final var axioms = new OntologyAxiomRepository();
          axioms.setFullyQualifiedName(invalid);
          axioms.getDao().insert(invalid, invalid.getFullyQualifiedName());
          final var failure =
              assertThrows(
                  OntologyValidationException.class, () -> fixture.capture(reference -> {}));
          final var issue = failure.getError().getViolations().getFirst();
          assertEquals(invalid.getId(), issue.getMemberId());
          assertEquals(MemberKind.AXIOM, issue.getMemberKind());
          assertEquals(
              OntologyProfileViolationCode.UNDECLARED_CLASS, issue.getViolation().getCode());
          assertEquals(0, fixture.rowCount("ontology_release_entity"));
          assertEquals(0, fixture.rowCount("ontology_release_event"));
          assertEquals(
              0L, fixture.ontologies.getState(fixture.ontology.getId()).getLastReleaseRevision());
          fixture
              .handle
              .createUpdate("DELETE FROM ontology_axiom_entity WHERE id = :id")
              .bind("id", invalid.getId().toString())
              .execute();
          assertEquals(
              OntologyRelease.LogicalCheck.NOT_RUN,
              fixture.capture(reference -> {}).getLogicalCheck());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void referencesCommitAndRollBackWithTheCanonicalDefinition(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          OntologyConcept concept =
              new OntologyConcept()
                  .withId(UUID.randomUUID())
                  .withName("Mapped")
                  .withOntology(fixture.ontology.getEntityReference())
                  .withConceptType(OntologyConceptType.BOTH)
                  .withVersion(0.1)
                  .withUpdatedAt(1L)
                  .withUpdatedBy("admin")
                  .withConceptMappings(
                      List.of(
                          new ConceptMapping()
                              .withConceptIri(URI.create("urn:before"))
                              .withMappingType(ConceptMapping.ConceptMappingType.EXACT_MATCH)));
          OntologyConcept original = fixture.concepts.create(null, concept);
          assertEquals(1, fixture.rowCount("ontology_reference"));
          OntologyConcept updated =
              JsonUtils.deepCopy(original, OntologyConcept.class)
                  .withConceptMappings(
                      List.of(
                          new ConceptMapping()
                              .withConceptIri(URI.create("urn:after"))
                              .withMappingType(ConceptMapping.ConceptMappingType.EXACT_MATCH)));
          assertThrows(
              IllegalStateException.class,
              () ->
                  fixture.concepts.executeInTransaction(
                      () -> {
                        fixture.concepts.update(null, original, updated, "admin");
                        throw new IllegalStateException(
                            "Roll back the definition and its references");
                      }));
          assertEquals(
              "urn:before",
              fixture
                  .handle
                  .createQuery("SELECT iri FROM ontology_reference WHERE sourceId = :id")
                  .bind("id", original.getId().toString())
                  .mapTo(String.class)
                  .one());
          fixture.concepts.update(null, original, updated, "admin");
          assertEquals(
              "urn:after",
              fixture
                  .handle
                  .createQuery("SELECT iri FROM ontology_reference WHERE sourceId = :id")
                  .bind("id", original.getId().toString())
                  .mapTo(String.class)
                  .one());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void readingAnUninitializedStateDoesNotWriteUntilCapture(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          fixture
              .handle
              .createUpdate("DELETE FROM ontology_state WHERE ontologyId = :id")
              .bind("id", fixture.ontology.getId().toString())
              .execute();
          var state = fixture.ontologies.getState(fixture.ontology.getId());
          assertEquals(fixture.ontology.getId(), state.getOntologyId());
          assertEquals(0L, state.getWorkingRevision());
          assertEquals(0L, state.getLastReleaseRevision());
          assertEquals(0L, state.getActivationRevision());
          assertNull(state.getActiveReleaseId());
          assertNull(
              fixture
                  .ontologies
                  .getDaoCollection()
                  .ontologyStateDAO()
                  .get(fixture.ontology.getId()));
          OntologyRelease release = fixture.capture(reference -> {});
          assertEquals(0L, release.getSourceWorkingRevision());
          assertEquals(
              1L, fixture.ontologies.getState(fixture.ontology.getId()).getLastReleaseRevision());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void rollbackRemovesMembersEventsAndReleaseAllocation(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          assertThrows(
              IllegalStateException.class,
              () ->
                  fixture.ontologies.executeInTransaction(
                      () -> {
                        fixture.capture(reference -> {});
                        throw new IllegalStateException("Roll back sealed capture");
                      }));
          assertEquals(0, fixture.rowCount("ontology_release_entity"));
          assertEquals(0, fixture.rowCount("ontology_release_member"));
          assertEquals(0, fixture.rowCount("ontology_release_event"));
          assertEquals(
              0L, fixture.ontologies.getState(fixture.ontology.getId()).getLastReleaseRevision());
          OntologyRelease release = fixture.capture(reference -> {});
          assertEquals(1L, release.getReleaseRevision());
          assertEquals(1, fixture.rowCount("ontology_release_event"));
          assertNull(fixture.ontologies.getState(fixture.ontology.getId()).getActiveReleaseId());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void aDeniedMemberAbortsTheWholeCapture(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          fixture.addConcepts(1);
          assertThrows(
              ForbiddenException.class,
              () ->
                  fixture.capture(
                      reference -> {
                        if (Entity.ONTOLOGY_CONCEPT.equals(reference.getType())) {
                          throw new ForbiddenException("Restricted concept");
                        }
                      }));
          assertEquals(0, fixture.rowCount("ontology_release_entity"));
          assertEquals(0, fixture.rowCount("ontology_release_event"));
          assertEquals(
              0L, fixture.ontologies.getState(fixture.ontology.getId()).getLastReleaseRevision());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void anUnlockedReadSeesEveryPageOrFailsWhenAWriteLandsMeanwhile(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          // 130 writes move the working revision past the boxed-Long cache, so a reference compare
          // of the revisions would report every read as torn.
          fixture.addConcepts(130);
          assertTrue(
              fixture.ontologies.getState(fixture.ontology.getId()).getWorkingRevision() > 127);
          final OntologyWorkingSnapshot snapshot = fixture.capture.snapshot();
          assertEquals(
              131,
              snapshot
                  .readUnlocked(
                      fixture.ontology.getId(), definitions -> {}, working -> working.entries())
                  .size());
          final List<Integer> seen = new ArrayList<>();
          final Supplier<Integer> readWhileAWriterCommits =
              () ->
                  snapshot.readUnlocked(
                      fixture.ontology.getId(),
                      definitions -> {
                        seen.add(definitions.size());
                        if (seen.size() == 2) {
                          CompletableFuture.runAsync(
                                  () -> fixture.addConcept("LandedDuringTheRead"))
                              .join();
                        }
                      },
                      working -> working.entries().size());
          // The pool runs on the driver's default isolation. MySQL's REPEATABLE READ keeps every
          // page on the snapshot the state read opened, so the read stays whole at 131; Postgres'
          // READ COMMITTED lets later statements see the committed write, the revision check
          // fires, and the second attempt reads all 132.
          final int whole = readWhileAWriterCommits.get();
          assertTrue(whole == 131 || whole == 132, "torn read of " + whole);
          assertEquals(
              132,
              snapshot
                  .read(fixture.ontology.getId(), definitions -> {}, working -> working.entries())
                  .size());
          final Supplier<Integer> readWhileWritersKeepCommitting =
              () ->
                  snapshot.readUnlocked(
                      fixture.ontology.getId(),
                      definitions ->
                          CompletableFuture.runAsync(
                                  () -> fixture.addConcept("Landed" + UUID.randomUUID()))
                              .join(),
                      working -> working.entries().size());
          if (dialect == ConnectionType.POSTGRES) {
            assertThrows(PreconditionFailedException.class, readWhileWritersKeepCommitting::get);
          } else {
            assertEquals(132, readWhileWritersKeepCommitting.get());
          }
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void aSealedReleaseIsReadFromTheCacheAndStillAuthorizedOnEveryRead(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          fixture.addConcepts(250);
          final OntologyRelease release = fixture.capture(reference -> {});
          final OntologyReleaseReader reader = new OntologyReleaseReader(Entity.getCollectionDAO());
          final List<Integer> coldBatches = new ArrayList<>();
          final var cold = reader.read(release, definitions -> coldBatches.add(definitions.size()));
          assertEquals(251, cold.size());
          assertEquals(List.of(1, 1, 250), coldBatches);
          final List<Integer> warmBatches = new ArrayList<>();
          final var warm = reader.read(release, definitions -> warmBatches.add(definitions.size()));
          assertSame(cold, warm);
          assertEquals(List.of(1, 251), warmBatches);
          assertThrows(
              ForbiddenException.class,
              () ->
                  reader.read(
                      release,
                      definitions -> {
                        if (definitions.stream().anyMatch(OntologyConcept.class::isInstance)) {
                          throw new ForbiddenException("Restricted concept");
                        }
                      }));
          assertEquals(
              251,
              reader
                  .read(
                      fixture.releases.get(null, release.getId(), fixture.releases.getFields("")),
                      definitions -> {})
                  .size());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void releasesAboveTheParsedHeapBudgetRemainReadableWithoutBeingCached(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final String description = "x".repeat(100_000);
          for (int index = 0; index < 230; index++) {
            fixture.concepts.create(
                null,
                new OntologyConcept()
                    .withId(UUID.randomUUID())
                    .withName("LargeConcept" + index)
                    .withDescription(description)
                    .withOntology(fixture.ontology.getEntityReference())
                    .withConceptType(OntologyConceptType.OWL_CLASS)
                    .withVersion(0.1)
                    .withUpdatedAt(1L)
                    .withUpdatedBy("admin"));
          }
          final OntologyRelease release = fixture.capture(reference -> {});
          final OntologyReleaseReader reader = new OntologyReleaseReader(Entity.getCollectionDAO());
          final var cold = reader.read(release, definitions -> {});
          assertEquals(231, cold.size());
          final var concepts =
              cold.stream().filter(member -> member.getMemberKind() == MemberKind.CONCEPT).toList();
          assertEquals(230, concepts.size());
          concepts.forEach(
              member ->
                  assertEquals(description, member.getPayload().path("description").asText()));
          await()
              .atMost(Duration.ofSeconds(10))
              .untilAsserted(
                  () -> {
                    final var reread = reader.read(release, definitions -> {});
                    assertTrue(
                        cold != reread, "A release above the heap budget must not stay cached");
                    assertEquals(cold, reread);
                  });
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void captureIncludesAllPagesAndRepeatCaptureReturnsTheSameRelease(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          fixture.addConcepts(101);
          OntologyRelease first = fixture.capture(reference -> {});
          OntologyRelease second = fixture.capture(reference -> {});
          assertEquals(102, first.getMemberCount());
          assertEquals(
              101,
              fixture
                  .releases
                  .listMembers(first.getId(), MemberKind.CONCEPT, 200, null)
                  .getData()
                  .size());
          assertEquals(first.getId(), second.getId());
          assertEquals(1, fixture.rowCount("ontology_release_entity"));
          String exported =
              new OntologyReleaseExporter(fixture.releases)
                  .export(
                      first,
                      OntologyExportFormat.N_TRIPLES,
                      new OntologyReleaseExportOptions(),
                      member -> {},
                      BoundAssetLinks.NONE);
          var model = ModelFactory.createDefaultModel();
          try {
            RDFParser.fromString(exported, Lang.NTRIPLES).parse(model);
            assertEquals(
                101, model.listResourcesWithProperty(RDF.type, OWL2.Class).toList().size());
          } finally {
            model.close();
          }
        });
  }
}
