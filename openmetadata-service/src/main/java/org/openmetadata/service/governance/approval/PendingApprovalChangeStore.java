/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.approval;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.PendingApprovalChangeDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.PendingApprovalChangeRecord;

/**
 * Per-(entity, requester) store for an approval-gated change held out of the entity until the
 * governing workflow approves it. The held change is a {@link ChangeDescription}-shaped diff so the
 * workflow's "what changed" nodes (checkChangeDescription, the trigger field filter) can read it
 * exactly as they read a persisted change description. Backed by the {@code pending_approval_change}
 * table, keyed by {@code (entity id, updatedBy)}, so each requester's edits form their own hold and
 * never touch the entity row or its version history. Successive edits by the same requester while a
 * hold is open accumulate into a single record via {@link #merge}.
 */
public final class PendingApprovalChangeStore {

  private PendingApprovalChangeStore() {}

  private static PendingApprovalChangeDAO dao() {
    return Entity.getCollectionDAO().pendingApprovalChangeDAO();
  }

  public static ChangeDescription get(UUID entityId, String updatedBy) {
    String json = dao().find(entityId, updatedBy);
    return CommonUtil.nullOrEmpty(json) ? null : JsonUtils.readValue(json, ChangeDescription.class);
  }

  /**
   * A requester's held change together with the version token ({@code updatedAt}) it was read at, so
   * a resolution can delete exactly the state it acted on and leave a newer edit untouched.
   */
  public record HeldRecord(ChangeDescription change, long updatedAt) {}

  /**
   * Merge {@code incoming} onto this requester's existing hold atomically. The first edit is inserted
   * in one step; only when a prior hold already exists does the merge take the locked read (SELECT
   * FOR UPDATE) plus write path, so two concurrent edits by the same requester serialize on the row
   * instead of racing a read-modify-write and losing one proposed change.
   */
  public static void accumulate(UUID entityId, String updatedBy, ChangeDescription incoming) {
    String incomingJson = JsonUtils.pojoToJson(incoming);
    long now = System.currentTimeMillis();
    Entity.getJdbi()
        .useTransaction(
            handle -> {
              PendingApprovalChangeDAO dao = handle.attach(PendingApprovalChangeDAO.class);
              if (dao.insertIfAbsent(entityId, updatedBy, incomingJson, now) == 0) {
                String existingJson = dao.findForUpdate(entityId, updatedBy);
                ChangeDescription existing =
                    CommonUtil.nullOrEmpty(existingJson)
                        ? null
                        : JsonUtils.readValue(existingJson, ChangeDescription.class);
                dao.upsert(
                    entityId, updatedBy, JsonUtils.pojoToJson(merge(existing, incoming)), now);
              }
            });
  }

  /** The requester's hold plus the version token it was read at, or null when there is no hold. */
  public static HeldRecord getRecord(UUID entityId, String updatedBy) {
    PendingApprovalChangeRecord row = dao().findRecord(entityId, updatedBy);
    HeldRecord result = null;
    if (row != null) {
      result =
          new HeldRecord(JsonUtils.readValue(row.json(), ChangeDescription.class), row.updatedAt());
    }
    return result;
  }

  public static void delete(UUID entityId, String updatedBy) {
    dao().delete(entityId, updatedBy);
  }

  /**
   * Delete the hold only if it still matches the version token it was read at. A no-op when a newer
   * edit accumulated after the caller's snapshot, so that newer proposal survives for its own review.
   */
  public static void deleteIfUnchanged(UUID entityId, String updatedBy, long seenUpdatedAt) {
    dao().deleteIfUnchanged(entityId, updatedBy, seenUpdatedAt);
  }

  /** Remove every requester's hold for an entity; used when the entity itself is deleted. */
  public static void deleteAllForEntity(UUID entityId) {
    dao().deleteAllForEntity(entityId);
  }

  /**
   * The change description a workflow's "what changed" nodes should evaluate: the entity's persisted
   * change description unioned with the requester's held pending change (held field values win).
   * Lets checkChangeDescription and the trigger's field filter see the proposed change even though
   * it is not on the entity.
   */
  public static ChangeDescription effective(EntityInterface entity, String updatedBy) {
    ChangeDescription persisted = entity.getChangeDescription();
    ChangeDescription held = get(entity.getId(), updatedBy);
    ChangeDescription result;
    if (held == null) {
      result = persisted;
    } else if (persisted == null) {
      result = held;
    } else {
      result = merge(persisted, held);
    }
    return result;
  }

  /**
   * Merge a newer held diff on top of an existing one. Field changes are keyed by field name so a
   * later edit to the same field supersedes the earlier one; the baseline (previous approved
   * version) is preserved from whichever record was recorded first.
   */
  static ChangeDescription merge(ChangeDescription existing, ChangeDescription incoming) {
    ChangeDescription result;
    if (existing == null) {
      result = incoming;
    } else {
      result =
          new ChangeDescription()
              .withPreviousVersion(existing.getPreviousVersion())
              .withFieldsAdded(mergeByName(existing.getFieldsAdded(), incoming.getFieldsAdded()))
              .withFieldsUpdated(
                  mergeByName(existing.getFieldsUpdated(), incoming.getFieldsUpdated()))
              .withFieldsDeleted(
                  mergeByName(existing.getFieldsDeleted(), incoming.getFieldsDeleted()));
    }
    return result;
  }

  private static List<FieldChange> mergeByName(
      List<FieldChange> existing, List<FieldChange> newer) {
    Map<String, FieldChange> byName = new LinkedHashMap<>();
    for (FieldChange change : CommonUtil.listOrEmpty(existing)) {
      byName.put(change.getName(), change);
    }
    for (FieldChange change : CommonUtil.listOrEmpty(newer)) {
      byName.put(change.getName(), change);
    }
    return new ArrayList<>(byName.values());
  }
}
