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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.json.JsonPatch;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.State;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.security.ChangeActor;
import org.openmetadata.service.util.ChildFieldResolver;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil.PatchResponse;

/**
 * Adds a tag or glossary term to the assets picked on its Assets tab, or removes it, through the same
 * versioned PATCH an edit on the asset's own page goes through, and records one change event per
 * asset. Each asset is its own transaction and gets its own success or failure entry.
 *
 * <p>A removal stays within the selected asset: the label comes off the asset and its own fields
 * (a table's columns, a topic's schema fields). Other assets inside it keep labels they were given
 * directly, exactly as on the asset's own page.
 */
@Slf4j
public final class AssetTagLabelService {

  private static final String NOTHING_TO_VALIDATE = "Nothing to Validate.";
  private static final String COLUMN_FQN_REQUIRED = "Column FQN is required";
  private static final String TAGS_NOT_SUPPORTED = "Entity type %s does not support tags";
  private static final String CERTIFICATION_AS_TAG =
      "%s is a certification and cannot be applied as a tag; set the asset's certification instead";

  public record Request(
      TagLabel label, List<EntityReference> assets, boolean dryRun, ChangeActor actor) {}

  private record AssetScope(String entityType, UUID entityId, String childFqn) {}

  @FunctionalInterface
  private interface LabelEdit {
    void apply(EntityInterface asset, String entityType, String childFqn, TagLabel label);
  }

  private AssetTagLabelService() {}

