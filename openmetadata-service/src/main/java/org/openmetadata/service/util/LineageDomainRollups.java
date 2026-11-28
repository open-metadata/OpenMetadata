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
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toSet;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrDefault;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;

import com.google.common.collect.Lists;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Stream;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * Domain lineage rollups: one lineage row per ordered pair of domains, whose {@code assetEdges}
 * counts the lineage edges between the two domains' assets. The invariant and its triggers are
 * ADR:2026-11-20-a-domain-lineage-edge-counts-the-edges-its-domains-assets-hold-in-effect.
 */
public final class LineageDomainRollups {

  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();
  private static final int READ_CHUNK = 500;

  private LineageDomainRollups() {}

  /** An entity's domains in effect (own, else inherited) before and after one write. */
  public record DomainMove(
      EntityReference entity, List<EntityReference> before, List<EntityReference> after) {
    public DomainMove {
      before = distinctById(before);
      after = distinctById(after);
    }

    public boolean changes() {
      return !idsOf(before).equals(idsOf(after));
    }
  }

  public record DomainPair(UUID fromId, UUID toId) {}

  /** Asset edges per domain pair: an edge counts once for every pair of distinct domains. */
  public static final class DomainPairTally {
    private final Map<DomainPair, Integer> counts = new HashMap<>();
    private final Map<UUID, EntityReference> domains = new HashMap<>();

    public void add(
        final List<EntityReference> fromDomains,
        final List<EntityReference> toDomains,
        final int edges) {
      for (EntityReference from : listOrEmpty(fromDomains)) {
        for (EntityReference to : listOrEmpty(toDomains)) {
          addPair(from, to, edges);
        }
      }
    }

    private void addPair(final EntityReference from, final EntityReference to, final int edges) {
      if (!from.getId().equals(to.getId())) {
        domains.putIfAbsent(from.getId(), from);
        domains.putIfAbsent(to.getId(), to);
        counts.merge(new DomainPair(from.getId(), to.getId()), edges, Integer::sum);
      }
    }

    public Map<DomainPair, Integer> counts() {
      return Collections.unmodifiableMap(counts);
    }

    public EntityReference domain(final UUID id) {
      return domains.get(id);
    }
  }

  /**
   * Moves the rollups the moved entities' lineage stands for. Each of their edges leaves the pairs
   * its ends' domains formed before the write and joins the pairs they form after it, the same one
   * per edge that LineageRepository counts when an edge is added or deleted.
   */
  public static void move(final List<DomainMove> moves) {
    final Map<UUID, DomainMove> moved = changedMoves(moves);
    if (!moved.isEmpty()) {
      LineageDomainCoordinator.lockDomainMoves();
    }
    final DomainPairTally tally = new DomainPairTally();
    // Ceiling: the lineage rows of one chunk of moved entities are held at once, so a hub with
    // very many edges is read whole; page its edges if that outgrows memory.
    Lists.partition(List.copyOf(moved.keySet()), READ_CHUNK)
        .forEach(chunk -> tallyEdgesOf(chunk, moved, tally));
    applyDeltas(tally);
  }

  /** Any lineage edge but a rollup itself counts into the rollups of its ends' domains. */
  public static boolean rollsUp(final EntityRelationshipObject edge) {
    return edge.getRelation() == UPSTREAM
        && hasDomains(edge.getFromEntity())
        && hasDomains(edge.getToEntity())
        && !isRollup(edge.getJson());
  }

  public static boolean isRollup(final String lineageJson) {
    return detailsOf(lineageJson).getSource() == LineageDetails.Source.CHILD_ASSETS;
  }

  /** A row's lineage details; a row whose json holds none reads as empty details, not as null. */
  public static LineageDetails detailsOf(final String lineageJson) {
    final LineageDetails details =
        lineageJson == null ? null : JsonUtils.readValue(lineageJson, LineageDetails.class);
    return details == null ? new LineageDetails() : details;
  }

