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
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.RelationshipTypeRepairPlanner.Plan;
import org.openmetadata.service.migration.utils.v210.RelationshipTypeRepairPlanner.StoredRelationType;

/**
 * Before 2.1.0 guarded the delete, a relationship type could be deleted while another type or a
 * glossary term relation still used it, and every read of those relations then failed. This
 * undeletes or recreates each such type; see {@link RelationshipTypeRepairPlanner}. It is a fixed
 * point, so it runs on every 2.1.0 data migration: a run that finds every used type live writes
 * nothing, and a pod still on the unguarded build during a rolling upgrade cannot leave damage that
 * is never repaired.
 */
@Slf4j
public final class RelationshipTypeReferenceRepair {
  private RelationshipTypeReferenceRepair() {}

  /** Returns how many relationship types were undeleted or recreated. */
  public static int repair(
      final Handle handle, final ConnectionType connectionType, final CollectionDAO dao) {
    final RelationshipTypeRepairPlanner planner =
        new RelationshipTypeRepairPlanner(loadTypes(handle), Clock.systemUTC());
    final Plan plan = planner.plan(loadStoredRelationTypes(handle, connectionType));
    plan.restored().forEach(type -> undelete(dao, type));
    plan.recreated().forEach(type -> recreate(dao, type));
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

  /**
   * Rows with neither a type id nor a name are the default type, which cannot be deleted. MySQL
   * compares the name binary, as Postgres does, so names differing only in case stay apart.
   */
  private static List<StoredRelationType> loadStoredRelationTypes(
      final Handle handle, final ConnectionType connectionType) {
    final String relationType =
        connectionType == ConnectionType.MYSQL
            ? "relationType COLLATE utf8mb4_bin"
            : "relationType";
    return handle
        .createQuery(
            "SELECT DISTINCT relationshipTypeId, "
                + relationType
                + " AS relationType FROM entity_relationship "
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

  private static void undelete(final CollectionDAO dao, final RelationshipType type) {
    dao.relationshipTypeDAO().update(type);
    LOG.warn(
        "Undeleted relationship type '{}' ({}): it had been deleted while still in use",
        type.getName(),
        type.getId());
  }

  private static void recreate(final CollectionDAO dao, final RelationshipType type) {
    dao.relationshipTypeDAO().insert(type, type.getFullyQualifiedName());
    LOG.warn(
        "Recreated relationship type '{}' ({}) as a deprecated placeholder: it had been deleted"
            + " while still in use",
        type.getName(),
        type.getId());
  }
}
