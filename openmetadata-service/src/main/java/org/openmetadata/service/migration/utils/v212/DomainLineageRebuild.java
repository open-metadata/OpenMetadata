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

package org.openmetadata.service.migration.utils.v212;

import static java.util.stream.Collectors.counting;
import static java.util.stream.Collectors.groupingBy;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.util.LineageDomainRollups;
import org.openmetadata.service.util.LineageDomainRollups.DomainPair;
import org.openmetadata.service.util.LineageDomainRollups.DomainPairTally;

/**
 * Recounts every domain lineage rollup from the lineage it rolls up. A domain given to an asset after
 * its lineage existed, directly or through its service, was never counted, and re-sending an edge
 * created the rollup at one asset edge however many it stood for. Targets come from the edges, never
 * from the stored count, so a second run changes nothing. A rollup another writer owns (a source
 * other than ChildAssets) keeps its source and is never inserted or deleted here. The lineage views
 * read search, so operators reindex domains and data products afterwards.
 */
@Slf4j
public final class DomainLineageRebuild {

  public static final String STEP_NAME = "rebuildDomainLineage";
  private static final int BATCH_SIZE = 500;
  private static final int UPSTREAM = Relationship.UPSTREAM.ordinal();

  private DomainLineageRebuild() {}

  /** What reconciling one domain pair did. */
  public enum Change {
    NONE,
    INSERTED,
    RECOUNTED,
    DELETED
  }

  public static Map<Change, Long> rebuild(final CollectionDAO collectionDAO) {
    final EntityRelationshipDAO relationships = collectionDAO.relationshipDAO();
    final DomainPairTally targets = new DomainPairTally();
    final Map<DomainPair, EntityRelationshipObject> stored = new HashMap<>();
    forEachLineagePage(relationships, page -> tally(page, targets, stored));
    final Map<Change, Long> changes = reconcile(relationships, targets, stored);
    LOG.info(
        "Domain lineage rebuilt: {}. Run `./bootstrap/openmetadata-ops.sh reindex --force"
            + " --entities=domain,dataProduct` so the lineage views read the rebuilt rows.",
        changes);
    return changes;
  }

  // Keyset over the primary key, as ServiceLineagePipelineRoutingMigration walks it: no OFFSET
  // re-walk of the pages already read.
  private static void forEachLineagePage(
      final EntityRelationshipDAO relationships,
      final Consumer<List<EntityRelationshipObject>> consumer) {
    List<EntityRelationshipObject> page =
        relationships.getAllRelationshipsAfter("", "", -1, "", BATCH_SIZE);
    while (!page.isEmpty()) {
      consumer.accept(page.stream().filter(row -> row.getRelation() == UPSTREAM).toList());
      final EntityRelationshipObject last = page.getLast();
      page =
          relationships.getAllRelationshipsAfter(
              last.getFromId(),
              last.getToId(),
              last.getRelation(),
              Objects.toString(last.getRelationType(), ""),
              BATCH_SIZE);
    }
  }

  private static void tally(
      final List<EntityRelationshipObject> lineage,
      final DomainPairTally targets,
      final Map<DomainPair, EntityRelationshipObject> stored) {
    lineage.stream()
        .filter(DomainLineageRebuild::isDomainToDomain)
        .forEach(row -> stored.put(pairOf(row), row));
    final List<EntityRelationshipObject> rolling =
        lineage.stream().filter(LineageDomainRollups::rollsUp).toList();
    final Map<UUID, List<EntityReference>> held =
        LineageDomainRollups.domainsHeldBy(LineageDomainRollups.endsOf(rolling));
    rolling.forEach(
        row ->
            targets.add(
                held.getOrDefault(UUID.fromString(row.getFromId()), List.of()),
                held.getOrDefault(UUID.fromString(row.getToId()), List.of()),
                1));
  }

  private static Map<Change, Long> reconcile(
      final EntityRelationshipDAO relationships,
      final DomainPairTally targets,
      final Map<DomainPair, EntityRelationshipObject> stored) {
    final Set<DomainPair> pairs = new HashSet<>(stored.keySet());
    pairs.addAll(targets.counts().keySet());
    return pairs.stream()
        .map(
            pair ->
                reconcilePair(
                    relationships, pair, stored.get(pair), targets.counts().getOrDefault(pair, 0)))
        .collect(groupingBy(change -> change, () -> new EnumMap<>(Change.class), counting()));
  }

  private static Change reconcilePair(
      final EntityRelationshipDAO relationships,
      final DomainPair pair,
      final EntityRelationshipObject row,
      final int target) {
    return row == null
        ? insertWhenCounted(relationships, pair, target)
        : reconcileStored(relationships, pair, row, target);
  }

  private static Change insertWhenCounted(
      final EntityRelationshipDAO relationships, final DomainPair pair, final int target) {
    final boolean counted = target > 0;
    if (counted) {
      store(relationships, pair, LineageDomainRollups.newRollupDetails(target));
    }
    return counted ? Change.INSERTED : Change.NONE;
  }

  // A ChildAssets rollup is this repair's to fix outright. Any other source came from a direct
  // write onto the pair, which live edge writes keep counting: only a count it carries is set.
  private static Change reconcileStored(
      final EntityRelationshipDAO relationships,
      final DomainPair pair,
      final EntityRelationshipObject row,
      final int target) {
    final LineageDetails details = LineageDomainRollups.detailsOf(row.getJson());
    final boolean ownRollup = details.getSource() == LineageDetails.Source.CHILD_ASSETS;
    Change change = Change.NONE;
    if (ownRollup && target == 0) {
      relationships.delete(pair.fromId(), Entity.DOMAIN, pair.toId(), Entity.DOMAIN, UPSTREAM);
      change = Change.DELETED;
    } else if (isMiscounted(details, ownRollup, target)) {
      store(relationships, pair, details.withAssetEdges(target));
      change = Change.RECOUNTED;
    }
    return change;
  }

  private static boolean isMiscounted(
      final LineageDetails details, final boolean ownRollup, final int target) {
    final Integer assetEdges = details.getAssetEdges();
    return (ownRollup || assetEdges != null) && !Objects.equals(assetEdges, target);
  }

  private static void store(
      final EntityRelationshipDAO relationships,
      final DomainPair pair,
      final LineageDetails details) {
    relationships.insert(
        pair.fromId(),
        pair.toId(),
        Entity.DOMAIN,
        Entity.DOMAIN,
        UPSTREAM,
        JsonUtils.pojoToJson(details));
  }

  private static boolean isDomainToDomain(final EntityRelationshipObject row) {
    return Entity.DOMAIN.equals(row.getFromEntity()) && Entity.DOMAIN.equals(row.getToEntity());
  }

  private static DomainPair pairOf(final EntityRelationshipObject row) {
    return new DomainPair(UUID.fromString(row.getFromId()), UUID.fromString(row.getToId()));
  }
}
