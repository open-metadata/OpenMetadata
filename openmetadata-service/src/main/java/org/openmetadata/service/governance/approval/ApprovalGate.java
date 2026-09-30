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
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.isBotChange;

import com.fasterxml.jackson.databind.JsonNode;
import io.micrometer.core.instrument.Timer;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
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
@Slf4j
public final class ApprovalGate {
  // Identity and lifecycle fields are carried with a held request but never gate one.
  private static final Set<String> STRUCTURAL_FIELDS =
      Set.of(
          Entity.FIELD_NAME,
          Entity.FIELD_FULLY_QUALIFIED_NAME,
          Entity.FIELD_DELETED,
          Entity.FIELD_ENTITY_STATUS);
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
  private static final String TAGS = Entity.FIELD_TAGS;
  private static final String EXTENSION = Entity.FIELD_EXTENSION;
  private static final String EXTENSION_PREFIX = EXTENSION + Entity.SEPARATOR;

  private ApprovalGate() {}

  public static Optional<StagedChange> admit(
      EntityInterface original, EntityInterface updated, String user, String impersonatedBy) {
    return evaluate(original, updated, user, impersonatedBy, true);
  }

  /** What {@link #admit} would decide for this edit, without recording metrics or shadow holds. */
  public static Optional<StagedChange> preview(
      EntityInterface original, EntityInterface updated, String user) {
    return evaluate(original, updated, user, null, false);
  }

