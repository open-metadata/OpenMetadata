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

package org.openmetadata.service.governance.approval;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.WorkflowTriggerFields;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.GovernanceApprovalRegistry.GatingRule;
import org.openmetadata.service.governance.workflows.elements.triggers.WorkflowTriggerFilters;
import org.openmetadata.service.resources.tags.TagLabelUtil;

/**
 * Admission for approval-gated edits. A human request that changes a gated field is diverted, whole,
 * into a change request and nothing is published; a request touching only ungated fields, or made by
 * a bot on its own behalf, proceeds as a normal write. Impersonated requests are gated as the human.
 */
public final class ApprovalGate {
  private static final Set<String> STRUCTURAL_FIELDS =
      Set.of(
          WorkflowTriggerFields.NAME.value(),
          WorkflowTriggerFields.FULLY_QUALIFIED_NAME.value(),
          WorkflowTriggerFields.DELETED.value(),
          WorkflowTriggerFields.ENTITY_STATUS.value());
  private static final Set<String> STAGEABLE_FIELDS =
      Arrays.stream(WorkflowTriggerFields.values())
          .map(WorkflowTriggerFields::value)
          .filter(field -> !STRUCTURAL_FIELDS.contains(field))
          .collect(Collectors.toUnmodifiableSet());
  private static final Set<String> BOOKKEEPING_FIELDS =
      Set.of(
          "version",
          "updatedAt",
          "updatedBy",
          "impersonatedBy",
          "href",
          "changeDescription",
          "incrementalChangeDescription",
          "changeSummary");
  private static final String TAGS = WorkflowTriggerFields.TAGS.value();

  private ApprovalGate() {}

  public static Optional<StagedChange> admit(
      EntityInterface original, EntityInterface updated, String user, String impersonatedBy) {
    Optional<StagedChange> staged = Optional.empty();
    if (original != null && original.getId() != null && !isExemptActor(user, impersonatedBy)) {
      staged = stageIfGated(original, updated, user, impersonatedBy);
    }
    return staged;
  }

  public static void verifyApproved(ApprovedApplication approval, EntityInterface original) {
    ChangeRequest request =
        ChangeRequestService.dao().changeRequestDAO().findById(approval.changeRequestId());
    boolean approved =
        request != null
            && request.getStatus() == ChangeRequestStatus.APPROVED
            && approval.revisionId().equals(request.getActiveRevisionId())
            && original.getId().equals(request.getEntityId());
    if (!approved) {
      throw new IllegalStateException(
          "Change request %s is not an approved revision of %s"
              .formatted(approval.changeRequestId(), original.getId()));
    }
  }

  /**
   * Bulk relationship writes (add/remove a tag, glossary term, domain or data product on many
   * assets) cannot be staged per asset, so an asset whose {@code field} a workflow gates for this
   * human actor is removed from {@code assets} and returned as a refused item. Editing the asset
   * itself submits the change for approval.
   */
  public static List<BulkResponse> refuseGatedAssets(
      List<EntityReference> assets, String field, String user) {
    List<BulkResponse> refused = new ArrayList<>();
    if (assets != null && !isExemptActor(user, null)) {
      Iterator<EntityReference> candidates = assets.iterator();
      while (candidates.hasNext()) {
        EntityReference asset = candidates.next();
        if (gatesField(asset, field)) {
          candidates.remove();
          refused.add(refusal(asset, field));
        }
      }
    }
    return refused;
  }

  /** Folds refused assets into a bulk result as failed items. */
  public static BulkOperationResult withRefused(
      BulkOperationResult result, List<BulkResponse> refused) {
    if (!refused.isEmpty()) {
      List<BulkResponse> failed = new ArrayList<>(listOrEmpty(result.getFailedRequest()));
      failed.addAll(refused);
      boolean anySucceeded = !listOrEmpty(result.getSuccessRequest()).isEmpty();
      result
          .withFailedRequest(failed)
          .withNumberOfRowsFailed(orZero(result.getNumberOfRowsFailed()) + refused.size())
          .withNumberOfRowsProcessed(orZero(result.getNumberOfRowsProcessed()) + refused.size())
          .withStatus(anySucceeded ? ApiStatus.PARTIAL_SUCCESS : ApiStatus.FAILURE);
    }
    return result;
  }

  private static boolean gatesField(EntityReference asset, String field) {
    List<GatingRule> rules =
        GovernanceApprovalRegistry.gatingRules(asset.getType()).stream()
            .filter(
                rule ->
                    WorkflowTriggerFilters.fieldTriggers(
                        field, rule.includedFields(), rule.excludedFields()))
            .toList();
    boolean gated = false;
    if (!rules.isEmpty()) {
      EntityInterface entity = Entity.getEntity(asset, "", Include.ALL);
      gated =
          rules.stream()
              .anyMatch(
                  rule ->
                      !WorkflowTriggerFilters.matchesExclusionFilter(rule.filterLogic(), entity));
    }
    return gated;
  }

  private static BulkResponse refusal(EntityReference asset, String field) {
    return new BulkResponse()
        .withRequest(asset)
        .withStatus(Response.Status.FORBIDDEN.getStatusCode())
        .withMessage(
            "Changing %s on %s requires approval; edit the asset to submit the change for review"
                .formatted(field, asset.getFullyQualifiedName()));
  }

