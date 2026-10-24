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
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.OntologyWorkingDiff;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseChangeType;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyWorkingDiffIT extends BaseOntologyApprovalIT {
  @Test
  void workingDiffPagesChangesAgainstTheActiveRelease(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept changed = concept(ontology, "Changed");
    final OntologyConcept removed = concept(ontology, "Removed");
    final OntologyRelease active = activate(ns, ontology);
    final var client = SdkClients.adminClient();
    client
        .ontologyConcepts()
        .update(changed.getId(), changed.withDescription("Working description"));
    client.ontologyConcepts().delete(removed.getId().toString(), Map.of("hardDelete", "true"));
    final OntologyConcept added = concept(ontology, "Added");

    final Map<UUID, OntologyReleaseChangeType> changes = new HashMap<>();
    String after = null;
    for (int page = 0; page < 3; page++) {
      final OntologyWorkingDiff diff = client.ontologies().workingDiff(ontology.getId(), 1, after);
      assertEquals(active.getId(), diff.getState().getActiveReleaseId());
      assertEquals(
          client.ontologies().state(ontology.getId()).getWorkingRevision(),
          diff.getState().getWorkingRevision());
      assertEquals(3, diff.getPaging().getTotal());
      assertEquals(1, diff.getData().size());
      final var change = diff.getData().getFirst();
      assertEquals(ontology.getId(), change.getOntologyId());
      assertEquals(MemberKind.CONCEPT, change.getMemberKind());
      assertEquals(
          change.getChangeType() == OntologyReleaseChangeType.ADDED ? null : active.getId(),
          change.getBeforeReleaseId());
      assertNull(change.getAfterReleaseId());
      assertNull(changes.put(change.getEntity().getId(), change.getChangeType()));
      after = diff.getPaging().getAfter();
      if (page < 2) {
        assertFalse(after == null || after.isBlank());
      }
    }
    assertNull(after);
    assertEquals(
        Map.of(
            changed.getId(), OntologyReleaseChangeType.CHANGED,
            removed.getId(), OntologyReleaseChangeType.REMOVED,
            added.getId(), OntologyReleaseChangeType.ADDED),
        changes);
    assertEquals(
        active.getContentDigest(),
        client.ontologyReleases().get(active.getId()).getContentDigest());
  }

  @Test
  void unactivatedOntologyShowsWorkingAdditionsAndAStaleCursorIsRejected(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept first = concept(ontology, "First");
    final var client = SdkClients.adminClient();
    final OntologyWorkingDiff firstPage =
        client.ontologies().workingDiff(ontology.getId(), 1, null);
    assertNull(firstPage.getState().getActiveReleaseId());
    assertEquals(2, firstPage.getPaging().getTotal());
    assertEquals(OntologyReleaseChangeType.ADDED, firstPage.getData().getFirst().getChangeType());
    final String after = firstPage.getPaging().getAfter();
    assertFalse(after == null || after.isBlank());
    assertEquals(first.getId(), firstPage.getData().getFirst().getEntity().getId());
    assertEquals(
        ontology.getId(),
        client
            .ontologies()
            .workingDiff(ontology.getId(), 1, after)
            .getData()
            .getFirst()
            .getEntity()
            .getId());
    concept(ontology, "Second");
    assertEquals(
        412,
        assertThrows(
                OpenMetadataException.class,
                () -> client.ontologies().workingDiff(ontology.getId(), 1, after))
            .getStatusCode());
    for (final int limit : List.of(0, 1001)) {
      assertEquals(
          400,
          assertThrows(
                  OpenMetadataException.class,
                  () -> client.ontologies().workingDiff(ontology.getId(), limit, null))
              .getStatusCode());
    }
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> client.ontologies().workingDiff(ontology.getId(), 1, "not-a-cursor"))
            .getStatusCode());
  }

  @Test
  void captureRejectsAnActivationThatChangedAfterWorkingDiff(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    concept(ontology, "Candidate");
    final OntologyWorkingDiff observed =
        SdkClients.adminClient().ontologies().workingDiff(ontology.getId(), 1, null);
    final var observedState = observed.getState();
    final OntologyRelease release = activate(ns, ontology);
    assertEquals(
        412,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    SdkClients.adminClient()
                        .ontologies()
                        .workingDiff(ontology.getId(), 1, observed.getPaging().getAfter()))
            .getStatusCode());
    final CaptureOntologyRelease staleCapture =
        new CaptureOntologyRelease()
            .withExpectedWorkingRevision(observedState.getWorkingRevision())
            .withExpectedActivationRevision(observedState.getActivationRevision());
    assertEquals(
        412,
        assertThrows(
                OpenMetadataException.class,
                () -> SdkClients.adminClient().ontologies().capture(ontology.getId(), staleCapture))
            .getStatusCode());
    assertEquals(
        release.getId(),
        SdkClients.adminClient().ontologies().state(ontology.getId()).getActiveReleaseId());
  }

  @Test
  void unreadableWorkingMemberRejectsTheWholeDiff(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    concept(ontology, "Restricted");
    try (var fixtures = new RdfAccessFixtures("working" + ns.shortPrefix())) {
      final var role = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_CONCEPT);
      final var editor = fixtures.allowRole(MetadataOperation.EDIT_ALL, Entity.ONTOLOGY);
      final OpenMetadataClient denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(role.getId(), editor.getId())))
                  .build());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () -> denied.ontologies().workingDiff(ontology.getId(), 10, null))
              .getStatusCode());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      denied
                          .ontologies()
                          .previewImport(
                              ontology.getId(),
                              new PreviewNativeOntologyImport()
                                  .withFormat(PreviewNativeOntologyImport.Format.TURTLE)
                                  .withData(
                                      "<https://example.org/New> a <http://www.w3.org/2002/07/owl#Class> .")))
              .getStatusCode());
    }
  }

  private static OntologyConcept concept(Ontology ontology, String name) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withOntology(ontology.getFullyQualifiedName())
                .withName(name)
                .withConceptType(OntologyConceptType.OWL_CLASS));
  }
}
