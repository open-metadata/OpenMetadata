package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ActivityStreamRepository;

/**
 * Tells the author of a review request, through the Inbox activity feed, that a reviewer approved
 * or rejected the release. The activity stream is the only feed the Inbox reads for non-task
 * updates, and the closed review task alone gives the author nothing to open.
 */
@Slf4j
public final class OntologyDecisionNotice {
  public static final String FIELD_NAME = "reviewDecision";
  private static final int MAX_REASON = 300;

  private OntologyDecisionNotice() {}

  public static ActivityEvent eventFor(
      final OntologyRelease release,
      final TaskResolutionType resolution,
      final EntityReference reviewer,
      final String comment,
      final long decidedAt) {
    final boolean approved = resolution == TaskResolutionType.Approved;
    final String version = describe(release);
    final String who =
        reviewer.getDisplayName() == null ? reviewer.getName() : reviewer.getDisplayName();
    final String reason = nullOrEmpty(comment) ? "" : ": " + truncate(comment);
    return new ActivityEvent()
        .withId(UUID.randomUUID())
        .withEventType(ActivityEventType.ENTITY_UPDATED)
        .withEntity(release.getEntityReference())
        .withActor(reviewer)
        .withTimestamp(decidedAt)
        .withFieldName(FIELD_NAME)
        .withNewValue(approved ? "Approved" : "Rejected")
        .withSummary(who + (approved ? " approved " : " rejected ") + version + reason);
  }

  /**
   * The release's name is a storage slug ("release-3") that reads like an identifier in a feed. A
   * release with no semantic version is named by its revision, which readers recognize as a counter.
   */
  private static String describe(final OntologyRelease release) {
    if (release.getSemanticVersion() != null) {
      return "v" + release.getSemanticVersion();
    }
    return release.getReleaseRevision() == null
        ? release.getName()
        : "release #" + release.getReleaseRevision();
  }

  /** The decision is already committed; a failed notice must not undo or hide it. */
  public static void publish(
      final OntologyRelease release,
      final TaskResolutionType resolution,
      final String reviewerName,
      final String comment,
      final long decidedAt) {
    try {
      final EntityReference reviewer =
          Entity.getEntityReferenceByName(Entity.USER, reviewerName, Include.NON_DELETED);
      new ActivityStreamRepository()
          .insert(eventFor(release, resolution, reviewer, comment, decidedAt));
    } catch (RuntimeException failure) {
      LOG.warn(
          "Could not record the {} notice for ontology release {}",
          resolution,
          release.getId(),
          failure);
    }
  }

  private static String truncate(final String comment) {
    return comment.length() <= MAX_REASON ? comment : comment.substring(0, MAX_REASON - 1) + "…";
  }
}
