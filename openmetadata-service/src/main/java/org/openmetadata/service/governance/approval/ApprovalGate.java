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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.isBotChange;

import com.fasterxml.jackson.databind.JsonNode;
import io.micrometer.core.instrument.Timer;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.WebApplicationException;
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
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.EntityStatusAdapter;
import org.openmetadata.service.governance.approval.GovernanceApprovalRegistry.GatingRule;
import org.openmetadata.service.governance.workflows.elements.triggers.WorkflowTriggerFilters;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

/**
 * Admission for approval-gated edits. A human request that changes a gated field is diverted, whole,
 * into a change request and nothing is published; a request touching only ungated fields, or made by
 * a bot on its own behalf, proceeds as a normal write. Impersonated requests are gated as the human.
 */
@Slf4j
public final class ApprovalGate {
  // Identity fields are carried with a held request but never gate one. A stage change gates like
  // any other field, so moving a held asset to another stage waits for approval.
  private static final Set<String> STRUCTURAL_FIELDS =
      Set.of(Entity.FIELD_NAME, Entity.FIELD_FULLY_QUALIFIED_NAME, Entity.FIELD_DELETED);
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
  public static final String PENDING_APPROVAL = "Pending approval";
  private static final String EXTENSION = Entity.FIELD_EXTENSION;
  private static final String EXTENSION_PREFIX = EXTENSION + Entity.SEPARATOR;
  private static final Set<String> REPLACED_BY_IMPORT_UPDATE =
      Set.of(Entity.FIELD_TAGS, Entity.FIELD_OWNERS, Entity.FIELD_DOMAINS);

  private ApprovalGate() {}

  /**
   * How a write treats what its request leaves out, so a held edit stages what the write itself
   * would publish. A null or absent value clears a stored scalar under every write, and clears a
   * stored list or object only in a field the write replaces.
   */
  public record Edit(Kind kind, Set<String> patchedFields, boolean overrideMetadata) {
    public enum Kind {
      PUT,
      PATCH,
      IMPORT_UPDATE,
      IMPORT_ROW
    }

    /**
     * A human PUT adds the tags it sends to the stored ones, keeps the owners and domains it sends
     * empty, and replaces the rest of the entity's row and the relationships its repository names.
     */
    public static Edit put() {
      return new Edit(Kind.PUT, Set.of(), false);
    }

    /** A bulk upsert is a PUT; with {@code overrideMetadata} it replaces the tags it sends. */
    public static Edit bulkPut(boolean overrideMetadata) {
      return new Edit(Kind.PUT, Set.of(), overrideMetadata);
    }

    /** A PATCH replaces each top-level field its operations target. */
    public static Edit patch(Set<String> patchedFields) {
      return new Edit(Kind.PATCH, Set.copyOf(patchedFields), false);
    }

    /** An import of one entity replaces what a PUT does, and its tags, owners and domains too. */
    public static Edit importUpdate() {
      return new Edit(Kind.IMPORT_UPDATE, Set.of(), false);
    }

    /** A CSV row replaces the entity's row, extension and the relationships the import clears. */
    public static Edit importRow() {
      return new Edit(Kind.IMPORT_ROW, Set.of(), false);
    }
  }

  public static Optional<StagedChange> admit(
      EntityInterface original,
      EntityInterface updated,
      String user,
      String impersonatedBy,
      Edit edit) {
    return evaluate(original, updated, user, impersonatedBy, edit, true);
  }

  /** Whether an edit of {@code entityType} by {@code user} can be held at all. */
  public static boolean mayHold(String entityType, String user) {
    return !GovernanceApprovalRegistry.gatingRules(entityType).isEmpty()
        && !isBotChange(user, null);
  }

  /** What {@link #admit} would decide for this edit, without recording metrics. */
  public static Optional<StagedChange> preview(
      EntityInterface original, EntityInterface updated, String user, Edit edit) {
    return evaluate(original, updated, user, null, edit, false);
  }

  private static Optional<StagedChange> evaluate(
      EntityInterface original,
      EntityInterface updated,
      String user,
      String impersonatedBy,
      Edit edit,
      boolean record) {
    Optional<StagedChange> staged = Optional.empty();
    if (original != null && original.getId() != null) {
      staged = stageIfGated(original, updated, user, impersonatedBy, edit, record);
    }
    return staged;
  }

