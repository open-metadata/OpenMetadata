package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.net.URI;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.OntologyDefinitionStatus;
import org.openmetadata.schema.type.OntologyPublicationStage;
import org.openmetadata.schema.type.OntologyPublicationStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.service.Entity;

@Isolated("Counts SQL statements while listing definitions over HTTP")
@ExtendWith(TestNamespaceExtension.class)
class IndependentOntologyStatusIT extends BaseOntologyApprovalIT {
  @Test
  void aConceptWalksThroughEditReviewRejectionApprovalAndActivation(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept concept = declareClass(ontology, "Customer", iri(ontology, "Customer"));
    assertEquals(OntologyDefinitionStatus.DRAFT, status(concept));
    assertNull(publication(ontology).getLatest());

    final OntologyRelease first = capture(ontology);
    assertEquals(OntologyDefinitionStatus.DRAFT, status(concept));
    final Task firstReview = submit(ns, Entity.ONTOLOGY_RELEASE, first.getFullyQualifiedName());
    assertEquals(OntologyDefinitionStatus.IN_REVIEW, status(concept));
    assertEquals(OntologyPublicationStage.IN_REVIEW, publication(ontology).getLatest().getStage());

    resolve(firstReview, TaskResolutionType.Rejected);
    assertEquals(OntologyDefinitionStatus.DRAFT, status(concept));
    assertEquals(
        OntologyPublicationStage.CHANGES_REQUESTED, publication(ontology).getLatest().getStage());

    edit(concept, "A party that buys");
    assertEquals(OntologyDefinitionStatus.DRAFT, status(concept));
    final OntologyRelease second = capture(ontology);
    final Task secondReview = submit(ns, Entity.ONTOLOGY_RELEASE, second.getFullyQualifiedName());
    assertEquals(OntologyDefinitionStatus.IN_REVIEW, status(concept));

    resolve(secondReview, TaskResolutionType.Approved);
    assertEquals(OntologyDefinitionStatus.APPROVED, status(concept));
    final OntologyPublicationStatus approved = publication(ontology);
    assertNull(approved.getActive());
    assertEquals(OntologyPublicationStage.APPROVED, approved.getLatest().getStage());

    activate(ontology, second);
    final OntologyPublicationStatus published = publication(ontology);
    assertEquals(second.getId(), published.getActive().getReleaseId());
    assertNotNull(published.getActive().getActivatedAt());
    assertEquals(OntologyPublicationStage.PUBLISHED, published.getLatest().getStage());
    assertEquals(0, published.getUnpublishedChanges());
    assertEquals(OntologyDefinitionStatus.APPROVED, status(concept));
  }

  @Test
  void editingAnApprovedConceptTurnsOnlyThatConceptBackToDraft(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept edited = declareClass(ontology, "Edited", iri(ontology, "Edited"));
    final OntologyConcept sibling = declareClass(ontology, "Sibling", iri(ontology, "Sibling"));
    final OntologyRelease release = capture(ontology);
    approve(ns, release);

    edit(edited, "Changed after approval");

    assertEquals(OntologyDefinitionStatus.DRAFT, status(edited));
    assertEquals(OntologyDefinitionStatus.APPROVED, status(sibling));
  }

