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
package org.openmetadata.service.rdf;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

/**
 * Which {@code entity_relationship} rows the graph projects as edges. The reindex and the restore
 * of a soft-deleted entity both rebuild edges from these rows, so they share one definition.
 */
public final class RdfRelationshipScope {
  public static final List<Integer> ALL_RELATIONSHIPS =
      Arrays.stream(Relationship.values()).map(Relationship::ordinal).toList();

  private static final Set<String> EXCLUDED_ENTITY_TYPES =
      Set.of(
          "changeEvent",
          Entity.AUDIT_LOG,
          Entity.WEB_ANALYTIC_EVENT,
          "entityUsage",
          "eventSubscription",
          Entity.EVENT_SUBSCRIPTION,
          "vote",
          Entity.CONVERSATION,
          Entity.THREAD);

  private static final Set<Integer> EXCLUDED_RELATIONS =
      Set.of(Relationship.VOTED.ordinal(), Relationship.FOLLOWS.ordinal());

  private RdfRelationshipScope() {}

  public static boolean isProjectedEndpoint(final String entityType) {
    return !EXCLUDED_ENTITY_TYPES.contains(entityType)
        && !RdfExcludedEntities.isExcluded(entityType);
  }

  public static boolean isProjectedEdge(final EntityRelationshipObject row) {
    return isProjectedEndpoint(row.getFromEntity())
        && isProjectedEndpoint(row.getToEntity())
        && !EXCLUDED_RELATIONS.contains(row.getRelation());
  }

  /** Term-to-term relations are written by the typed glossary hooks, not as generic edges. */
  public static boolean isTypedGlossaryRelation(final EntityRelationshipObject row) {
    return Entity.GLOSSARY_TERM.equals(row.getFromEntity())
        && Entity.GLOSSARY_TERM.equals(row.getToEntity())
        && row.getRelation() == Relationship.RELATED_TO.ordinal();
  }

  public static EntityRelationship toEntityRelationship(final EntityRelationshipObject row) {
    return new EntityRelationship()
        .withFromEntity(row.getFromEntity())
        .withFromId(UUID.fromString(row.getFromId()))
        .withToEntity(row.getToEntity())
        .withToId(UUID.fromString(row.getToId()))
        .withRelation(row.getRelation())
        .withRelationshipType(Relationship.values()[row.getRelation()]);
  }
}