  private static Optional<StagedChange> evaluate(
      EntityInterface original,
      EntityInterface updated,
      String user,
      String impersonatedBy,
      boolean record) {
    Optional<StagedChange> staged = Optional.empty();
    if (original != null && original.getId() != null && !isBotChange(user, impersonatedBy)) {
      staged = stageIfGated(original, updated, user, impersonatedBy, record);
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
    if (assets != null && !isBotChange(user, null)) {
      Set<UUID> gated = gatedAssetIds(assets, field);
      Iterator<EntityReference> candidates = assets.iterator();
      while (candidates.hasNext()) {
        EntityReference asset = candidates.next();
        if (gated.contains(asset.getId())) {
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

  // Assets are read once per entity type, and only for the types a workflow gates for this field.
  private static Set<UUID> gatedAssetIds(List<EntityReference> assets, String field) {
    Set<UUID> gated = new HashSet<>();
    Map<String, List<EntityReference>> byType =
        assets.stream().collect(Collectors.groupingBy(EntityReference::getType));
    byType.forEach(
        (type, refs) -> {
          List<GatingRule> rules =
              GovernanceApprovalRegistry.gatingRules(type).stream()
                  .filter(rule -> !rule.shadow())
                  .filter(
                      rule ->
                          WorkflowTriggerFilters.fieldTriggers(
                              type, field, rule.includedFields(), rule.excludedFields()))
                  .toList();
          if (!rules.isEmpty()) {
            List<EntityInterface> entities = Entity.getEntities(refs, "", Include.ALL);
            for (EntityInterface entity : entities) {
              if (rules.stream()
                  .anyMatch(
                      rule ->
                          !WorkflowTriggerFilters.matchesExclusionFilter(
                              rule.filterLogic(), entity))) {
                gated.add(entity.getId());
              }
            }
          }
        });
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

  private static Optional<StagedChange> stageIfGated(
      EntityInterface original,
      EntityInterface updated,
      String user,
      String impersonatedBy,
      boolean record) {
    String entityType = Entity.getEntityTypeFromObject(updated);
    List<GatingRule> rules = GovernanceApprovalRegistry.gatingRules(entityType);
    Optional<StagedChange> staged = Optional.empty();
    if (!rules.isEmpty()) {
      Timer.Sample sample = ChangeRequestMetrics.startAdmission();
      staged = planStage(rules, entityType, original, updated, user, impersonatedBy, record);
      if (record) {
        ChangeRequestMetrics.stopAdmission(sample, entityType);
      }
    }
    return staged;
  }

  private record GatedBy(GatingRule rule, Set<String> fields) {}

  private static Optional<StagedChange> planStage(
      List<GatingRule> rules,
      String entityType,
      EntityInterface original,
      EntityInterface updated,
      String user,
      String impersonatedBy,
      boolean record) {
    JsonNode base = JsonUtils.valueToTree(original);
    JsonNode proposed = JsonUtils.valueToTree(updated);
    Set<String> changed = changedFields(entityType, base, proposed);
    List<GatedBy> matched =
        gatingWorkflows(rules, entityType, updated, triggerNames(base, proposed, changed));
    // Shadow-mode workflows only record that they would have held the edit; the write publishes.
    List<GatedBy> gating = matched.stream().filter(g -> !g.rule().shadow()).toList();
    if (record) {
      matched.stream()
          .filter(g -> g.rule().shadow())
          .forEach(g -> recordShadowHold(g, entityType, original, user));
    }
    Optional<StagedChange> staged = Optional.empty();
    if (!gating.isEmpty()) {
      rejectAmbiguousReview(gating);
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

  private static void recordShadowHold(
      GatedBy gatedBy, String entityType, EntityInterface original, String user) {
    ChangeRequestMetrics.admission(entityType, true);
    LOG.info(
        "[ApprovalGate] Shadow mode: workflow {} would hold {} on {} {} by {}",
        gatedBy.rule().workflowName(),
        gatedBy.fields(),
        entityType,
        original.getFullyQualifiedName(),
        user);
  }

  private static List<GatedBy> gatingWorkflows(
      List<GatingRule> rules,
      String entityType,
      EntityInterface updated,
      Map<String, List<String>> changed) {
    List<GatedBy> gating = new ArrayList<>();
    for (GatingRule rule : rules) {
      Set<String> fields =
          WorkflowTriggerFilters.matchesExclusionFilter(rule.filterLogic(), updated)
              ? Set.of()
              : gatedFields(rule, entityType, changed);
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

  private static Set<String> changedFields(String entityType, JsonNode base, JsonNode proposed) {
    Set<String> names = new TreeSet<>();
    base.fieldNames().forEachRemaining(names::add);
    proposed.fieldNames().forEachRemaining(names::add);
    names.removeAll(BOOKKEEPING_FIELDS);
    names.removeIf(name -> !isChange(entityType, name, base.get(name), proposed.get(name)));
    return names;
  }

  // An absent/null proposed value is a change only when it clears a scalar of a stageable field;
  // an omitted collection is merged, not removed, by PUT.
  private static boolean isChange(
      String entityType, String field, JsonNode oldValue, JsonNode newValue) {
    boolean cleared = newValue == null || newValue.isNull();
    boolean clearsScalar =
        cleared
            && oldValue != null
            && oldValue.isValueNode()
            && !oldValue.isNull()
            && isStageable(entityType, field);
    return clearsScalar || (!cleared && MutationPlanner.differs(oldValue, newValue));
  }

  // Custom properties trigger per property ("extension.<name>"), matching the names the change
  // description records for them; every other field triggers under its own name.
  private static Map<String, List<String>> triggerNames(
      JsonNode base, JsonNode proposed, Set<String> changed) {
    Map<String, List<String>> names = new HashMap<>();
    for (String field : changed) {
      names.put(
          field,
          EXTENSION.equals(field)
              ? changedProperties(base.path(EXTENSION), proposed.path(EXTENSION))
              : List.of(field));
    }
    return names;
  }

  private static List<String> changedProperties(JsonNode base, JsonNode proposed) {
    Set<String> keys = new TreeSet<>();
    base.fieldNames().forEachRemaining(keys::add);
    proposed.fieldNames().forEachRemaining(keys::add);
    List<String> names = new ArrayList<>();
    for (String key : keys) {
      if (MutationPlanner.differs(base.get(key), proposed.get(key))) {
        names.add(EXTENSION_PREFIX + key);
      }
    }
    return names;
  }

  // A field can gate when it is one of the entity type's trigger fields other than identity and
  // lifecycle fields.
  private static boolean isStageable(String entityType, String field) {
    return !STRUCTURAL_FIELDS.contains(field)
        && WorkflowTriggerFilters.isTriggerField(entityType, field);
  }

  private static Set<String> gatedFields(
      GatingRule rule, String entityType, Map<String, List<String>> changed) {
    Set<String> gated = new HashSet<>();
    changed.forEach(
        (field, names) -> {
          boolean triggers =
              names.stream()
                  .anyMatch(
                      name ->
                          WorkflowTriggerFilters.fieldTriggers(
                              entityType, name, rule.includedFields(), rule.excludedFields()));
          if (isStageable(entityType, field) && triggers) {
            gated.add(field);
          }
        });
    return gated;
  }

  private static void rejectMutuallyExclusiveTags(EntityInterface updated, Set<String> changed) {
    if (changed.contains(TAGS)) {
      TagLabelUtil.checkMutuallyExclusive(updated.getTags());
    }
  }
}
