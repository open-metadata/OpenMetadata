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

/**
 * Per-entity store for an approval-gated change that is held out of the entity until the governing
 * workflow approves it. The held change is a {@link ChangeDescription}-shaped diff so the workflow's
 * "what changed" nodes (checkChangeDescription, the trigger field filter) can read it exactly as
 * they read a persisted change description. Backed by {@code entity_extension} (keyed by entity id),
 * so it never touches the entity row or its version history. Successive edits while a hold is open
 * accumulate into a single record via {@link #merge}.
 */
public final class PendingApprovalChangeStore {
  public static final String EXTENSION = "governance.pendingApprovalChange";
  private static final String JSON_SCHEMA = "governancePendingApprovalChange";

  private PendingApprovalChangeStore() {}

  public static ChangeDescription get(UUID entityId) {
    String json = Entity.getCollectionDAO().entityExtensionDAO().getExtension(entityId, EXTENSION);
    return CommonUtil.nullOrEmpty(json) ? null : JsonUtils.readValue(json, ChangeDescription.class);
  }

  public static boolean exists(UUID entityId) {
    return get(entityId) != null;
  }

  public static void put(UUID entityId, ChangeDescription pending) {
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(entityId, EXTENSION, JSON_SCHEMA, JsonUtils.pojoToJson(pending));
  }

  public static void accumulate(UUID entityId, ChangeDescription incoming) {
    ChangeDescription merged = merge(get(entityId), incoming);
    put(entityId, merged);
  }

  public static void delete(UUID entityId) {
    Entity.getCollectionDAO().entityExtensionDAO().delete(entityId, EXTENSION);
  }

  /**
   * The change description a workflow's "what changed" nodes should evaluate: the entity's persisted
   * change description unioned with the held pending change (held field values win). Lets
   * checkChangeDescription and the trigger's field filter see the proposed change even though it is
   * not on the entity.
   */
  public static ChangeDescription effective(EntityInterface entity) {
    ChangeDescription persisted = entity.getChangeDescription();
    ChangeDescription held = get(entity.getId());
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