  public static void verifyApproved(ApprovedApplication approval, EntityInterface original) {
    ChangeRequest request =
        ChangeRequestService.dao().changeRequestDAO().findById(approval.changeRequestId());
    boolean approved =
        request != null
            && approval.revisionId().equals(request.getActiveRevisionId())
            && original.getId().equals(request.getEntityId())
            && (request.getStatus() == ChangeRequestStatus.APPROVED || hasAgreedChanges(request));
    if (!approved) {
      throw new IllegalStateException(
          "Change request %s is not an approved revision of %s"
              .formatted(approval.changeRequestId(), original.getId()));
    }
  }

  // A request decided change by change stays Pending while its reviewers agree on part of it; the
  // changes they agreed on and not yet published authorize this write.
  private static boolean hasAgreedChanges(ChangeRequest request) {
    return request.getStatus() == ChangeRequestStatus.PENDING
        && ChangeSelection.partialDecisions(request.getReviewPolicy())
        && !ChangeApplyService.selection(request, ChangeRequestService.activeRevision(request))
            .toApply()
            .isEmpty();
  }

  /** One asset's part of a bulk relationship write, e.g. adding a domain or a tag to it. */
  @FunctionalInterface
  public interface AssetEdit {
    void apply(EntityInterface asset);
  }

  /**
   * Bulk relationship writes (add/remove a tag, glossary term, domain or data product on many
   * assets) hold every asset whose {@code field} a workflow gates for this human actor: the edit of
   * that asset becomes its own change request, the asset is removed from {@code assets} so the bulk
   * write skips it, and it is returned as a pending item. A dry run reports the assets that would be
   * held without submitting anything. An asset whose edit cannot be submitted is returned as a
   * failed item.
   */
  public static List<BulkResponse> holdGatedAssets(
      List<EntityReference> assets, String field, String user, boolean dryRun, AssetEdit edit) {
    List<BulkResponse> held = new ArrayList<>();
    if (assets != null && !assets.isEmpty()) {
      Map<UUID, EntityInterface> gated = gatedAssets(assets, field, user);
      Iterator<EntityReference> candidates = assets.iterator();
      while (candidates.hasNext()) {
        EntityReference asset = candidates.next();
        EntityInterface original = gated.get(asset.getId());
        if (original != null) {
          Optional<BulkResponse> item = hold(asset, original, field, user, dryRun, edit);
          if (item.isPresent()) {
            candidates.remove();
            held.add(item.get());
          }
        }
      }
    }
    return held;
  }