  /**
   * Domains in effect (own, else inherited) per entity; ids that no longer exist are absent. Read
   * from the database: a cache can still hold a parent's domains for a moment after the write that
   * replaced them commits, and what is read inside a write must not reach a cache either.
   */
  public static Map<UUID, List<EntityReference>> domainsHeldBy(
      final Collection<EntityReference> entities) {
    final Map<UUID, List<EntityReference>> held = new HashMap<>();
    try (FreshReadScope.Handle freshRead = FreshReadScope.enter();
        EntityCacheBypass.Handle cacheBypass = EntityCacheBypass.skip()) {
      entities.stream()
          .filter(entity -> hasDomains(entity.getType()))
          .collect(groupingBy(EntityReference::getType, mapping(EntityReference::getId, toSet())))
          .forEach(
              (type, ids) ->
                  Lists.partition(List.copyOf(ids), READ_CHUNK)
                      .forEach(chunk -> readDomains(type, chunk, held)));
    }
    return held;
  }

  public static List<EntityReference> endsOf(final List<EntityRelationshipObject> edges) {
    return edges.stream()
        .flatMap(edge -> Stream.of(fromEnd(edge), toEnd(edge)))
        .distinct()
        .toList();
  }

  public static LineageDetails newRollupDetails(final int assetEdges) {
    final long now = System.currentTimeMillis();
    return new LineageDetails()
        .withCreatedAt(now)
        .withUpdatedAt(now)
        .withCreatedBy(ADMIN_USER_NAME)
        .withUpdatedBy(ADMIN_USER_NAME)
        .withSource(LineageDetails.Source.CHILD_ASSETS)
        .withAssetEdges(assetEdges);
  }

  private static void tallyEdgesOf(
      final List<UUID> chunk, final Map<UUID, DomainMove> moved, final DomainPairTally tally) {
    final List<EntityRelationshipObject> edges = edgesRollingUp(chunk, moved);
    final Map<UUID, List<EntityReference>> unmoved =
        domainsHeldBy(
            endsOf(edges).stream().filter(end -> !moved.containsKey(end.getId())).toList());
    for (EntityRelationshipObject edge : edges) {
      tally.add(
          domainsAt(edge.getFromId(), moved, unmoved, DomainMove::before),
          domainsAt(edge.getToId(), moved, unmoved, DomainMove::before),
          -1);
      tally.add(
          domainsAt(edge.getFromId(), moved, unmoved, DomainMove::after),
          domainsAt(edge.getToId(), moved, unmoved, DomainMove::after),
          1);
    }
  }

  // A moved end takes its domains from the move, so a batch moving both ends of an edge counts it
  // the same in any order.
  private static List<EntityReference> domainsAt(
      final String id,
      final Map<UUID, DomainMove> moved,
      final Map<UUID, List<EntityReference>> unmoved,
      final Function<DomainMove, List<EntityReference>> state) {
    final UUID entityId = UUID.fromString(id);
    final DomainMove move = moved.get(entityId);
    return move == null ? unmoved.getOrDefault(entityId, List.of()) : state.apply(move);
  }

  // An edge between two moved ends is read from its from-end only, so it counts once whichever
  // chunks its ends fall in.
  private static List<EntityRelationshipObject> edgesRollingUp(
      final List<UUID> chunk, final Map<UUID, DomainMove> moved) {
    final List<String> ids = chunk.stream().map(UUID::toString).toList();
    final EntityRelationshipDAO relationships = relationships();
    return Stream.concat(
            relationships.findToBatchAllTypes(ids, UPSTREAM, Include.ALL).stream(),
            relationships.findFromBatch(ids, UPSTREAM, Include.ALL).stream()
                .filter(edge -> !moved.containsKey(UUID.fromString(edge.getFromId()))))
        .filter(LineageDomainRollups::rollsUp)
        .toList();
  }

