package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyReviewTarget;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;

/** Content identity shared by ontology persistence and the existing approval-task lifecycle. */
public final class OntologyReview {
  private OntologyReview() {}

  public static void initialize(final OntologyRelease entity) {
    entity.setEntityStatus(EntityStatus.DRAFT);
    entity.setReviewAuthor(entity.getUpdatedBy());
    entity.setReviewTask(null);
  }

  public static OntologyReviewTarget target(final OntologyRelease entity) {
    return new OntologyReviewTarget()
        .withEntityId(entity.getId())
        .withOntologyId(ontologyId(entity))
        .withEntityVersion(entity.getVersion())
        .withContentDigest(digest(entity))
        .withAuthor(entity.getReviewAuthor());
  }

  /**
   * The reviewer entries that can vote on this release: the author and the requester cannot, so
   * their own user entries are left out. A team entry stays, because its other members can vote.
   */
  public static List<EntityReference> eligibleReviewers(
      final OntologyRelease entity, final Task task) {
    final EntityReference requester = task.getCreatedBy();
    return listOrEmpty(entity.getReviewers()).stream()
        .filter(
            reviewer ->
                !Entity.USER.equals(reviewer.getType())
                    || (!Objects.equals(reviewer.getName(), entity.getReviewAuthor())
                        && !sameUser(reviewer, requester)))
        .toList();
  }

  private static boolean sameUser(final EntityReference reviewer, final EntityReference user) {
    return user != null
        && ((user.getId() != null && Objects.equals(reviewer.getId(), user.getId()))
            || (user.getName() != null && Objects.equals(reviewer.getName(), user.getName())));
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
        || !Objects.equals(digest(entity), target.getContentDigest())) {
      throw new BadRequestException(
          "Ontology content changed; submit its current revision for review");
    }
  }

  public static String digest(final OntologyDefinition entity) {
    if (entity instanceof OntologyRelease release) {
      final ObjectNode identity = JsonUtils.getObjectNode();
      identity.put("id", release.getId().toString());
      identity.put("releaseRevision", release.getReleaseRevision());
      identity.put("contentDigest", release.getContentDigest());
      return DigestUtils.sha256Hex("ontology-review-v3\n" + OntologyJson.canonical(identity));
    }
    return DigestUtils.sha256Hex(
        OntologyJson.canonical(OntologyReleaseContent.project(entity)).toString());
  }

  private static UUID ontologyId(final OntologyDefinition entity) {
    return entity.getOntology() == null ? entity.getId() : entity.getOntology().getId();
  }
}