  private static Optional<BulkResponse> hold(
      EntityReference asset,
      EntityInterface original,
      String field,
      String user,
      boolean dryRun,
      AssetEdit edit) {
    Optional<BulkResponse> item;
    try {
      if (Boolean.TRUE.equals(original.getDeleted())) {
        throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityNotFound(asset.getType(), asset.getId()));
      }
      EntityInterface updated = JsonUtils.deepCopy(original, original.getClass());
      edit.apply(updated);
      Edit write = Edit.patch(Set.of(field));
      Optional<StagedChange> staged =
          dryRun
              ? preview(original, updated, user, write)
              : admit(original, updated, user, null, write);
      item =
          staged.map(
              change ->
                  pendingItem(asset, dryRun ? null : ChangeRequestService.submit(change).getId()));
    } catch (WebApplicationException e) {
      item =
          Optional.of(
              new BulkResponse()
                  .withRequest(asset)
                  .withStatus(e.getResponse().getStatus())
                  .withMessage(e.getMessage()));
    }
    return item;
  }

  /** {@code refs} with {@code ref} added, unless an entry with its id is already there. */
  public static List<EntityReference> withReference(
      List<EntityReference> refs, EntityReference ref) {
    List<EntityReference> result = new ArrayList<>(listOrEmpty(refs));
    if (result.stream().noneMatch(r -> ref.getId().equals(r.getId()))) {
      result.add(ref);
    }
    return result;
  }

  /** {@code refs} without the entry whose id is {@code id}. */
  public static List<EntityReference> withoutReference(List<EntityReference> refs, UUID id) {
    return listOrEmpty(refs).stream().filter(r -> !id.equals(r.getId())).toList();
  }

  /** {@code tags} with {@code label} added, unless a label with its FQN is already there. */
  public static List<TagLabel> withTag(List<TagLabel> tags, TagLabel label) {
    List<TagLabel> result = new ArrayList<>(listOrEmpty(tags));
    if (result.stream().noneMatch(t -> label.getTagFQN().equals(t.getTagFQN()))) {
      result.add(label);
    }
    return result;
  }

  /** {@code tags} without the label whose FQN is {@code tagFqn}. */
  public static List<TagLabel> withoutTag(List<TagLabel> tags, String tagFqn) {
    return listOrEmpty(tags).stream().filter(t -> !tagFqn.equals(t.getTagFQN())).toList();
  }

  private static BulkResponse pendingItem(EntityReference asset, UUID changeRequestId) {
    return new BulkResponse()
        .withRequest(asset)
        .withStatus(Response.Status.OK.getStatusCode())
        .withMessage(
            changeRequestId == null
                ? PENDING_APPROVAL
                : "%s: change request %s".formatted(PENDING_APPROVAL, changeRequestId));
  }

  /**
   * Folds held assets into a bulk result: pending items count as successful and pending approval,
   * and any asset whose edit could not be submitted counts as failed.
   */
  public static BulkOperationResult withHeld(BulkOperationResult result, List<BulkResponse> held) {
    if (!held.isEmpty()) {
      List<BulkResponse> pending =
          held.stream().filter(r -> r.getStatus() == Response.Status.OK.getStatusCode()).toList();
      List<BulkResponse> notHeld =
          held.stream().filter(r -> r.getStatus() != Response.Status.OK.getStatusCode()).toList();
      // With every asset held the bulk write ran on nothing and may report a placeholder item.
      List<BulkResponse> succeeded = new ArrayList<>();
      listOrEmpty(result.getSuccessRequest()).stream()
          .filter(r -> r.getRequest() != null)
          .forEach(succeeded::add);
      succeeded.addAll(pending);
      List<BulkResponse> failed = new ArrayList<>(listOrEmpty(result.getFailedRequest()));
      failed.addAll(notHeld);
      result
          .withSuccessRequest(succeeded)
          .withFailedRequest(failed)
          .withNumberOfRowsProcessed(orZero(result.getNumberOfRowsProcessed()) + held.size())
          .withNumberOfRowsPassed(orZero(result.getNumberOfRowsPassed()) + pending.size())
          .withNumberOfRowsFailed(orZero(result.getNumberOfRowsFailed()) + notHeld.size())
          .withNumberOfRowsPendingApproval(
              orZero(result.getNumberOfRowsPendingApproval()) + pending.size())
          .withStatus(bulkStatus(result.getStatus(), succeeded, failed));
    }
    return result;
  }

  /**
   * Answers a bulk asset write. It is 202 when assets were held for approval and none was applied,
   * and 200 otherwise; when any change request was submitted, the {@link
   * RestUtil#PENDING_CHANGE_COUNT_HEADER} header carries how many. A dry run submits nothing.
   */
  public static Response bulkResponse(BulkOperationResult result, boolean dryRun) {
    int pending = dryRun ? 0 : orZero(result.getNumberOfRowsPendingApproval());
    int applied =
        listOrEmpty(result.getSuccessRequest()).size()
            - orZero(result.getNumberOfRowsPendingApproval());
    Response.ResponseBuilder builder =
        Response.status(pending > 0 && applied == 0 ? Response.Status.ACCEPTED : Response.Status.OK)
            .entity(result);
    if (pending > 0) {
      builder.header(RestUtil.PENDING_CHANGE_COUNT_HEADER, pending);
    }
    return builder.build();
  }

  /** How many change requests a bulk write submitted for the assets it held. */
  public static int submittedCount(List<BulkResponse> held, boolean dryRun) {
    return dryRun
        ? 0
        : (int)
            held.stream().filter(r -> r.getStatus() == Response.Status.OK.getStatusCode()).count();
  }

  private static ApiStatus bulkStatus(
      ApiStatus current, List<BulkResponse> succeeded, List<BulkResponse> failed) {
    ApiStatus status = current;
    if (!failed.isEmpty()) {
      status = succeeded.isEmpty() ? ApiStatus.FAILURE : ApiStatus.PARTIAL_SUCCESS;
    } else if (!succeeded.isEmpty()) {
      status = ApiStatus.SUCCESS;
    }
    return status;
  }

  // Assets are read once per entity type, with the edited field, and only for the types a workflow
  // gates for this field; the gated ones are returned by id for the hold to reuse.
  private static Map<UUID, EntityInterface> gatedAssets(
      List<EntityReference> assets, String field, String user) {
    Map<UUID, EntityInterface> gated = new HashMap<>();
    Map<String, List<EntityReference>> byType =
        assets.stream().collect(Collectors.groupingBy(EntityReference::getType));
    byType.forEach(
        (type, refs) -> {
          List<GatingRule> rules =
              GovernanceApprovalRegistry.gatingRules(type).stream()
                  .filter(
                      rule ->
                          WorkflowTriggerFilters.fieldTriggers(
                              type, field, rule.includedFields(), rule.excludedFields()))
                  .toList();
          // The bot check reads the acting user, so it runs only once a workflow gates the field.
          if (!rules.isEmpty() && !isBotChange(user, null)) {
            List<EntityInterface> entities = Entity.getEntities(refs, field, Include.ALL);
            for (EntityInterface entity : entities) {
              if (rules.stream()
                  .anyMatch(
                      rule ->
                          !WorkflowTriggerFilters.matchesExclusionFilter(
                              rule.filterLogic(), entity))) {
                gated.put(entity.getId(), entity);
              }
            }
          }
        });
    return gated;
  }

  private static int orZero(Integer value) {
    return value == null ? 0 : value;
  }

  private static Optional<StagedChange> stageIfGated(
      EntityInterface original,
      EntityInterface updated,
      String user,
      String impersonatedBy,
      Edit edit,
      boolean record) {
    String entityType = Entity.getEntityTypeFromObject(updated);
    List<GatingRule> rules = GovernanceApprovalRegistry.gatingRules(entityType);
    Optional<StagedChange> staged = Optional.empty();
    // The bot check reads the acting user, so it runs only for an entity type a workflow gates.
    if (!rules.isEmpty() && !isBotChange(user, impersonatedBy)) {
      Timer.Sample sample = ChangeRequestMetrics.startAdmission();
      staged = planStage(rules, entityType, original, updated, user, impersonatedBy, edit);
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
      Edit edit) {
    keepStoredStatusWhenOmitted(original, updated);
    EntityInterface published =
        edit.kind() == Edit.Kind.PUT ? publishedByPut(original, updated, edit) : updated;
    JsonNode base = JsonUtils.valueToTree(original);
    JsonNode proposed = JsonUtils.valueToTree(published);
    Set<String> changed = changedFields(entityType, original, base, proposed, edit);
    List<GatedBy> gating =
        gatingWorkflows(rules, entityType, published, triggerNames(base, proposed, changed));
    Optional<StagedChange> staged = Optional.empty();
    if (!gating.isEmpty()) {
      rejectAmbiguousReview(gating);
      rejectMutuallyExclusiveTags(published, changed);
      rejectStageMoveOutsideLifecycle(entityType, original, published, changed);
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

  // The fields the write replaces are looked up only when it sends null for a stored list or
  // object, since that is the only case where they decide the outcome.
  private static Set<String> changedFields(
      String entityType, EntityInterface original, JsonNode base, JsonNode proposed, Edit edit) {
    Set<String> names = new TreeSet<>();
    base.fieldNames().forEachRemaining(names::add);
    proposed.fieldNames().forEachRemaining(names::add);
    names.removeAll(BOOKKEEPING_FIELDS);
    boolean sendsNullForAList =
        names.stream()
            .anyMatch(
                name -> clearsStoredList(entityType, name, base.get(name), proposed.get(name)));
    Set<String> replaced =
        sendsNullForAList ? replacedFields(entityType, original, edit) : Set.of();
    names.removeIf(
        name -> !isChange(entityType, name, base.get(name), proposed.get(name), replaced));
    return names;
  }

  private static boolean clearsStoredList(
      String entityType, String field, JsonNode oldValue, JsonNode newValue) {
    return (newValue == null || newValue.isNull())
        && oldValue != null
        && !oldValue.isValueNode()
        && isStageable(entityType, field);
  }

  // The fields a write replaces with what it sends, as the entity updater and the import apply it.
  private static Set<String> replacedFields(
      String entityType, EntityInterface original, Edit edit) {
    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    Set<String> replaced = new HashSet<>();
    switch (edit.kind()) {
      case PATCH -> replaced.addAll(edit.patchedFields());
      case PUT -> {
        replaced.addAll(repository.getStoredFieldNames(original.getId()));
        replaced.addAll(repository.getRelationsReplacedByPut());
        replaced.removeAll(repository.getFieldsKeptByPut());
      }
      case IMPORT_UPDATE -> {
        replaced.addAll(repository.getStoredFieldNames(original.getId()));
        replaced.addAll(repository.getRelationsReplacedByPut());
        replaced.addAll(REPLACED_BY_IMPORT_UPDATE);
        replaced.removeAll(repository.getFieldsKeptByPut());
      }
      case IMPORT_ROW -> {
        replaced.addAll(repository.getStoredFieldNames(original.getId()));
        replaced.addAll(repository.getRelationsReplacedByImport());
        replaced.add(EXTENSION);
      }
    }
    return replaced;
  }

  // An absent/null proposed value clears a stageable field's scalar under every write, and its
  // list or object only when the write replaces that field.
  private static boolean isChange(
      String entityType, String field, JsonNode oldValue, JsonNode newValue, Set<String> replaced) {
    boolean cleared = newValue == null || newValue.isNull();
    boolean clears =
        isStageable(entityType, field)
            && (replaced.contains(field) || (oldValue != null && oldValue.isValueNode()));
    return (!cleared || clears) && MutationPlanner.differs(oldValue, newValue);
  }

  // A human PUT adds the tags it sends to the stored ones and keeps the owners and domains it sends
  // empty, so the entity it would publish carries both. A bulk override replaces the stored tags of
  // the classifications and glossaries it sends and keeps the others.
  private static EntityInterface publishedByPut(
      EntityInterface original, EntityInterface updated, Edit edit) {
    EntityInterface published = JsonUtils.deepCopy(updated, updated.getClass());
    List<TagLabel> sent = listOrEmpty(updated.getTags());
    List<TagLabel> stored = listOrEmpty(original.getTags());
    if (edit.overrideMetadata() && !sent.isEmpty()) {
      Set<String> sentRoots =
          sent.stream()
              .filter(tag -> tag.getLabelType() != TagLabel.LabelType.DERIVED)
              .map(tag -> FullyQualifiedName.getRoot(tag.getTagFQN()))
              .collect(Collectors.toSet());
      stored =
          stored.stream()
              .filter(tag -> !sentRoots.contains(FullyQualifiedName.getRoot(tag.getTagFQN())))
              .toList();
    }
    List<TagLabel> tags = new ArrayList<>(sent);
    EntityUtil.mergeTags(tags, stored);
    published.setTags(tags);
    if (nullOrEmpty(updated.getOwners())) {
      published.setOwners(original.getOwners());
    }
    if (nullOrEmpty(updated.getDomains())) {
      published.setDomains(original.getDomains());
    }
    return published;
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

  // A PUT, bulk or import update built from a create request carries no stage; like the entity
  // updater, it keeps the stage the entity is in rather than clearing it.
  private static void keepStoredStatusWhenOmitted(
      EntityInterface original, EntityInterface updated) {
    if (updated.getEntityStatus() == null) {
      updated.setEntityStatus(original.getEntityStatus());
    }
  }

  // A stage change the lifecycle cannot make is refused now, not after a reviewer approves it.
  private static void rejectStageMoveOutsideLifecycle(
      String entityType, EntityInterface original, EntityInterface updated, Set<String> changed) {
    if (changed.contains(Entity.FIELD_ENTITY_STATUS)) {
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      EntityStatusAdapter<?> statuses = repository.getEntityLifecycle().adapter();
      repository.validateEntityStatusMove(statuses.read(original), statuses.read(updated));
    }
  }

  private static void rejectMutuallyExclusiveTags(EntityInterface updated, Set<String> changed) {
    if (changed.contains(TAGS)) {
      TagLabelUtil.checkMutuallyExclusive(updated.getTags());
    }
  }
}
