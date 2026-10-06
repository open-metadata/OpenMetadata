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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.ChangeActor;
import org.openmetadata.service.util.ChildFieldResolver;
import org.openmetadata.service.util.EntityUtil;

/**
 * Applies one change to every asset picked on an Assets tab (a tag's, a glossary term's, a domain's
 * or a data product's) through {@link BulkPatch}, so each saved asset gets a version and a change
 * event made as the acting user, exactly as an edit on its own page would.
 *
 * <p>Items saved as the same entity (a table and its columns) are edited together and saved once. If
 * that save fails, each of its items is retried alone, so one bad item does not block the others.
 */
public final class AssetEditService {

  private static final String NOTHING_TO_VALIDATE = "Nothing to Validate.";
  private static final String COLUMN_FQN_REQUIRED = "Column FQN is required";

  /** One selected item, resolved to the entity that is saved for it. */
  public record Selection(EntityReference ref, String entityType, UUID entityId, String childFqn) {}

  /** What the change does to the loaded entity for one selected item. */
  @FunctionalInterface
  public interface AssetEdit {
    void apply(EntityInterface asset, Selection selection);
  }

  public record Request(List<EntityReference> assets, boolean dryRun, ChangeActor actor) {}

  private final Request request;
  private final AssetEdit edit;
  private final Map<EntityReference, String> failures = new IdentityHashMap<>();

  private AssetEditService(Request request, AssetEdit edit) {
    this.request = request;
    this.edit = edit;
  }

  public static BulkOperationResult apply(Request request, AssetEdit edit) {
    BulkOperationResult result = new BulkOperationResult().withDryRun(request.dryRun());
    if (nullOrEmpty(request.assets())) {
      return result
          .withStatus(ApiStatus.SUCCESS)
          .withSuccessRequest(List.of(new BulkResponse().withMessage(NOTHING_TO_VALIDATE)));
    }
    EntityUtil.populateEntityReferences(request.assets());
    return new AssetEditService(request, edit).run(result);
  }

  /** The selected assets the change was applied to. */
  public static List<EntityReference> succeededAssets(BulkOperationResult result) {
    return listOrEmpty(result.getSuccessRequest()).stream()
        .map(BulkResponse::getRequest)
        .filter(EntityReference.class::isInstance)
        .map(EntityReference.class::cast)
        .toList();
  }

  private BulkOperationResult run(BulkOperationResult result) {
    groupBySavedEntity().forEach(this::editType);
    return summarize(result);
  }

  // Entity type, then saved entity id, then its selected items, in request order.
  private Map<String, Map<UUID, List<Selection>>> groupBySavedEntity() {
    Map<String, Map<UUID, List<Selection>>> groups = new LinkedHashMap<>();
    for (EntityReference ref : request.assets()) {
      selectionOf(ref)
          .ifPresent(
              selection ->
                  groups
                      .computeIfAbsent(selection.entityType(), type -> new LinkedHashMap<>())
                      .computeIfAbsent(selection.entityId(), id -> new ArrayList<>())
                      .add(selection));
    }
    return groups;
  }

  private Optional<Selection> selectionOf(EntityReference ref) {
    Optional<Selection> selection = Optional.empty();
    try {
      selection = Optional.of(resolve(ref));
    } catch (Exception e) {
      fail(ref, messageOf(e));
    }
    return selection;
  }

  /** A column is not an entity: it is saved as part of its table. */
  private static Selection resolve(EntityReference ref) {
    if (!Entity.TABLE_COLUMN.equals(ref.getType())) {
      return new Selection(ref, ref.getType(), ref.getId(), null);
    }
    String columnFqn = ref.getFullyQualifiedName();
    if (columnFqn == null) {
      throw new IllegalArgumentException(COLUMN_FQN_REQUIRED);
    }
    String tableFqn = ChildFieldResolver.parentFqnOf(columnFqn, Entity.TABLE);
    UUID tableId =
        Entity.getEntityReferenceByName(Entity.TABLE, tableFqn, Include.NON_DELETED).getId();
    return new Selection(ref, Entity.TABLE, tableId, columnFqn);
  }

  private void editType(String entityType, Map<UUID, List<Selection>> bySavedEntity) {
    try {
      editType(Entity.getEntityRepository(entityType), bySavedEntity);
    } catch (Exception e) {
      bySavedEntity.values().forEach(selections -> failAll(selections, messageOf(e)));
    }
  }

  private <T extends EntityInterface> void editType(
      EntityRepository<T> repository, Map<UUID, List<Selection>> bySavedEntity) {
    patch(repository, bySavedEntity)
        .forEach((id, message) -> retryAlone(repository, bySavedEntity.get(id), message));
  }

  private <T extends EntityInterface> Map<UUID, String> patch(
      EntityRepository<T> repository, Map<UUID, List<Selection>> bySavedEntity) {
    List<BulkPatch.Edit<T>> edits = new ArrayList<>(bySavedEntity.size());
    bySavedEntity.forEach(
        (id, selections) ->
            edits.add(new BulkPatch.Edit<>(id, asset -> applyAll(asset, selections))));
    return new BulkPatch<>(repository, request.actor(), request.dryRun()).apply(edits);
  }

  // An item the change rejects fails on its own; the other items of the same entity still apply.
  private void applyAll(EntityInterface asset, List<Selection> selections) {
    for (Selection selection : selections) {
      try {
        edit.apply(asset, selection);
      } catch (Exception e) {
        fail(selection.ref(), messageOf(e));
      }
    }
  }

  private <T extends EntityInterface> void retryAlone(
      EntityRepository<T> repository, List<Selection> selections, String message) {
    if (selections.size() == 1) {
      failAll(selections, message);
      return;
    }
    selections.stream()
        .filter(selection -> !failures.containsKey(selection.ref()))
        .forEach(selection -> retry(repository, selection));
  }

  private <T extends EntityInterface> void retry(
      EntityRepository<T> repository, Selection selection) {
    Map<UUID, String> errors = patch(repository, Map.of(selection.entityId(), List.of(selection)));
    Optional.ofNullable(errors.get(selection.entityId()))
        .ifPresent(message -> fail(selection.ref(), message));
  }

  private BulkOperationResult summarize(BulkOperationResult result) {
    List<BulkResponse> passed = new ArrayList<>();
    List<BulkResponse> failed = new ArrayList<>();
    for (EntityReference ref : request.assets()) {
      BulkResponse response = new BulkResponse().withRequest(ref);
      Optional.ofNullable(failures.get(ref))
          .ifPresentOrElse(
              message -> failed.add(response.withMessage(message)), () -> passed.add(response));
    }
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

  private void failAll(List<Selection> selections, String message) {
    selections.forEach(selection -> fail(selection.ref(), message));
  }

  private void fail(EntityReference ref, String message) {
    failures.putIfAbsent(ref, message);
  }

  private static String messageOf(Exception e) {
    return e.getMessage() == null ? e.toString() : e.getMessage();
  }
}
