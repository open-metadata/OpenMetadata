package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyReviewTarget;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

class OntologyReviewTest {
  @Test
  void governanceAssignmentsDoNotInvalidateApprovedMeaning() {
    OntologyRelease approved =
        ontology().withEntityStatus(EntityStatus.APPROVED).withReviewTask(UUID.randomUUID());
    OntologyRelease reassigned =
        JsonUtils.deepCopy(approved, OntologyRelease.class)
            .withOwners(List.of(new EntityReference().withId(UUID.randomUUID()).withType("user")))
            .withReviewers(
                List.of(new EntityReference().withId(UUID.randomUUID()).withType("team")));
    assertEquals(OntologyReview.digest(approved), OntologyReview.digest(reassigned));
    assertEquals(EntityStatus.APPROVED, reassigned.getEntityStatus());
    assertEquals(approved.getReviewRevision(), reassigned.getReviewRevision());
    assertEquals(approved.getReviewTask(), reassigned.getReviewTask());
  }

  @Test
  void creationStartsInDraftRegardlessOfRequestedStatus() {
    for (EntityStatus requested : EntityStatus.values()) {
      OntologyRelease ontology = ontology().withEntityStatus(requested);
      OntologyReview.initialize(ontology);
      assertEquals(EntityStatus.DRAFT, ontology.getEntityStatus());
      assertEquals(1L, ontology.getReviewRevision());
      assertEquals("author", ontology.getReviewAuthor());
    }
  }

  @Test
  void auditAndWorkflowFieldsDoNotChangeTheReviewDigest() {
    OntologyRelease original = ontology();
    OntologyRelease updated =
        JsonUtils.deepCopy(original, OntologyRelease.class)
            .withVersion(0.2)
            .withUpdatedAt(123L)
            .withUpdatedBy("governance-bot")
            .withEntityStatus(EntityStatus.IN_REVIEW);

    assertEquals(OntologyReview.digest(original), OntologyReview.digest(updated));
  }

  @Test
  void reviewTargetRetainsTheSubmittedEntityHistoryVersion() {
    OntologyRelease submitted = ontology().withVersion(0.4);
    OntologyReviewTarget target = OntologyReview.target(submitted);

    assertEquals(0.4, target.getEntityVersion());
    assertEquals(submitted.getOntology().getId(), target.getOntologyId());
    assertDoesNotThrow(
        () ->
            OntologyReview.validateTarget(
                submitted.withVersion(0.5).withEntityStatus(EntityStatus.IN_REVIEW), target));
    assertThrows(
        BadRequestException.class,
        () -> OntologyReview.validateTarget(submitted, target.withEntityVersion(null)));
  }

  @Test
  void reviewTargetCannotBeMovedToAnotherOntology() {
    final OntologyRelease concept =
        new OntologyRelease()
            .withId(UUID.randomUUID())
            .withOntology(new EntityReference().withId(UUID.randomUUID()).withType("ontology"))
            .withVersion(0.1)
            .withReviewRevision(1L)
            .withReviewAuthor("author");
    final OntologyReviewTarget target = OntologyReview.target(concept);

    assertEquals(concept.getOntology().getId(), target.getOntologyId());
    assertDoesNotThrow(() -> OntologyReview.validateTarget(concept, target));
    target.setOntologyId(UUID.randomUUID());
    assertThrows(BadRequestException.class, () -> OntologyReview.validateTarget(concept, target));
  }

  @Test
  void approvalRequiresSomeoneOtherThanBothAuthorAndSubmitter() {
    OntologyRelease entity = ontology();
    Task task = new Task().withCreatedBy(new EntityReference().withName("submitter"));

    assertThrows(
        BadRequestException.class,
        () -> OntologyReview.requireIndependentReviewer(entity, task, "author"));
    assertThrows(
        BadRequestException.class,
        () -> OntologyReview.requireIndependentReviewer(entity, task, "submitter"));
    assertDoesNotThrow(() -> OntologyReview.requireIndependentReviewer(entity, task, "reviewer"));
  }

  @Test
  void referencePresentationDoesNotChangeTheReviewedContent() {
    EntityReference reviewer = new EntityReference().withId(UUID.randomUUID()).withType("user");
    OntologyRelease original = ontology().withReviewers(List.of(reviewer));
    OntologyRelease updated = JsonUtils.deepCopy(original, OntologyRelease.class);
    updated
        .getReviewers()
        .getFirst()
        .withName("Reviewer")
        .withHref(URI.create("https://example.org/user"));

    assertEquals(OntologyReview.digest(original), OntologyReview.digest(updated));
  }

  @Test
  void reviewerOrderingDoesNotChangeTheReviewTarget() {
    EntityReference first = new EntityReference().withId(UUID.randomUUID()).withType("user");
    EntityReference second = new EntityReference().withId(UUID.randomUUID()).withType("user");
    OntologyRelease original = ontology().withReviewers(List.of(first, second));
    OntologyRelease reordered =
        JsonUtils.deepCopy(original, OntologyRelease.class).withReviewers(List.of(second, first));

    assertEquals(OntologyReview.digest(original), OntologyReview.digest(reordered));
  }

  @Test
  void workflowFingerprintDetectsPolicyChangesWithinOneVersion() {
    WorkflowDefinition original =
        new WorkflowDefinition().withId(UUID.randomUUID()).withVersion(0.1).withSuspended(false);
    WorkflowDefinition changed =
        JsonUtils.deepCopy(original, WorkflowDefinition.class).withSuspended(true);
    WorkflowDefinition audited =
        JsonUtils.deepCopy(original, WorkflowDefinition.class)
            .withUpdatedAt(123L)
            .withUpdatedBy("admin");

    assertNotEquals(
        OntologyReview.workflowDigest(original), OntologyReview.workflowDigest(changed));
    assertEquals(OntologyReview.workflowDigest(original), OntologyReview.workflowDigest(audited));
  }

  private static OntologyRelease ontology() {
    return new OntologyRelease()
        .withId(UUID.randomUUID())
        .withName("Sales")
        .withFullyQualifiedName("Sales")
        .withVersion(0.1)
        .withDescription("Sales model")
        .withOntology(new EntityReference().withId(UUID.randomUUID()).withType("ontology"))
        .withOntologyIri(URI.create("https://example.org/sales"))
        .withUpdatedBy("author")
        .withEntityStatus(EntityStatus.DRAFT)
        .withReviewRevision(1L)
        .withReviewAuthor("author");
  }
}