  @Test
  void clientsCannotWriteTheDerivedFields(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept concept = declareClass(ontology, "Fixed", iri(ontology, "Fixed"));
    final var client = SdkClients.adminClient();
    final var patch =
        org.openmetadata.schema.utils.JsonUtils.readTree(
            "[{\"op\":\"add\",\"path\":\"/lifecycleStatus\",\"value\":\"Approved\"}]");

    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> client.ontologyConcepts().patch(concept.getId(), patch))
            .getStatusCode());
    assertEquals(OntologyDefinitionStatus.DRAFT, status(concept));
  }

  @Test
  void unpublishedChangesEqualTheRowsOfEachOntologysWorkingDiff(TestNamespace ns) {
    final Ontology first = createOntology(ns, "first");
    final Ontology second = createOntology(ns, "second");
    final OntologyConcept firstA = declareClass(first, "A", iri(first, "A"));
    declareClass(first, "B", iri(first, "B"));
    final OntologyConcept secondA = declareClass(second, "A", iri(second, "A"));
    for (final Ontology ontology : new Ontology[] {first, second}) {
      final OntologyRelease release = capture(ontology);
      approve(ns, release);
      activate(ontology, release);
    }
    assertEquals(0, publication(first).getUnpublishedChanges());

    edit(firstA, "changed");
    declareClass(first, "C", iri(first, "C"));
    edit(secondA, "changed");

    for (final Ontology ontology : new Ontology[] {first, second}) {
      assertEquals(workingDiffRows(ontology), publication(ontology).getUnpublishedChanges());
    }
    assertEquals(2, publication(first).getUnpublishedChanges());
    assertEquals(1, publication(second).getUnpublishedChanges());
  }

  @Test
  void aCapturedReleaseStoresTheCountsOfItsDiff(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept changed = declareClass(ontology, "Changed", iri(ontology, "Changed"));
    declareClass(ontology, "Kept", iri(ontology, "Kept"));
    final OntologyRelease base = capture(ontology);
    approve(ns, base);
    activate(ontology, base);
    assertEquals(3, base.getChangeSummary().getAdded());

    edit(changed, "changed");
    declareClass(ontology, "AddedOne", iri(ontology, "AddedOne"));
    declareClass(ontology, "AddedTwo", iri(ontology, "AddedTwo"));
    final OntologyRelease release = capture(ontology);

    assertEquals(2, release.getChangeSummary().getAdded());
    assertEquals(1, release.getChangeSummary().getChanged());
    assertEquals(0, release.getChangeSummary().getRemoved());
    assertEquals(
        3,
        SdkClients.adminClient()
            .ontologyReleases()
            .diff(release.getId(), null, 100, null)
            .getPaging()
            .getTotal());
  }

  @Test
  void listingStatusesCostsTheSameNumberOfReleaseReadsForAnyPageSize(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final Ontology ontology = createOntology(ns);
    final OntologyConcept edited = declareClass(ontology, "Edited0", iri(ontology, "Edited0"));
    addConcepts(ontology, 1, 4);
    final OntologyRelease release = capture(ontology);
    approve(ns, release);
    edit(edited, "forces a payload comparison");
    listConceptStatuses(ontology, 4);
    final int narrow = releaseReads(() -> listConceptStatuses(ontology, 4));
    addConcepts(ontology, 4, 40);
    listConceptStatuses(ontology, 40);
    final int wide = releaseReads(() -> listConceptStatuses(ontology, 40));

    assertTrue(narrow > 0, "The SQL probe must observe the status reads");
    assertEquals(narrow, wide, "A longer page must not add release reads");
    assertTrue(wide <= 4, "Roles, member versions and member payloads only: " + wide);
  }

  @Test
  void listingPublicationStatusCostsTheSameNumberOfReleaseReadsForAnyNumberOfOntologies(
      TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final Ontology first = createOntology(ns, "one");
    declareClass(first, "A", iri(first, "A"));
    final int narrow = releaseReads(() -> listPublicationStatuses(first));
    for (int index = 0; index < 5; index++) {
      final Ontology other = createOntology(ns, "other" + index);
      declareClass(other, "A", iri(other, "A"));
    }
    final int wide = releaseReads(() -> listPublicationStatuses(first));

    assertTrue(narrow > 0, "The SQL probe must observe the status reads");
    assertEquals(narrow, wide, "More ontologies on a page must not add release reads");
  }

  private static int releaseReads(Runnable request) {
    try (var queries =
        SqlQueryCounter.forRequests(
            Entity.getJdbi(),
            "select",
            statement -> {
              final String sql = statement.getRenderedSql().toLowerCase(Locale.ROOT);
              return sql.contains("ontology_release_") || sql.contains("ontology_state");
            })) {
      request.run();
      return queries.count();
    }
  }

  private static void listConceptStatuses(Ontology ontology, int expected) {
    final var page =
        SdkClients.adminClient()
            .ontologyConcepts()
            .list(
                new ListParams()
                    .setLimit(100)
                    .setFields("lifecycleStatus")
                    .addFilter("ontology", ontology.getFullyQualifiedName()));
    assertEquals(expected, page.getData().size());
    page.getData().forEach(concept -> assertNotNull(concept.getLifecycleStatus()));
  }

  private static void listPublicationStatuses(Ontology ontology) {
    final var page =
        SdkClients.adminClient()
            .ontologies()
            .list(new ListParams().setLimit(100).setFields("publicationStatus"));
    assertTrue(page.getData().stream().allMatch(o -> o.getPublicationStatus() != null));
    assertTrue(page.getData().stream().anyMatch(o -> o.getId().equals(ontology.getId())));
  }

  private static void addConcepts(Ontology ontology, int from, int to) {
    for (int index = from; index < to; index++) {
      declareClass(ontology, "Concept" + index, iri(ontology, "Concept" + index));
    }
  }

  private static int workingDiffRows(Ontology ontology) {
    final Set<String> seen = new HashSet<>();
    String after = null;
    do {
      final var page =
          SdkClients.adminClient().ontologies().workingDiff(ontology.getId(), 1, after);
      page.getData().forEach(row -> seen.add(row.getMemberKind() + ":" + row.getEntity().getId()));
      after = page.getPaging().getAfter();
    } while (after != null);
    return seen.size();
  }

  private static OntologyDefinitionStatus status(OntologyConcept concept) {
    return SdkClients.adminClient()
        .ontologyConcepts()
        .get(concept.getId().toString(), "lifecycleStatus")
        .getLifecycleStatus();
  }

  private static OntologyPublicationStatus publication(Ontology ontology) {
    return SdkClients.adminClient()
        .ontologies()
        .get(ontology.getId().toString(), "publicationStatus")
        .getPublicationStatus();
  }

  private static void edit(OntologyConcept concept, String description) {
    final var service = SdkClients.adminClient().ontologyConcepts();
    final OntologyConcept loaded = service.get(concept.getId().toString(), "lifecycleStatus");
    service.update(concept.getId().toString(), loaded.withDescription(description));
  }

  private static void approve(TestNamespace ns, OntologyRelease release) {
    resolve(
        submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName()),
        TaskResolutionType.Approved);
  }

  private static void resolve(Task task, TaskResolutionType type) {
    SdkClients.user1Client().tasks().resolve(task.getId().toString(), decision(type));
  }

  private static void activate(Ontology ontology, OntologyRelease release) {
    final var service = SdkClients.adminClient().ontologies();
    service.activate(
        ontology.getId(),
        new ActivateOntologyRelease()
            .withReleaseId(release.getId())
            .withExpectedActivationRevision(
                service.state(ontology.getId()).getActivationRevision()));
  }

  private static URI iri(Ontology ontology, String name) {
    return URI.create(ontology.getNamespace() + name);
  }
}
