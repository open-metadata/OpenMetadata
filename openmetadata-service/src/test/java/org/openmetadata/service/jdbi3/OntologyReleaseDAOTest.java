package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.ontology.OntologyReleaseRoles;

class OntologyReleaseDAOTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void roleCandidatesStayBoundedAndRetainAnOlderOpenReview(ConnectionType dialect) {
    withStorage(
        dialect,
        storage -> {
          final OntologyRelease olderReview =
              storage.release(1).withSealedAt(2L).withEntityStatus(EntityStatus.IN_REVIEW);
          final OntologyRelease newestReview =
              storage.release(2).withSealedAt(2L).withEntityStatus(EntityStatus.IN_REVIEW);
          final OntologyRelease active =
              storage.release(3).withSealedAt(2L).withEntityStatus(EntityStatus.APPROVED);
          final OntologyRelease approved =
              storage.release(4).withSealedAt(2L).withEntityStatus(EntityStatus.APPROVED);
          storage.insert(olderReview);
          storage.insert(newestReview);
          storage.insert(active);
          storage.insert(approved);
          assertEquals(1, storage.states().activate(storage.ontologyId(), active.getId(), 0));
          for (int revision = 5; revision <= 64; revision++) {
            storage.insert(storage.release(revision).withSealedAt(2L));
          }
          storage.insert(storage.release(65).withEntityStatus(EntityStatus.IN_REVIEW));
          storage.insert(
              storage
                  .release(66)
                  .withSealedAt(2L)
                  .withDeleted(true)
                  .withEntityStatus(EntityStatus.IN_REVIEW));
          final List<String> ids = List.of(storage.ontologyId().toString());
          assertEquals(4, storage.releases().listRoleCandidates(ids).size());
          final OntologyReleaseRoles roles = new OntologyReleaseRoles(storage.dao());
          final var initial = roles.read(List.of(storage.ontologyId())).get(storage.ontologyId());
          assertEquals(64L, initial.latest().getReleaseRevision());
          assertEquals(approved.getId(), initial.latestApproved().getId());
          assertEquals(active.getId(), initial.active().getId());
          assertEquals(newestReview.getId(), initial.inReview().getId());
          storage.releases().update(newestReview.withEntityStatus(EntityStatus.REJECTED));
          assertEquals(
              olderReview.getId(),
              roles
                  .read(List.of(storage.ontologyId()))
                  .get(storage.ontologyId())
                  .inReview()
                  .getId());
          storage.releases().update(olderReview.withEntityStatus(EntityStatus.REJECTED));
          assertNull(
              roles.read(List.of(storage.ontologyId())).get(storage.ontologyId()).inReview());
          assertEquals(3, storage.releases().listRoleCandidates(ids).size());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void retentionChecksIncludeReleasesCommittedAfterTheTransactionSnapshot(ConnectionType dialect) {
    withStorage(
        dialect,
        storage -> {
          storage.handle().begin();
          try {
            assertEquals(
                0,
                storage
                    .handle()
                    .createQuery("SELECT COUNT(*) FROM ontology_release_entity")
                    .mapTo(Integer.class)
                    .one());
            try (final Handle capture = storage.handle().getJdbi().open()) {
              capture.useTransaction(
                  transaction -> {
                    final var writer =
                        new Storage(
                            transaction,
                            transaction.attach(CollectionDAO.class),
                            storage.ontologyId());
                    writer.states().lock(storage.ontologyId());
                    writer.insert(writer.release(1));
                  });
            }
            storage.states().lock(storage.ontologyId());
            assertTrue(storage.releases().hasReleases(storage.ontologyId()));
          } finally {
            storage.handle().rollback();
          }
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void onlySealedMembersAreReadableAndTheirMembershipIsImmutable(ConnectionType dialect) {
    withStorage(
        dialect,
        storage -> {
          OntologyRelease release = storage.release(1);
          OntologyReleaseMember member = member(release);
          assertFalse(storage.releases().hasReleases(storage.ontologyId()));
          storage.insert(release);
          assertTrue(storage.releases().hasReleases(storage.ontologyId()));
          assertFalse(storage.releases().hasReleases(UUID.randomUUID()));
          assertEquals(1, storage.releases().insertMember(member));
          assertThrows(
              UnableToExecuteStatementException.class,
              () -> storage.releases().insertMember(member));
          assertNull(
              storage.releases().getMember(release.getId(), "CONCEPT", member.getMemberId()));
          assertTrue(storage.releases().listMembers(release.getId(), "CONCEPT", "", 10).isEmpty());
          sealHeader(release, member);
          assertEquals(
              0, storage.releases().seal(release.getId(), JsonUtils.pojoToJson(release), 2));
          assertEquals(
              1, storage.releases().seal(release.getId(), JsonUtils.pojoToJson(release), 1));
          assertEquals(0, storage.releases().insertMember(member(release)));
          assertEquals(
              0, storage.releases().seal(release.getId(), JsonUtils.pojoToJson(release), 1));
          List<OntologyReleaseMember> captured =
              storage.releases().listMembers(release.getId(), "CONCEPT", "", 10);
          assertEquals(release.getContentDigest(), OntologyReleaseManifest.digest(captured));
          assertEquals(
              "HTTPS://EXAMPLE.org/客户", captured.getFirst().getPayload().path("iri").asText());
          assertEquals(0.2, captured.getFirst().getSourceVersion());
          assertTrue(
              storage
                  .releases()
                  .listMembers(release.getId(), "CONCEPT", member.getMemberId().toString(), 10)
                  .isEmpty());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void activationRequiresAnApprovedOwnedReleaseAndNeverReusesARevision(ConnectionType dialect) {
    withStorage(
        dialect,
        storage -> {
          OntologyRelease first = storage.release(1);
          OntologyReleaseMember firstMember = member(first);
          storage.insert(first);
          assertEquals(0, storage.states().activate(storage.ontologyId(), first.getId(), 0));
          storage.releases().insertMember(firstMember);
          sealHeader(first, firstMember);
          storage.releases().seal(first.getId(), JsonUtils.pojoToJson(first), 1);
          assertEquals(0, storage.states().activate(storage.ontologyId(), first.getId(), 0));
          storage.releases().update(first.withEntityStatus(EntityStatus.APPROVED));
          assertEquals(1, storage.states().activate(storage.ontologyId(), first.getId(), 0));
          assertEquals(0, storage.states().activate(storage.ontologyId(), first.getId(), 0));

          UUID otherOntology = UUID.randomUUID();
          storage.states().initialize(otherOntology);
          assertEquals(0, storage.states().activate(otherOntology, first.getId(), 0));
          OntologyRelease second = storage.release(2);
          OntologyReleaseMember secondMember = member(second);
          storage.insert(second);
          storage.releases().insertMember(secondMember);
          sealHeader(second, secondMember);
          second.setEntityStatus(EntityStatus.APPROVED);
          storage.releases().seal(second.getId(), JsonUtils.pojoToJson(second), 1);
          assertEquals(1, storage.states().activate(storage.ontologyId(), second.getId(), 1));
          assertEquals(1, storage.states().activate(storage.ontologyId(), first.getId(), 2));
          assertEquals(0, storage.states().activate(storage.ontologyId(), second.getId(), 1));
          OntologyState state = storage.states().get(storage.ontologyId());
          assertEquals(first.getId(), state.getActiveReleaseId());
          assertEquals(3L, state.getActivationRevision());
          storage.releases().update(second.withDeleted(true));
          assertEquals(0, storage.states().activate(storage.ontologyId(), second.getId(), 3));
          assertTrue(storage.releases().hasReleases(storage.ontologyId()));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void memberPayloadsPreserveDecimalPrecision(ConnectionType dialect) {
    withStorage(
        dialect,
        storage -> {
          OntologyRelease release = storage.release(1);
          OntologyReleaseMember member =
              OntologyReleaseManifest.member(
                  release.getId(),
                  MemberKind.AXIOM,
                  UUID.randomUUID(),
                  JsonUtils.getObjectNode()
                      .put("value", new BigDecimal("0.12345678901234567890123456789")));
          storage.insert(release);
          storage.releases().insertMember(member);
          sealHeader(release, member);
          storage.releases().seal(release.getId(), JsonUtils.pojoToJson(release), 1);
          OntologyReleaseMember stored =
              storage.releases().getMember(release.getId(), "AXIOM", member.getMemberId());
          assertEquals(member.getPayload(), stored.getPayload());
          assertEquals(release.getContentDigest(), OntologyReleaseManifest.digest(List.of(stored)));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void candidateContentCountersAndAuditEventsRollBackTogether(ConnectionType dialect) {
    withStorage(
        dialect,
        storage -> {
          OntologyRelease release = storage.release(1);
          OntologyReleaseMember member = member(release);
          assertThrows(
              IllegalStateException.class,
              () ->
                  storage
                      .dao()
                      .useTransaction(
                          transaction -> {
                            assertEquals(
                                0L,
                                storage.states().lock(storage.ontologyId()).getWorkingRevision());
                            assertEquals(
                                1, storage.states().advanceWorkingRevision(storage.ontologyId()));
                            assertEquals(
                                1,
                                storage.states().allocateReleaseRevision(storage.ontologyId(), 0));
                            assertEquals(
                                0,
                                storage.states().allocateReleaseRevision(storage.ontologyId(), 0));
                            storage.insert(release);
                            storage.releases().insertMember(member);
                            sealHeader(release, member);
                            storage
                                .releases()
                                .seal(release.getId(), JsonUtils.pojoToJson(release), 1);
                            storage
                                .releases()
                                .appendEvent(
                                    UUID.randomUUID(),
                                    storage.ontologyId(),
                                    release.getId(),
                                    "CAPTURED",
                                    2,
                                    "author",
                                    "{\"sourceWorkingRevision\":1}");
                            throw new IllegalStateException("Roll back candidate capture");
                          }));
          OntologyState state = storage.states().get(storage.ontologyId());
          assertEquals(0L, state.getWorkingRevision());
          assertEquals(0L, state.getLastReleaseRevision());
          assertNull(state.getActiveReleaseId());
          assertThrows(
              EntityNotFoundException.class,
              () -> storage.releases().findEntityById(release.getId()));
          assertEquals(
              0,
              storage
                  .handle()
                  .createQuery("SELECT COUNT(*) FROM ontology_release_member WHERE releaseId = :id")
                  .bind("id", release.getId().toString())
                  .mapTo(Integer.class)
                  .one());
          assertEquals(
              0,
              storage
                  .handle()
                  .createQuery("SELECT COUNT(*) FROM ontology_release_event WHERE releaseId = :id")
                  .bind("id", release.getId().toString())
                  .mapTo(Integer.class)
                  .one());
        });
  }

  private static void sealHeader(OntologyRelease release, OntologyReleaseMember member) {
    release
        .withContentDigest(OntologyReleaseManifest.digest(List.of(member)))
        .withMemberCount(1)
        .withTotalBytes(member.getPayloadBytes())
        .withSealedAt(2L);
  }

  private static OntologyReleaseMember member(OntologyRelease release) {
    return OntologyReleaseManifest.member(
        release.getId(),
        MemberKind.CONCEPT,
        UUID.randomUUID(),
        JsonUtils.readTree(
            "{\"iri\":\"HTTPS://EXAMPLE.org/客户\",\"version\":0.2,\"reviewRevision\":3}"));
  }

  private static void withStorage(ConnectionType dialect, Consumer<Storage> assertion) {
    OntologyTestDatabase.withDatabase(
        dialect,
        handle -> {
          OntologyTestDatabase.migrate(handle, dialect);
          OntologyTestDatabase.migrate(handle, dialect);
          Storage storage =
              new Storage(handle, handle.attach(CollectionDAO.class), UUID.randomUUID());
          storage.states().initialize(storage.ontologyId());
          storage.states().initialize(storage.ontologyId());
          assertion.accept(storage);
        });
  }

  private record Storage(Handle handle, CollectionDAO dao, UUID ontologyId) {
    OntologyStateDAO states() {
      return dao.ontologyStateDAO();
    }

    OntologyReleaseDAO releases() {
      return dao.ontologyReleaseDAO();
    }

    void insert(OntologyRelease release) {
      releases().insert(release, release.getFullyQualifiedName());
    }

    OntologyRelease release(long revision) {
      return new OntologyRelease()
          .withId(UUID.randomUUID())
          .withName("release" + revision)
          .withFullyQualifiedName("Sales." + ontologyId + ".release" + revision)
          .withOntology(new EntityReference().withId(ontologyId).withType("ontology"))
          .withReleaseRevision(revision)
          .withSourceWorkingRevision(0L)
          .withOntologyIri(URI.create("https://example.org/sales"))
          .withVersionIri(URI.create("https://example.org/sales/release/" + revision))
          .withEncodingVersion(
              OntologyRelease.EncodingVersion.fromValue(OntologyReleaseManifest.ENCODING_VERSION))
          .withEntityStatus(EntityStatus.DRAFT)
          .withUpdatedAt(1L)
          .withUpdatedBy("author")
          .withSealedBy("author");
    }
  }
}