  private static int orZero(Integer value) {
    return value == null ? 0 : value;
  }

  // Workflow automation writes as the acting user with governance-bot as impersonator, and a bot on
  // its own behalf writes as itself; both publish as they would without approval workflows. Any
  // other impersonation is a bot acting for a user and is gated as that user.
  private static boolean isExemptActor(String user, String impersonatedBy) {
    boolean exempt = GOVERNANCE_BOT.equals(impersonatedBy);
    if (!exempt && impersonatedBy == null) {
      User actor = Entity.findByNameOrNull(Entity.USER, user, Include.NON_DELETED);
      exempt = actor != null && Boolean.TRUE.equals(actor.getIsBot());
    }
    return exempt;
  }

  private static Optional<StagedChange> stageIfGated(
      EntityInterface original, EntityInterface updated, String user, String impersonatedBy) {
    String entityType = Entity.getEntityTypeFromObject(updated);
    List<GatingRule> rules = GovernanceApprovalRegistry.gatingRules(entityType);
    return rules.isEmpty()
        ? Optional.empty()
        : planStage(rules, entityType, original, updated, user, impersonatedBy);
  }

  private record GatedBy(GatingRule rule, Set<String> fields) {}

  private static Optional<StagedChange> planStage(
      List<GatingRule> rules,
      String entityType,
      EntityInterface original,
      EntityInterface updated,
      String user,
      String impersonatedBy) {
    JsonNode base = JsonUtils.valueToTree(original);
    JsonNode proposed = JsonUtils.valueToTree(updated);
    Set<String> changed = changedFields(base, proposed);
    List<GatedBy> gating = gatingWorkflows(rules, updated, changed);
    Optional<StagedChange> staged = Optional.empty();
    if (!gating.isEmpty()) {
      rejectAmbiguousReview(gating);
      rejectUnstageable(changed);
      rejectMutuallyExclusiveTags(updated, changed);
      GatedBy review = gating.get(0);
      staged =
          Optional.of(
              new StagedChange(
                  entityType,
                  original.getId(),
                  original.getFullyQualifiedName(),
                  original.getVersion(),
                  user,
                  impersonatedBy,
                  review.rule().workflowDefinitionId(),
                  MutationPlanner.plan(base, proposed, changed, review.fields())));
    }
    return staged;
  }

  private static List<GatedBy> gatingWorkflows(
      List<GatingRule> rules, EntityInterface updated, Set<String> changed) {
    List<GatedBy> gating = new ArrayList<>();
    for (GatingRule rule : rules) {
      Set<String> fields =
          WorkflowTriggerFilters.matchesExclusionFilter(rule.filterLogic(), updated)
              ? Set.of()
              : gatedFields(rule, changed);
      if (!fields.isEmpty()) {
        gating.add(new GatedBy(rule, fields));
      }
    }
    return gating;
  }

  private static void rejectAmbiguousReview(List<GatedBy> gating) {
    if (gating.size() > 1) {
      List<String> owners =
          gating.stream()
              .map(g -> "%s: %s".formatted(g.rule().workflowName(), g.fields()))
              .toList();
      throw new BadRequestException(
          "This change touches fields governed by different approval workflows %s; submit them separately"
              .formatted(owners));
    }
  }

  private static Set<String> changedFields(JsonNode base, JsonNode proposed) {
    Set<String> names = new TreeSet<>();
    base.fieldNames().forEachRemaining(names::add);
    proposed.fieldNames().forEachRemaining(names::add);
    names.removeAll(BOOKKEEPING_FIELDS);
    names.removeIf(name -> !isChange(name, base.get(name), proposed.get(name)));
    return names;
  }

  // An absent/null proposed value is a change only when it clears a scalar of a stageable field;
  // an omitted collection is merged, not removed, by PUT.
  private static boolean isChange(String field, JsonNode oldValue, JsonNode newValue) {
    boolean cleared = newValue == null || newValue.isNull();
    boolean clearsScalar =
        cleared
            && oldValue != null
            && oldValue.isValueNode()
            && !oldValue.isNull()
            && STAGEABLE_FIELDS.contains(field);
    return clearsScalar || (!cleared && MutationPlanner.differs(oldValue, newValue));
  }

  private static Set<String> gatedFields(GatingRule rule, Set<String> changed) {
    Set<String> gated = new HashSet<>();
    for (String field : changed) {
      if (STAGEABLE_FIELDS.contains(field)
          && WorkflowTriggerFilters.fieldTriggers(
              field, rule.includedFields(), rule.excludedFields())) {
        gated.add(field);
      }
    }
    return gated;
  }

  private static void rejectUnstageable(Set<String> changed) {
    Set<String> unstageable = new TreeSet<>(changed);
    unstageable.removeAll(STAGEABLE_FIELDS);
    if (!unstageable.isEmpty()) {
      throw new BadRequestException(
          "Fields %s cannot be submitted together with a change that requires approval; submit them separately"
              .formatted(unstageable));
    }
  }

  private static void rejectMutuallyExclusiveTags(EntityInterface updated, Set<String> changed) {
    if (changed.contains(TAGS)) {
      TagLabelUtil.checkMutuallyExclusive(updated.getTags());
    }
  }
}
