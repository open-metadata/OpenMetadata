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

package org.openmetadata.service.util;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toSet;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.openmetadata.service.util.LineageDomainRollups.DomainMove;

/**
 * The descendants whose domains in effect follow a write to their containers' own domains: the
 * entities under a container's FQN, of a type search carries the container's inherited fields onto,
 * that are an end of a lineage edge. Their domains are read before the write and again after it, in
 * the write's transaction, so each moves what the write changed, whether it inherits from the
 * container, keeps its own domains or inherits from a nearer parent that has some.
 * ADR:2026-11-20-a-domain-lineage-edge-counts-the-edges-its-domains-assets-hold-in-effect
 */
@Slf4j
public final class LineageDomainInheritors {

  /**
   * A write re-projects at most this many descendants in its own transaction. Above it the rollups
   * are left for the rebuild command, which the warning names.
   */
  public static final int MAX_REPROJECTED = 5_000;

  public static final LineageDomainInheritors NONE =
      new LineageDomainInheritors(List.of(), Map.of());

  private static final int CONTAINERS_NAMED_IN_WARNING = 5;

  // A directory inherits from its parent directory (DirectoryRepository.setInheritedFields). A
  // nested container does not: it inherits from its service. ponytail: add a type here when its
  // repository starts inheriting domains from a parent of its own type.
  private static final Set<String> NESTING_TYPES = Set.of(Entity.DIRECTORY);

  private final List<EntityReference> inheritors;
  private final Map<UUID, List<EntityReference>> before;

  private LineageDomainInheritors(
      final List<EntityReference> inheritors, final Map<UUID, List<EntityReference>> before) {
    this.inheritors = inheritors;
    this.before = before;
  }

  /** Reads, before the containers' domains are written, the domains their descendants hold. */
  public static LineageDomainInheritors of(final Collection<EntityReference> containers) {
    final List<EntityReference> found = descendantsWithLineage(containers, MAX_REPROJECTED + 1);
    return movesInTheWrite(containers, found, MAX_REPROJECTED)
        ? new LineageDomainInheritors(found, domainsReadFresh(found))
        : NONE;
  }

  /** As {@link #of}, for the entities whose own domains these moves change. */
  public static LineageDomainInheritors ofMoved(final List<DomainMove> moves) {
    return of(
        listOrEmpty(moves).stream().filter(DomainMove::changes).map(DomainMove::entity).toList());
  }

  /**
   * Whether the write moves the descendants it found in its own transaction. Above the cap it moves
   * none of them and warns: their rollups stay under the old domains until the rebuild runs.
   */
  static boolean movesInTheWrite(
      final Collection<EntityReference> containers,
      final List<EntityReference> found,
      final int cap) {
    final boolean overCap = found.size() > cap;
    if (overCap) {
      warnNotReprojected(containers, cap);
    }
    return !overCap && !found.isEmpty();
  }

  /** Each descendant's move from the domains read before the write to the ones it holds now. */
  public List<DomainMove> moves() {
    final Map<UUID, List<EntityReference>> after =
        inheritors.isEmpty() ? Map.of() : domainsReadFresh(inheritors);
    return inheritors.stream()
        .map(
            entity ->
                new DomainMove(
                    entity,
                    before.getOrDefault(entity.getId(), List.of()),
                    after.getOrDefault(entity.getId(), List.of())))
        .toList();
  }

  /** These moves and the caller's, with the caller's dropped for every entity re-read here. */
  public List<DomainMove> followedBy(final List<DomainMove> moves) {
    return withCallerMoves(moves(), moves);
  }

  /**
   * A caller computes its moves before the write, from the parents' domains as they were, so for an
   * entity this write re-reads, the move read from the store is the right one, even a move that
   * changes nothing (a directory clearing its own domain while its parent takes the same one).
   */
  static List<DomainMove> withCallerMoves(
      final List<DomainMove> readMoves, final List<DomainMove> callerMoves) {
    final Set<UUID> reread = readMoves.stream().map(move -> move.entity().getId()).collect(toSet());
    return Stream.concat(
            readMoves.stream(),
            listOrEmpty(callerMoves).stream()
                .filter(move -> !reread.contains(move.entity().getId())))
        .toList();
  }

  static Set<String> inheritingTypes(final String containerType) {
    return inheritingTypes(
        containerType,
        LineageDomainInheritors::childTypes,
        LineageDomainInheritors::canBeLineageEnd);
  }