  private static void applyDeltas(final DomainPairTally tally) {
    tally
        .counts()
        .forEach(
            (pair, delta) -> {
              if (delta != 0) {
                adjustAssetEdges(tally.domain(pair.fromId()), tally.domain(pair.toId()), delta);
              }
            });
  }

  // At 0 a ChildAssets rollup is released, as LineageRepository releases it when its last edge is
  // deleted. Another writer's row (a manual edge, or a rollup re-sent by hand) stays: only the
  // count
  // it carried is cleared, the same rule DomainLineageRebuild applies.
  private static void adjustAssetEdges(
      final EntityReference from, final EntityReference to, final int delta) {
    final EntityRelationshipObject stored =
        relationships().getRecord(from.getId(), to.getId(), UPSTREAM);
    final LineageDetails details =
        stored == null ? newRollupDetails(0) : detailsOf(stored.getJson());
    final int assetEdges = nullOrDefault(details.getAssetEdges(), 0) + delta;
    if (assetEdges > 0) {
      storeRollup(from, to, details.withAssetEdges(assetEdges));
    } else if (stored != null && details.getSource() == LineageDetails.Source.CHILD_ASSETS) {
      deleteRollup(from, to);
    } else if (stored != null && details.getAssetEdges() != null) {
      storeRollup(from, to, details.withAssetEdges(null));
    }
  }

  private static void storeRollup(
      final EntityReference from, final EntityReference to, final LineageDetails details) {
    relationships()
        .insert(
            from.getId(),
            to.getId(),
            Entity.DOMAIN,
            Entity.DOMAIN,
            UPSTREAM,
            JsonUtils.pojoToJson(details));
    LineageUtil.syncLineageEdgeToSearch(from, to);
  }

  private static void deleteRollup(final EntityReference from, final EntityReference to) {
    relationships().delete(from.getId(), Entity.DOMAIN, to.getId(), Entity.DOMAIN, UPSTREAM);
    LineageUtil.syncLineageEdgeToSearch(from, to);
  }

  // Only the domain lists outlive the chunk; the entities read for them are dropped with it.
  private static void readDomains(
      final String type, final List<UUID> ids, final Map<UUID, List<EntityReference>> held) {
    final EntityRepository<?> repository = Entity.getEntityRepository(type);
    repository
        .get(null, ids, repository.getFields(FIELD_DOMAINS), Include.ALL)
        .forEach(entity -> held.put(entity.getId(), listOrEmpty(entity.getDomains())));
  }

  // A type without a repository, such as one retired since the row was written, holds no domains.
  static boolean hasDomains(final String entityType) {
    return Entity.hasEntityRepository(entityType)
        && !Entity.isTimeSeriesEntity(entityType)
        && Entity.entityHasField(entityType, FIELD_DOMAINS);
  }

  private static EntityReference fromEnd(final EntityRelationshipObject edge) {
    return new EntityReference()
        .withId(UUID.fromString(edge.getFromId()))
        .withType(edge.getFromEntity());
  }

  private static EntityReference toEnd(final EntityRelationshipObject edge) {
    return new EntityReference()
        .withId(UUID.fromString(edge.getToId()))
        .withType(edge.getToEntity());
  }

  private static Map<UUID, DomainMove> changedMoves(final List<DomainMove> moves) {
    final Map<UUID, DomainMove> changed = new LinkedHashMap<>();
    listOrEmpty(moves).stream()
        .filter(DomainMove::changes)
        .forEach(move -> changed.putIfAbsent(move.entity().getId(), move));
    return changed;
  }

  private static List<EntityReference> distinctById(final List<EntityReference> references) {
    final Map<UUID, EntityReference> distinct = new LinkedHashMap<>();
    listOrEmpty(references)
        .forEach(reference -> distinct.putIfAbsent(reference.getId(), reference));
    return List.copyOf(distinct.values());
  }

  private static Set<UUID> idsOf(final List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).collect(toSet());
  }

  private static EntityRelationshipDAO relationships() {
    return Entity.getCollectionDAO().relationshipDAO();
  }
}
