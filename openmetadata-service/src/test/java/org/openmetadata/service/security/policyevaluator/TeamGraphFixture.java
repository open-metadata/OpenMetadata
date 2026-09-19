/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.security.policyevaluator;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * In-memory stand-in for the {@code entity_relationship} rows and reference lookups that {@link
 * TeamHierarchyResolver} reads, so policy tests can describe a team graph without a database.
 *
 * <p>The resolver deliberately does not materialise {@code Team} entities, so a test that builds
 * its graph only as cached entities or repository stubs has nothing for it to read. Register each
 * team here as well and the rows are derived from the POJO.
 */
public final class TeamGraphFixture {

  private static final List<CollectionDAO.EntityRelationshipObject> ROWS =
      new CopyOnWriteArrayList<>();
  private static final Map<String, Map<UUID, EntityReference>> REFS = new ConcurrentHashMap<>();
  private static final AtomicInteger QUERIES = new AtomicInteger();
  private static final AtomicReference<Runnable> DURING_NEXT_READ = new AtomicReference<>();

  private TeamGraphFixture() {}

  /** Installs the in-memory relationship DAO and clears any graph left by an earlier test. */
  public static void install() {
    ROWS.clear();
    REFS.clear();
    QUERIES.set(0);
    DURING_NEXT_READ.set(null);
    TeamHierarchyResolver.invalidateAll();
    Entity.setCollectionDAO(collectionDAO());
  }

  /** Relationship reads served since {@link #install()} or {@link #resetQueryCount()}. */
  public static int queryCount() {
    return QUERIES.get();
  }

  public static void resetQueryCount() {
    QUERIES.set(0);
  }

  /**
   * Runs {@code action} once, in the middle of the next relationship read, so a test can land a
   * concurrent write between a cache miss and the memoizing that follows it.
   */
  public static void duringNextRead(final Runnable action) {
    DURING_NEXT_READ.set(action);
  }

  /** Records the parent, default-role and policy edges a team declares on its POJO. */
  public static void register(final Team team) {
    registerTeam(
        team.getEntityReference(), team.getParents(), team.getDefaultRoles(), team.getPolicies());
  }

  /** Records a team that exists only as a reference, for tests that never build the POJO. */
  public static void registerTeam(
      final EntityReference team,
      final List<EntityReference> parents,
      final List<EntityReference> defaultRoles,
      final List<EntityReference> policies) {
    addRef(Entity.TEAM, team);
    for (final EntityReference parent : listOrEmpty(parents)) {
      addRef(Entity.TEAM, parent);
      link(Relationship.PARENT_OF, Entity.TEAM, parent.getId(), Entity.TEAM, team.getId());
    }
    for (final EntityReference role : listOrEmpty(defaultRoles)) {
      addRef(Entity.ROLE, role);
      link(Relationship.HAS, Entity.TEAM, team.getId(), Entity.ROLE, role.getId());
    }
    for (final EntityReference policy : listOrEmpty(policies)) {
      addRef(Entity.POLICY, policy);
      link(Relationship.HAS, Entity.TEAM, team.getId(), Entity.POLICY, policy.getId());
    }
    // A real team write drops the resolved graph through SubjectCache.invalidateAll(); a test that
    // edits the graph has to do the same or the resolver keeps serving the shape it read before.
    TeamHierarchyResolver.invalidateAll();
  }

  /** Answers {@code Entity.getEntityReferencesByIds} from the graph registered here. */
  public static <T extends EntityInterface> void stubReferences(
      final EntityRepository<T> repository, final String entityType) {
    when(repository.getReferences(anyList(), any(Include.class)))
        .thenAnswer(
            i -> {
              final List<EntityReference> refs = new ArrayList<>();
              for (final UUID id : i.<List<UUID>>getArgument(0)) {
                final EntityReference ref = refsOf(entityType).get(id);
                if (ref != null) {
                  refs.add(ref);
                }
              }
              return refs;
            });
  }

  private static CollectionDAO collectionDAO() {
    final CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(relationshipDAO.findFromBatch(anyList(), anyInt(), anyString()))
        .thenAnswer(
            i ->
                findRows(
                    row -> i.<List<String>>getArgument(0).contains(row.getToId()),
                    i.getArgument(1),
                    row -> row.getFromEntity().equals(i.getArgument(2))));
    when(relationshipDAO.findToBatch(anyList(), anyInt(), anyString(), anyString()))
        .thenAnswer(
            i ->
                findRows(
                    row -> i.<List<String>>getArgument(0).contains(row.getFromId()),
                    i.getArgument(1),
                    row ->
                        row.getFromEntity().equals(i.getArgument(2))
                            && row.getToEntity().equals(i.getArgument(3))));
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    return collectionDAO;
  }

  private static void addRef(final String entityType, final EntityReference ref) {
    if (ref != null && ref.getId() != null) {
      refsOf(entityType).put(ref.getId(), ref);
    }
  }

  private static Map<UUID, EntityReference> refsOf(final String entityType) {
    return REFS.computeIfAbsent(entityType, k -> new ConcurrentHashMap<>());
  }

  private static void link(
      final Relationship relationship,
      final String fromEntity,
      final UUID fromId,
      final String toEntity,
      final UUID toId) {
    // Test graphs are rebuilt per test method with deterministic ids; do not accumulate edges.
    if (hasRow(relationship, fromId, toId)) {
      return;
    }
    ROWS.add(
        CollectionDAO.EntityRelationshipObject.builder()
            .fromId(fromId.toString())
            .toId(toId.toString())
            .fromEntity(fromEntity)
            .toEntity(toEntity)
            .relation(relationship.ordinal())
            .build());
  }

  private static boolean hasRow(
      final Relationship relationship, final UUID fromId, final UUID toId) {
    return ROWS.stream()
        .anyMatch(
            row ->
                row.getRelation() == relationship.ordinal()
                    && row.getFromId().equals(fromId.toString())
                    && row.getToId().equals(toId.toString()));
  }

  private static List<CollectionDAO.EntityRelationshipObject> findRows(
      final RowPredicate idMatches, final int relation, final RowPredicate typeMatches) {
    QUERIES.incrementAndGet();
    final Runnable interleaved = DURING_NEXT_READ.getAndSet(null);
    if (interleaved != null) {
      interleaved.run();
    }
    final List<CollectionDAO.EntityRelationshipObject> matched = new ArrayList<>();
    for (final CollectionDAO.EntityRelationshipObject row : ROWS) {
      if (row.getRelation() == relation && idMatches.test(row) && typeMatches.test(row)) {
        matched.add(row);
      }
    }
    return matched;
  }

  @FunctionalInterface
  private interface RowPredicate {
    boolean test(CollectionDAO.EntityRelationshipObject row);
  }
}
