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
package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;

import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler.InputNamespaces;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class RollbackEntityImpl implements JavaDelegate {
  private static final String GOVERNANCE_BOT = "governance-bot";
  private static final String ROLLBACK_ACTION_VARIABLE = "rollbackAction";
  private static final String ROLLBACK_FROM_VERSION_VARIABLE = "rollbackFromVersion";
  private static final String ROLLBACK_TO_VERSION_VARIABLE = "rollbackToVersion";
  private static final String ROLLBACK_ENTITY_ID_VARIABLE = "rollbackEntityId";
  private static final String ROLLBACK_ENTITY_TYPE_VARIABLE = "rollbackEntityType";
  private static final String ROLLBACK_ACTION = "rollback";
  private static final String REJECT_ACTION = "reject";

  private Expression inputNamespaceMapExpr;

  @Deprecated
  @SuppressWarnings("unused")
  private Expression rollbackToStatus;

  @Override
  public void execute(DelegateExecution execution) {
    try {
      RollbackContext context = createContext(execution);
      RejectionOutcome outcome =
          applyRejection(context.repository(), context.currentEntity(), context.updatedBy());
      setOutcomeVariables(execution, context, outcome);
    } catch (RuntimeException exception) {
      LOG.error("[RollbackEntity] Entity rejection failed", exception);
      throw new IllegalStateException(
          "Failed to reject entity through rollback workflow", exception);
    }
  }

  RejectionOutcome applyRejection(
      EntityRepository<?> repository, EntityInterface currentEntity, String updatedBy) {
    Optional<ApprovedVersion> approvedVersion =
        findMostRecentApprovedVersion(currentEntity, repository);
    RejectionOutcome outcome;
    if (approvedVersion.isPresent()) {
      ApprovedVersion approved = approvedVersion.get();
      restoreToApprovedVersion(repository, currentEntity, approved.entity(), updatedBy);
      outcome = RejectionOutcome.rolledBack(currentEntity.getVersion(), approved.version());
    } else {
      rejectCurrentVersion(repository, currentEntity, updatedBy);
      outcome = RejectionOutcome.rejected(currentEntity.getVersion());
    }
    return outcome;
  }

  Optional<ApprovedVersion> findMostRecentApprovedVersion(
      EntityInterface currentEntity, EntityRepository<?> repository) {
    List<Double> earlierVersions = earlierVersions(currentEntity, repository);
    Optional<ApprovedVersion> approvedVersion = Optional.empty();
    for (Double version : earlierVersions) {
      EntityInterface versionEntity =
          repository.getVersion(currentEntity.getId(), version.toString());
      if (isApprovedBaseline(versionEntity)) {
        approvedVersion = Optional.of(new ApprovedVersion(version, versionEntity));
        break;
      }
    }
    return approvedVersion;
  }

  private RollbackContext createContext(DelegateExecution execution) {
    WorkflowVariableHandler variableHandler = new WorkflowVariableHandler(execution);
    InputNamespaces namespaces = InputNamespaces.from(inputNamespaceMapExpr, execution);
    MessageParser.EntityLink entityLink = relatedEntityLink(variableHandler, namespaces);
    EntityInterface entity = variableHandler.getRelatedEntity(entityLink, "", Include.ALL);
    String updatedBy = updatedBy(variableHandler, namespaces);
    String entityType = entityLink.getEntityType();
    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    return new RollbackContext(entity, repository, entityType, updatedBy);
  }

  private MessageParser.EntityLink relatedEntityLink(
      WorkflowVariableHandler variableHandler, InputNamespaces namespaces) {
    String namespace = namespaces.namespaceFor(RELATED_ENTITY_VARIABLE);
    String value =
        (String) variableHandler.getNamespacedVariable(namespace, RELATED_ENTITY_VARIABLE);
    return MessageParser.EntityLink.parse(value);
  }

  private String updatedBy(WorkflowVariableHandler variableHandler, InputNamespaces namespaces) {
    String namespace = namespaces.namespaceFor(UPDATED_BY_VARIABLE);
    String user = (String) variableHandler.getNamespacedVariable(namespace, UPDATED_BY_VARIABLE);
    return nullOrEmpty(user) ? GOVERNANCE_BOT : user;
  }

  private List<Double> earlierVersions(
      EntityInterface currentEntity, EntityRepository<?> repository) {
    EntityHistory history = repository.listVersions(currentEntity.getId());
    List<Double> versions = new ArrayList<>();
    for (Object serializedVersion : history.getVersions()) {
      parsedVersion(serializedVersion, currentEntity)
          .filter(version -> version < currentEntity.getVersion())
          .ifPresent(versions::add);
    }
    versions.sort(Comparator.reverseOrder());
    return versions;
  }

  private Optional<Double> parsedVersion(Object serializedVersion, EntityInterface currentEntity) {
    Optional<Double> version;
    try {
      String json =
          serializedVersion instanceof String serialized
              ? serialized
              : JsonUtils.pojoToJson(serializedVersion);
      EntityInterface entity = JsonUtils.readValue(json, currentEntity.getClass());
      version = Optional.ofNullable(entity.getVersion());
    } catch (RuntimeException exception) {
      LOG.warn("[RollbackEntity] Ignoring an unreadable entity version", exception);
      version = Optional.empty();
    }
    return version;
  }

  private boolean isApprovedBaseline(EntityInterface entity) {
    // A non-reviewer edit inherits Approved until its asynchronous workflow marks it In Review.
    // Only an actual approval event (or reviewer-authored change) is safe to restore later.
    boolean isApproved = entity.getEntityStatus() == EntityStatus.APPROVED;
    boolean hasDurableApproval =
        nullOrEmpty(entity.getReviewers())
            || recordsApprovalTransition(entity)
            || wasUpdatedByReviewer(entity);
    return isApproved && hasDurableApproval;
  }

  private boolean recordsApprovalTransition(EntityInterface entity) {
    ChangeDescription change = entity.getIncrementalChangeDescription();
    if (change == null) {
      change = entity.getChangeDescription();
    }
    List<FieldChange> updatedFields = change == null ? List.of() : change.getFieldsUpdated();
    return !nullOrEmpty(updatedFields) && updatedFields.stream().anyMatch(this::setsApprovedStatus);
  }

  private boolean setsApprovedStatus(FieldChange change) {
    return Entity.FIELD_ENTITY_STATUS.equals(change.getName())
        && EntityStatus.APPROVED.value().equals(String.valueOf(change.getNewValue()));
  }

  private boolean wasUpdatedByReviewer(EntityInterface entity) {
    List<EntityReference> reviewers = entity.getReviewers();
    String updatedBy = entity.getUpdatedBy();
    boolean isReviewer = false;
    if (!nullOrEmpty(reviewers) && !nullOrEmpty(updatedBy)) {
      isReviewer = reviewers.stream().anyMatch(reviewer -> matchesUser(reviewer, updatedBy));
      if (!isReviewer && reviewers.stream().anyMatch(this::isTeam)) {
        isReviewer = belongsToReviewerTeam(updatedBy, reviewers);
      }
    }
    return isReviewer;
  }

  private boolean matchesUser(EntityReference reviewer, String user) {
    return Entity.USER.equals(reviewer.getType())
        && (user.equals(reviewer.getName()) || user.equals(reviewer.getFullyQualifiedName()));
  }

  private boolean isTeam(EntityReference reviewer) {
    return Entity.TEAM.equals(reviewer.getType());
  }

  private boolean belongsToReviewerTeam(String user, List<EntityReference> reviewers) {
    boolean isReviewer = false;
    try {
      isReviewer = SubjectContext.getSubjectContext(user).isReviewer(reviewers);
    } catch (EntityNotFoundException exception) {
      LOG.debug("[RollbackEntity] Historical reviewer '{}' no longer exists", user);
    }
    return isReviewer;
  }

  private void restoreToApprovedVersion(
      EntityRepository<?> repository,
      EntityInterface currentEntity,
      EntityInterface approvedEntity,
      String updatedBy) {
    EntityInterface persistedCurrent = persistedCurrentVersion(repository, currentEntity);
    applyPatch(repository, persistedCurrent, approvedEntity, updatedBy);
  }

  private void rejectCurrentVersion(
      EntityRepository<?> repository, EntityInterface currentEntity, String updatedBy) {
    EntityInterface persistedCurrent = persistedCurrentVersion(repository, currentEntity);
    String currentJson = JsonUtils.pojoToJson(persistedCurrent);
    EntityInterface rejectedEntity = JsonUtils.readValue(currentJson, persistedCurrent.getClass());
    setRejectedStatus(rejectedEntity);
    applyPatch(repository, persistedCurrent, rejectedEntity, updatedBy);
  }

  private EntityInterface persistedCurrentVersion(
      EntityRepository<?> repository, EntityInterface currentEntity) {
    return repository.getVersion(currentEntity.getId(), currentEntity.getVersion().toString());
  }

  private void setRejectedStatus(EntityInterface entity) {
    entity.setEntityStatus(EntityStatus.REJECTED);
    if (entity.getEntityStatus() != EntityStatus.REJECTED) {
      throw new IllegalStateException("Entity does not support a rejected approval status");
    }
  }

  private void applyPatch(
      EntityRepository<?> repository,
      EntityInterface currentEntity,
      EntityInterface targetEntity,
      String updatedBy) {
    JsonPatch patch =
        JsonUtils.getJsonPatch(
            JsonUtils.pojoToJson(currentEntity), JsonUtils.pojoToJson(targetEntity));
    repository.patch(null, currentEntity.getFullyQualifiedName(), updatedBy, patch);
  }

  private void setOutcomeVariables(
      DelegateExecution execution, RollbackContext context, RejectionOutcome outcome) {
    execution.setVariable(ROLLBACK_ACTION_VARIABLE, outcome.action());
    execution.setVariable(ROLLBACK_FROM_VERSION_VARIABLE, outcome.fromVersion());
    if (outcome.toVersion() != null) {
      execution.setVariable(ROLLBACK_TO_VERSION_VARIABLE, outcome.toVersion());
    }
    execution.setVariable(ROLLBACK_ENTITY_ID_VARIABLE, context.currentEntity().getId().toString());
    execution.setVariable(ROLLBACK_ENTITY_TYPE_VARIABLE, context.entityType());
  }

  record ApprovedVersion(Double version, EntityInterface entity) {}

  record RejectionOutcome(String action, Double fromVersion, Double toVersion) {
    private static RejectionOutcome rolledBack(Double fromVersion, Double toVersion) {
      return new RejectionOutcome(ROLLBACK_ACTION, fromVersion, toVersion);
    }

    private static RejectionOutcome rejected(Double fromVersion) {
      return new RejectionOutcome(REJECT_ACTION, fromVersion, null);
    }
  }

  private record RollbackContext(
      EntityInterface currentEntity,
      EntityRepository<?> repository,
      String entityType,
      String updatedBy) {}
}
