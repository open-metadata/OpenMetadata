package org.openmetadata.service.ontology;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyReviewTarget;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

/** Content identity shared by ontology persistence and the existing approval-task lifecycle. */
public final class OntologyReview {
  private static final List<String> OPERATIONAL_FIELDS =
      List.of(
          "version",
          "updatedAt",
          "updatedBy",
          "impersonatedBy",
          "href",
          "changeDescription",
          "incrementalChangeDescription",
          "entityStatus",
          "reviewRevision",
          "reviewAuthor",
          "reviewTask",
          "owners",
          "reviewers",
          "superClasses",
          "subClasses");

  private OntologyReview() {}

  public static void initialize(final OntologyRelease entity) {
    entity.setEntityStatus(EntityStatus.DRAFT);
    entity.setReviewRevision(1L);
    entity.setReviewAuthor(entity.getUpdatedBy());
    entity.setReviewTask(null);
  }

  public static OntologyReviewTarget target(final OntologyRelease entity) {
    return new OntologyReviewTarget()
        .withEntityId(entity.getId())
        .withOntologyId(ontologyId(entity))
        .withEntityVersion(entity.getVersion())
        .withReviewRevision(entity.getReviewRevision())
        .withContentDigest(digest(entity))
        .withAuthor(entity.getReviewAuthor());
  }

  public static void requireIndependentReviewer(
      final OntologyRelease entity, final Task task, final String user) {
    if (Objects.equals(entity.getReviewAuthor(), user)
        || (task.getCreatedBy() != null && Objects.equals(task.getCreatedBy().getName(), user))) {
      throw new BadRequestException("Ontology approval requires an independent reviewer");
    }
  }

  public static void validateTarget(
      final OntologyRelease entity, final OntologyReviewTarget target) {
    if (target == null
        || target.getEntityVersion() == null
        || !Objects.equals(entity.getId(), target.getEntityId())
        || !Objects.equals(ontologyId(entity), target.getOntologyId())
        || !Objects.equals(entity.getReviewRevision(), target.getReviewRevision())
        || !Objects.equals(digest(entity), target.getContentDigest())) {
      throw new BadRequestException(
          "Ontology content changed; submit its current revision for review");
    }
  }

  public static String digest(final OntologyDefinition entity) {
    final ObjectNode content = JsonUtils.getObjectMapper().valueToTree(entity);
    content.remove(OPERATIONAL_FIELDS);
    if (content.get("ontology") instanceof ObjectNode reference) {
      reference.retain("id", "type");
    }
    return DigestUtils.sha256Hex("ontology-review-v2\n" + OntologyJson.canonical(content));
  }

  private static UUID ontologyId(final OntologyDefinition entity) {
    return entity.getOntology() == null ? entity.getId() : entity.getOntology().getId();
  }

  public static String workflowDigest(final WorkflowDefinition workflow) {
    final ObjectNode policy = JsonUtils.getObjectMapper().valueToTree(workflow);
    policy.retain("id", "trigger", "nodes", "edges", "config", "suspended");
    return DigestUtils.sha256Hex("ontology-workflow-v1\n" + OntologyJson.canonical(policy));
  }
}
