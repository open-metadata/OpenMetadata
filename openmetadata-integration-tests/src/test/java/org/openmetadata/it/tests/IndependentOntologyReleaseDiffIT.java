package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.OntologyReleaseDiff;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseChangeType;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReleaseDiffIT extends BaseOntologyApprovalIT {
  @Test
  void comparisonPagesDescribeFrozenAdditionsChangesAndRemovals(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Ontology ontology = createOntology(ns);
    final OntologyConcept customer = concept(ontology, "Customer");
    final OntologyConcept legacy = concept(ontology, "Legacy");
    final OntologyRelease base = capture(ontology);
    client.ontologyConcepts().update(customer.getId(), customer.withDescription("Reviewed change"));
    client.ontologyConcepts().delete(legacy.getId().toString(), Map.of("hardDelete", "true"));
    final OntologyConcept added = concept(ontology, "NewConcept");
    final OntologyRelease release = capture(ontology);
    client
        .ontologyConcepts()
        .update(
            customer.getId(),
            client
                .ontologyConcepts()
                .get(customer.getId())
                .withDescription("Later working change"));
    client.ontologies().delete(ontology.getId().toString(), Map.of("recursive", "true"));

    final Map<UUID, OntologyReleaseChangeType> changes = new HashMap<>();
    String after = null;
    for (int page = 0; page < 3; page++) {
      final OntologyReleaseDiff result = diff(release, base, after);
      assertEquals(release.getContentDigest(), result.getContentDigest());
      assertEquals(base.getContentDigest(), result.getBaseContentDigest());
      assertEquals(3, result.getPaging().getTotal());
      assertEquals(1, result.getData().size());
      final var change = result.getData().getFirst();
      final UUID id = change.getEntity().getId();
      assertNull(changes.put(id, change.getChangeType()));
      assertEquals(ontology.getId(), change.getOntologyId());
      assertEquals(MemberKind.CONCEPT, change.getMemberKind());
      if (!id.equals(added.getId())) {
        assertEquals(base.getId(), change.getBeforeReleaseId());
      }
      if (!id.equals(legacy.getId())) {
        assertEquals(release.getId(), change.getAfterReleaseId());
      }
      after = result.getPaging().getAfter();
      if (page < 2) {
        assertFalse(after == null || after.isBlank());
      }
    }
    assertNull(after);
    assertEquals(
        Map.of(
            customer.getId(),
            OntologyReleaseChangeType.CHANGED,
            legacy.getId(),
            OntologyReleaseChangeType.REMOVED,
            added.getId(),
            OntologyReleaseChangeType.ADDED),
        changes);
  }

  @Test
  void firstReleaseHasOnlyAdditionsAndWorkflowChangesDoNotChangeMeaning(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyRelease base = capture(ontology);
    final OntologyReleaseDiff first = diff(base, null, null);
    assertEquals(1, first.getPaging().getTotal());
    assertEquals(OntologyReleaseChangeType.ADDED, first.getData().getFirst().getChangeType());
    assertNull(first.getData().getFirst().getBeforeReleaseId());

    final var review = submit(ns, Entity.ONTOLOGY_RELEASE, base.getFullyQualifiedName());
    SdkClients.user1Client()
        .tasks()
        .resolve(review.getId().toString(), decision(TaskResolutionType.Approved));
    final OntologyRelease approved = capture(ontology);
    assertEquals(base.getContentDigest(), approved.getContentDigest());
    final OntologyReleaseDiff unchanged = diff(approved, base, null);
    assertEquals(0, unchanged.getPaging().getTotal());
    assertEquals(0, unchanged.getData().size());
  }

  @Test
  void comparisonRequiresOneOntologyAndBindsCursorsToBothReleases(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    concept(ontology, "Customer");
    final OntologyRelease release = capture(ontology);
    final OntologyRelease unrelated = capture(createOntology(ns, "unrelated"));
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> diff(release, unrelated, null))
            .getStatusCode());
    final String after = diff(release, null, null).getPaging().getAfter();
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> diff(release, release, after))
            .getStatusCode());
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> diff(release, null, "not-a-cursor"))
            .getStatusCode());
    for (final String malformed : List.of("", "x".repeat(257))) {
      assertEquals(
          400,
          assertThrows(OpenMetadataException.class, () -> diff(release, null, malformed))
              .getStatusCode());
    }
    for (final int limit : List.of(0, 1001)) {
      assertEquals(
          400,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      SdkClients.adminClient()
                          .ontologyReleases()
                          .diff(release.getId(), null, limit, null))
              .getStatusCode());
    }
    assertEquals(
        404,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    SdkClients.adminClient()
                        .ontologyReleases()
                        .diff(release.getId(), UUID.randomUUID(), 1, null))
            .getStatusCode());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void unreadableMembersOnEitherSideRejectTheWholeComparison(boolean removal, TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "permissions" + removal);
    final OntologyConcept member = concept(ontology, "Restricted");
    final OntologyRelease populated = capture(ontology);
    SdkClients.adminClient()
        .ontologyConcepts()
        .delete(member.getId().toString(), Map.of("hardDelete", "true"));
    final OntologyRelease empty = capture(ontology);
    try (var fixtures = new RdfAccessFixtures("diff" + ns.shortPrefix() + removal)) {
      final var role = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_CONCEPT);
      final var denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(role.getId())))
                  .build());
      assertEquals(empty.getId(), denied.ontologyReleases().get(empty.getId()).getId());
      assertEquals(populated.getId(), denied.ontologyReleases().get(populated.getId()).getId());
      assertEquals(
          1, denied.ontologyReleases().diff(empty.getId(), null, 1, null).getPaging().getTotal());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      denied
                          .ontologyReleases()
                          .diff(
                              removal ? empty.getId() : populated.getId(),
                              removal ? populated.getId() : empty.getId(),
                              1,
                              null))
              .getStatusCode());
    }
  }

  private static OntologyConcept concept(Ontology ontology, String name) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName(name)
                .withOntology(ontology.getFullyQualifiedName())
                .withConceptType(OntologyConceptType.OWL_CLASS));
  }

  private static OntologyReleaseDiff diff(
      OntologyRelease release, OntologyRelease base, String after) {
    return SdkClients.adminClient()
        .ontologyReleases()
        .diff(release.getId(), base == null ? null : base.getId(), 1, after);
  }
}