  /**
   * The types whose entities can inherit a container's domains and be an end of a lineage edge: the
   * types search carries the container's inherited fields onto, transitively, plus the container's
   * own type when it nests. None for a table or a container, so their domain writes run no query.
   */
  static Set<String> inheritingTypes(
      final String containerType,
      final Function<String, List<String>> childTypes,
      final Predicate<String> lineageEnd) {
    final Set<String> reached = new LinkedHashSet<>();
    collectChildTypes(containerType, childTypes, reached);
    if (NESTING_TYPES.contains(containerType)) {
      reached.add(containerType);
    }
    reached.removeIf(lineageEnd.negate());
    return reached;
  }

  private static void collectChildTypes(
      final String type,
      final Function<String, List<String>> childTypes,
      final Set<String> reached) {
    for (String child : listOrEmpty(childTypes.apply(type))) {
      if (reached.add(child)) {
        collectChildTypes(child, childTypes, reached);
      }
    }
  }

  // Lineage shows between entities whose search documents carry it, so a test case or a schema,
  // whose documents carry none, is never an end worth finding.
  private static boolean canBeLineageEnd(final String type) {
    return LineageDomainRollups.hasDomains(type) && SearchIndex.carriesLineage(type);
  }

  private static List<String> childTypes(final String type) {
    final IndexMapping mapping = Entity.getSearchRepository().getIndexMapping(type);
    return mapping == null ? List.of() : listOrEmpty(mapping.getChildAliases());
  }

  private static List<EntityReference> descendantsWithLineage(
      final Collection<EntityReference> containers, final int limit) {
    final Map<UUID, EntityReference> found = new LinkedHashMap<>();
    containers.stream()
        .collect(groupingBy(EntityReference::getType))
        .forEach(
            (type, ofType) -> {
              final Set<String> inheriting = inheritingTypes(type);
              if (!inheriting.isEmpty()) {
                withFqns(type, ofType)
                    .forEach(container -> addDescendants(found, container, inheriting, limit));
              }
            });
    return List.copyOf(found.values());
  }

  private static void addDescendants(
      final Map<UUID, EntityReference> found,
      final EntityReference container,
      final Set<String> types,
      final int limit) {
    for (String type : types) {
      if (found.size() < limit) {
        Entity.getEntityRepository(type)
            .getDao()
            .listDescendantIdsWithLineage(container.getFullyQualifiedName(), limit - found.size())
            .forEach(id -> found.putIfAbsent(id, new EntityReference().withId(id).withType(type)));
      }
    }
  }

  // A data product's asset records carry ids only; the containers among them need their FQN.
  private static List<EntityReference> withFqns(
      final String type, final List<EntityReference> containers) {
    final List<UUID> unnamed =
        containers.stream()
            .filter(container -> container.getFullyQualifiedName() == null)
            .map(EntityReference::getId)
            .toList();
    final Stream<EntityReference> named =
        containers.stream().filter(container -> container.getFullyQualifiedName() != null);
    return unnamed.isEmpty()
        ? named.toList()
        : Stream.concat(named, Entity.getEntityReferencesByIds(type, unnamed, Include.ALL).stream())
            .toList();
  }

  // In the write's transaction a cached parent still holds the domains being replaced, and what is
  // read here is not committed yet, so it must not reach a cache either.
  private static Map<UUID, List<EntityReference>> domainsReadFresh(
      final List<EntityReference> entities) {
    try (FreshReadScope.Handle freshRead = FreshReadScope.enter();
        EntityCacheBypass.Handle cacheBypass = EntityCacheBypass.skip()) {
      return LineageDomainRollups.domainsHeldBy(entities);
    }
  }

  private static void warnNotReprojected(
      final Collection<EntityReference> containers, final int cap) {
    LOG.warn(
        "Domain lineage was not moved for the descendants of {}: more than {} of them have"
            + " lineage, so their domain lineage edges stay under their old domains. Run"
            + " `./bootstrap/openmetadata-ops.sh rebuild-domain-lineage` with lineage and domain"
            + " writes paused (or the server stopped), then `./bootstrap/openmetadata-ops.sh"
            + " reindex --entities=domain,dataProduct`.",
        containers.stream()
            .limit(CONTAINERS_NAMED_IN_WARNING)
            .map(container -> container.getType() + " " + container.getId())
            .toList(),
        cap);
  }
}