  /** The label an Assets tab change applies: the one a user picks on the asset's own page. */
  public static TagLabel manualLabel(String tagFqn, TagSource source) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(source)
        .withLabelType(LabelType.MANUAL)
        .withState(State.CONFIRMED);
  }

  public static BulkOperationResult addToAssets(Request request) {
    TagLabelUtil.checkDisabledTags(List.of(request.label()));
    return editAssets(request, AssetLabelEdits::add);
  }

  public static BulkOperationResult removeFromAssets(Request request) {
    return editAssets(request, AssetLabelEdits::strip);
  }

  private static BulkOperationResult editAssets(Request request, LabelEdit edit) {
    BulkOperationResult result = new BulkOperationResult().withDryRun(request.dryRun());
    if (nullOrEmpty(request.assets())) {
      return result
          .withStatus(ApiStatus.SUCCESS)
          .withSuccessRequest(List.of(new BulkResponse().withMessage(NOTHING_TO_VALIDATE)));
    }
    EntityUtil.populateEntityReferences(request.assets());
    List<BulkResponse> passed = new ArrayList<>();
    List<BulkResponse> failed = new ArrayList<>();
    for (EntityReference ref : request.assets()) {
      BulkResponse response = new BulkResponse().withRequest(ref);
      tryEdit(request, edit, ref)
          .ifPresentOrElse(
              message -> failed.add(response.withMessage(message)), () -> passed.add(response));
    }
    return summarize(result, passed, failed);
  }

  /** Returns the failure message, if the asset could not be edited. */
  private static Optional<String> tryEdit(Request request, LabelEdit edit, EntityReference ref) {
    Optional<String> error = Optional.empty();
    try {
      AssetScope scope = scopeOf(ref);
      editAsset(Entity.getEntityRepository(scope.entityType()), scope, request, edit);
    } catch (Exception e) {
      LOG.debug("Assets tab change failed for {} {}", ref.getType(), ref.getId(), e);
      error = Optional.of(e.getMessage() == null ? e.toString() : e.getMessage());
    }
    return error;
  }

  /** A column is not an entity: it is edited through its table, scoped to that column. */
  private static AssetScope scopeOf(EntityReference ref) {
    if (!Entity.TABLE_COLUMN.equals(ref.getType())) {
      return new AssetScope(ref.getType(), ref.getId(), null);
    }
    String columnFqn = ref.getFullyQualifiedName();
    if (columnFqn == null) {
      throw new IllegalArgumentException(COLUMN_FQN_REQUIRED);
    }
    String tableFqn = ChildFieldResolver.parentFqnOf(columnFqn, Entity.TABLE);
    UUID tableId =
        Entity.getEntityReferenceByName(Entity.TABLE, tableFqn, Include.NON_DELETED).getId();
    return new AssetScope(Entity.TABLE, tableId, columnFqn);
  }

  private static <T extends EntityInterface> void editAsset(
      EntityRepository<T> repository, AssetScope scope, Request request, LabelEdit edit) {
    checkLabelAllowed(repository, scope, request.label());
    T original = load(repository, scope);
    T candidate = JsonUtils.deepCopy(original, repository.getEntityClass());
    edit.apply(candidate, scope.entityType(), scope.childFqn(), request.label());
    JsonPatch patch = JsonUtils.getJsonPatch(original, candidate);
    if (patch.toJsonArray().isEmpty()) {
      return;
    }
    if (request.dryRun()) {
      validate(repository, original, candidate);
    } else {
      patchAndRecord(repository, scope.entityId(), patch, request.actor());
    }
  }

  private static void checkLabelAllowed(
      EntityRepository<?> repository, AssetScope scope, TagLabel label) {
    if (!repository.isSupportsTags()) {
      throw new IllegalArgumentException(String.format(TAGS_NOT_SUPPORTED, scope.entityType()));
    }
    String certification = repository.getCertificationClassification();
    if (certification != null
        && certification.equals(FullyQualifiedName.getParentFQN(label.getTagFQN()))) {
      throw new IllegalArgumentException(String.format(CERTIFICATION_AS_TAG, label.getTagFQN()));
    }
  }

  // The same load PATCH does, so the patch addresses the same arrays it will be applied to.
  private static <T extends EntityInterface> T load(
      EntityRepository<T> repository, AssetScope scope) {
    T entity =
        repository.get(
            null, scope.entityId(), repository.getPatchFields(), Include.NON_DELETED, false);
    if (ChildFieldResolver.supports(scope.entityType())) {
      ChildFieldResolver.ensureChildFqns(entity, scope.entityType());
    }
    requireChild(entity, scope);
    return entity;
  }

  private static void requireChild(EntityInterface entity, AssetScope scope) {
    boolean missing =
        scope.childFqn() != null
            && ChildFieldResolver.locate(entity, scope.entityType(), scope.childFqn()).isEmpty();
    if (missing) {
      throw EntityNotFoundException.byMessage("Column not found: " + scope.childFqn());
    }
  }

  // The checks PATCH runs on the updated entity, so a preview predicts the real outcome.
  private static <T extends EntityInterface> void validate(
      EntityRepository<T> repository, T original, T candidate) {
    repository.validateTags(candidate);
    RuleEngine.getInstance().evaluateUpdate(original, candidate);
  }

  private static <T extends EntityInterface> void patchAndRecord(
      EntityRepository<T> repository, UUID id, JsonPatch patch, ChangeActor actor) {
    PatchResponse<T> response =
        repository.patch(null, id, actor.userName(), patch, null, actor.impersonatedBy());
    repository.storeChangeEventForAsyncOperation(
        response.entity(), response.changeType(), false, actor.userName());
  }

  private static BulkOperationResult summarize(
      BulkOperationResult result, List<BulkResponse> passed, List<BulkResponse> failed) {
    return result
        .withNumberOfRowsProcessed(passed.size() + failed.size())
        .withNumberOfRowsPassed(passed.size())
        .withNumberOfRowsFailed(failed.size())
        .withSuccessRequest(passed)
        .withFailedRequest(failed)
        .withStatus(statusOf(passed, failed));
  }

  private static ApiStatus statusOf(List<BulkResponse> passed, List<BulkResponse> failed) {
    if (failed.isEmpty()) {
      return ApiStatus.SUCCESS;
    }
    return passed.isEmpty() ? ApiStatus.FAILURE : ApiStatus.PARTIAL_SUCCESS;
  }
}
