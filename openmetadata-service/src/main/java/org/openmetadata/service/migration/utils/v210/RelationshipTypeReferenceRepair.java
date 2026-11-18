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

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.time.Clock;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.RelationshipTypeRepairPlanner.Plan;
import org.openmetadata.service.migration.utils.v210.RelationshipTypeRepairPlanner.StoredRelationType;

/**
 * Before 2.1.0 guarded the delete, a relationship type could be deleted while another type or a
 * glossary term relation still used it, and every read of those relations then failed. This
 * undeletes or recreates each such type; see {@link RelationshipTypeRepairPlanner}. Idempotent: a
 * second run finds every used type live and writes nothing.
 */
@Slf4j
public final class RelationshipTypeReferenceRepair {
  public static final String STEP_NAME = "repairRelationshipTypesDeletedInUse";

  private RelationshipTypeReferenceRepair() {}

  /** Returns how many relationship types were undeleted or recreated. */
  public static int repair(final Handle handle, final ConnectionType connectionType) {
    final RelationshipTypeRepairPlanner planner =
        new RelationshipTypeRepairPlanner(loadTypes(handle), Clock.systemUTC());
    final Plan plan = planner.plan(loadStoredRelationTypes(handle));
    plan.restored().forEach(type -> write(handle, connectionType, type, "Undeleted"));
    plan.recreated().forEach(type -> write(handle, connectionType, type, "Recreated"));
    plan.unresolved()
        .forEach(
            missing ->
                LOG.warn(
                    "Cannot recreate {}: no name is stored for it; repair these relations by hand",
                    missing));
    return plan.restored().size() + plan.recreated().size();
  }

  private static List<RelationshipType> loadTypes(final Handle handle) {
    return handle
        .createQuery("SELECT json FROM relationship_type_entity")
        .map(
            (result, context) ->
                JsonUtils.readValue(result.getString("json"), RelationshipType.class))
        .list();
  }

  /** Rows with neither a type id nor a name are the default type, which cannot be deleted. */
  private static List<StoredRelationType> loadStoredRelationTypes(final Handle handle) {
    return handle
        .createQuery(
            "SELECT DISTINCT relationshipTypeId, relationType FROM entity_relationship "
                + "WHERE fromEntity = :entity AND toEntity = :entity AND relation = :relation "
                + "AND (relationshipTypeId IS NOT NULL OR relationType <> '')")
        .bind("entity", Entity.GLOSSARY_TERM)
        .bind("relation", Relationship.RELATED_TO.ordinal())
        .map(
            (result, context) ->
                new StoredRelationType(
                    uuidOrNull(result.getString("relationshipTypeId")),
                    nullOrEmpty(result.getString("relationType"))
                        ? null
                        : result.getString("relationType")))
        .list();
  }

  private static UUID uuidOrNull(final String value) {
    return nullOrEmpty(value) ? null : UUID.fromString(value);
  }

  private static void write(
      final Handle handle,
      final ConnectionType connectionType,
      final RelationshipType type,
      final String action) {
    OntologyMigration.upsert(handle, connectionType, type);
    LOG.warn(
        "{} relationship type '{}' ({}): it had been deleted while still in use",
        action,
        type.getName(),
        type.getId());
  }
}
