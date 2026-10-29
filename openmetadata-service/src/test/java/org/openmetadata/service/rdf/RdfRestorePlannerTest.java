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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.rdf.RdfEntityLiveness.Endpoint;

class RdfRestorePlannerTest {
  private final List<EntityRelationshipObject> rows = new ArrayList<>();
  private final List<RdfRestorePlanner.GlossaryRelation> termRelations = new ArrayList<>();
  private final Set<Endpoint> labelled = new HashSet<>();
  private final Set<UUID> deleted = new HashSet<>();
  private final RdfRestorePlanner planner =
      new RdfRestorePlanner(
          new RdfRestorePlanner.Sources() {
            @Override
            public List<EntityRelationshipObject> relationshipsOf(
                final String entityType, final List<UUID> entityIds) {
              return rows.stream()
                  .filter(
                      row ->
                          touches(row, entityType, entityIds.stream().map(UUID::toString).toList()))
                  .toList();
            }

            @Override
            public Set<Endpoint> labelledEntities(
                final String labelType, final List<UUID> labelIds) {
              return labelled;
            }

            @Override
            public List<RdfRestorePlanner.GlossaryRelation> glossaryRelations(
                final Collection<UUID> termIds) {
              return termRelations.stream()
                  .filter(relation -> termIds.contains(relation.fromTermId()))
                  .toList();
            }
          },
          (type, ids) ->
              ids.stream().filter(id -> !deleted.contains(id)).collect(Collectors.toSet()));

  @Test
  void restoreReaddsEdgesToLiveNeighboursAndReprojectsTheEntitiesThatReferenceIt() {
    final Endpoint table = endpoint(Entity.TABLE);
    final Endpoint schema = endpoint(Entity.DATABASE_SCHEMA);
    final Endpoint downstream = endpoint(Entity.TABLE);
    final Endpoint deletedUpstream = endpoint(Entity.TABLE);
    final Endpoint owner = endpoint(Entity.USER);
    final Endpoint follower = endpoint(Entity.USER);
    final Endpoint thread = endpoint(Entity.THREAD);
    deleted.add(deletedUpstream.entityId());
    row(schema, Relationship.CONTAINS, table);
    row(table, Relationship.UPSTREAM, downstream);
    row(deletedUpstream, Relationship.UPSTREAM, table);
    row(owner, Relationship.OWNS, table);
    row(follower, Relationship.FOLLOWS, table);
    row(thread, Relationship.CONTAINS, table);

    final List<RdfLiveWrite> plan = planner.plan(List.of(table));

    assertEquals(
        Set.of(
            edge(schema, Relationship.CONTAINS, table),
            edge(table, Relationship.UPSTREAM, downstream),
            edge(owner, Relationship.OWNS, table)),
        edges(plan));
    assertEquals(Set.of(schema, downstream, owner, follower), reprojected(plan));
  }

  @Test
  void aCascadeWritesEachEdgeBetweenRestoredEntitiesOnceAndReprojectsNeitherEnd() {
    final Endpoint schema = endpoint(Entity.DATABASE_SCHEMA);
    final Endpoint table = endpoint(Entity.TABLE);
    final Endpoint other = endpoint(Entity.TABLE);
    row(schema, Relationship.CONTAINS, table);
    row(schema, Relationship.CONTAINS, other);
    row(table, Relationship.UPSTREAM, other);

    final List<RdfLiveWrite> plan = planner.plan(List.of(table, other, schema));

    assertEquals(3, plan.size());
    assertEquals(
        Set.of(
            edge(schema, Relationship.CONTAINS, table),
            edge(schema, Relationship.CONTAINS, other),
            edge(table, Relationship.UPSTREAM, other)),
        edges(plan));
    assertEquals(Set.of(), reprojected(plan));
  }

  @Test
  void restoredTermGetsItsTypedRelationsFromBothSidesInsteadOfAGenericEdge() {
    final Endpoint restored = endpoint(Entity.GLOSSARY_TERM);
    final Endpoint related = endpoint(Entity.GLOSSARY_TERM);
    final Endpoint unrelated = endpoint(Entity.GLOSSARY_TERM);
    row(restored, Relationship.RELATED_TO, related);
    termRelations.add(relation(restored, related, "broader"));
    termRelations.add(relation(related, restored, "narrower"));
    termRelations.add(relation(related, unrelated, "synonym"));

    final List<RdfLiveWrite> plan = planner.plan(List.of(restored));

    assertEquals(Set.of(), edges(plan));
    assertEquals(
        Set.of(
            new RdfLiveWrite.GlossaryRelationChange(
                restored.entityId(), related.entityId(), "broader", false),
            new RdfLiveWrite.GlossaryRelationChange(
                related.entityId(), restored.entityId(), "narrower", false)),
        plan.stream()
            .filter(RdfLiveWrite.GlossaryRelationChange.class::isInstance)
            .collect(Collectors.toSet()));
    assertEquals(Set.of(related), reprojected(plan));
  }

  @Test
  void restoredTagReprojectsTheLiveEntitiesItLabels() {
    final Endpoint tag = endpoint(Entity.TAG);
    final Endpoint labelledTable = endpoint(Entity.TABLE);
    labelled.add(labelledTable);

    assertEquals(Set.of(labelledTable), reprojected(planner.plan(List.of(tag))));
  }

  private void row(final Endpoint from, final Relationship relation, final Endpoint to) {
    rows.add(
        EntityRelationshipObject.builder()
            .fromEntity(from.entityType())
            .fromId(from.entityId().toString())
            .toEntity(to.entityType())
            .toId(to.entityId().toString())
            .relation(relation.ordinal())
            .build());
  }

  private static boolean touches(
      final EntityRelationshipObject row, final String entityType, final List<String> ids) {
    return (entityType.equals(row.getFromEntity()) && ids.contains(row.getFromId()))
        || (entityType.equals(row.getToEntity()) && ids.contains(row.getToId()));
  }

  private static Set<EntityRelationship> edges(final List<RdfLiveWrite> plan) {
    return plan.stream()
        .filter(RdfLiveWrite.RelationshipChange.class::isInstance)
        .map(write -> ((RdfLiveWrite.RelationshipChange) write).relationshipJson())
        .map(json -> JsonUtils.readValue(json, EntityRelationship.class))
        .collect(Collectors.toSet());
  }

  private static Set<Endpoint> reprojected(final List<RdfLiveWrite> plan) {
    return plan.stream()
        .filter(RdfLiveWrite.EntityUpdate.class::isInstance)
        .map(write -> (RdfLiveWrite.EntityUpdate) write)
        .map(update -> new Endpoint(update.entityType(), update.entityId()))
        .collect(Collectors.toSet());
  }

  private static EntityRelationship edge(
      final Endpoint from, final Relationship relation, final Endpoint to) {
    return new EntityRelationship()
        .withFromEntity(from.entityType())
        .withFromId(from.entityId())
        .withToEntity(to.entityType())
        .withToId(to.entityId())
        .withRelation(relation.ordinal())
        .withRelationshipType(relation);
  }

  private static RdfRestorePlanner.GlossaryRelation relation(
      final Endpoint from, final Endpoint to, final String type) {
    return new RdfRestorePlanner.GlossaryRelation(from.entityId(), to.entityId(), type);
  }

  private static Endpoint endpoint(final String type) {
    return new Endpoint(type, UUID.randomUUID());
  }
}
