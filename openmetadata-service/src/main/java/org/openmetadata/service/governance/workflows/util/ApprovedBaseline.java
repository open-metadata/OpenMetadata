/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.governance.workflows.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.EntityStatusAdapter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Whether a stored version of an entity is one a reviewer accepted. */
@Slf4j
public final class ApprovedBaseline {
  private ApprovedBaseline() {}

  public static boolean isApprovedBaseline(EntityInterface<?> entity) {
    // A non-reviewer edit inherits Approved until its asynchronous workflow marks it In Review.
    // Only an actual approval event (or reviewer-authored change) is safe to restore later.
    boolean isApproved =
        EntityStatus.APPROVED
            .value()
            .equals(EntityStatusAdapter.forEntityType(entity.getClass()).read(entity));
    boolean hasDurableApproval =
        nullOrEmpty(entity.getReviewers())
            || recordsTransition(entity, EntityStatus.APPROVED)
            || wasUpdatedByReviewer(entity);
    return isApproved && hasDurableApproval;
  }

  static Optional<String> recordedDecision(EntityInterface<?> entity) {
    String status = entity.getEntityStatus() == null ? null : entity.getEntityStatus().toString();
    boolean approved =
        EntityStatus.APPROVED.value().equals(status)
            && (recordsTransition(entity, EntityStatus.APPROVED) || wasUpdatedByReviewer(entity));
    boolean rejected =
        EntityStatus.REJECTED.value().equals(status)
            && recordsTransition(entity, EntityStatus.REJECTED);
    return approved || rejected ? Optional.of(status) : Optional.empty();
  }

  private static boolean recordsTransition(EntityInterface<?> entity, EntityStatus status) {
    ChangeDescription change = entity.getIncrementalChangeDescription();
    if (change == null) {
      change = entity.getChangeDescription();
    }
    List<FieldChange> updatedFields = change == null ? List.of() : change.getFieldsUpdated();
    return !nullOrEmpty(updatedFields)
        && updatedFields.stream().anyMatch(changeField -> setsStatus(changeField, status));
  }

  private static boolean setsStatus(FieldChange change, EntityStatus status) {
    return Entity.FIELD_ENTITY_STATUS.equals(change.getName())
        && status.value().equals(String.valueOf(change.getNewValue()));
  }

  private static boolean wasUpdatedByReviewer(EntityInterface<?> entity) {
    List<EntityReference> reviewers = entity.getReviewers();
    String updatedBy = entity.getUpdatedBy();
    boolean isReviewer = false;
    if (!nullOrEmpty(reviewers) && !nullOrEmpty(updatedBy)) {
      isReviewer = reviewers.stream().anyMatch(reviewer -> matchesUser(reviewer, updatedBy));
      if (!isReviewer && reviewers.stream().anyMatch(ApprovedBaseline::isTeam)) {
        isReviewer = belongsToReviewerTeam(updatedBy, reviewers);
      }
    }
    return isReviewer;
  }

  private static boolean matchesUser(EntityReference reviewer, String user) {
    return Entity.USER.equals(reviewer.getType())
        && (user.equals(reviewer.getName()) || user.equals(reviewer.getFullyQualifiedName()));
  }

  private static boolean isTeam(EntityReference reviewer) {
    return Entity.TEAM.equals(reviewer.getType());
  }

  private static boolean belongsToReviewerTeam(String user, List<EntityReference> reviewers) {
    boolean isReviewer = false;
    try {
      isReviewer = SubjectContext.getSubjectContext(user).isReviewer(reviewers);
    } catch (EntityNotFoundException exception) {
      LOG.debug("[ApprovedBaseline] Historical reviewer '{}' no longer exists", user);
    }
    return isReviewer;
  }
}
