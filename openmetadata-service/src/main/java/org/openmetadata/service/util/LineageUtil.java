package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrDefault;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.jdbi3.LineageRepository.buildEntityLineageData;
import static org.openmetadata.service.jdbi3.LineageRepository.getDocumentUniqueId;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchClient.REMOVE_LINEAGE_SCRIPT;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LayerPaging;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.lineage.LineageSceneCache;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.search.SearchIndexRetryQueue;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
public class LineageUtil {

  /**
   * When a deferral scope is open on the calling thread, the lineage-ES leaves ({@link
   * #addLineageToSearch} / {@link #deleteLineageFromSearch}) capture their {@code updateLineage} /
   * {@code updateChildren} round trip here instead of issuing it inline. The create/update flush
   * opens a scope before its DB transaction so no Elasticsearch call runs while a pooled connection
   * is held — only the DB lineage-edge writes stay in the transaction — then drains the captured
   * closures after commit. {@code null} means "no scope active" and the leaf executes inline.
   */
  private static final ThreadLocal<List<DeferredLineageEsWrite>> DEFERRED_LINEAGE_ES =
      new ThreadLocal<>();

  private static final String ROOT_ID_FIELD = "id";
  private static final String UPSTREAM_LINEAGE_DOC_UNIQUE_ID = "upstreamLineage.docUniqueId";
  // A sync writes again only after a later commit changed the row; more than this means one keeps
  // landing, and its own sync writes the newer row.
  private static final int MAX_EDGE_SYNC_WRITES = 3;

  /** Source fields a lineage root lookup reads: the root's identity and the FQN keying the hits. */
  public static final List<String> ROOT_SOURCE_FIELDS =
      List.of(ROOT_ID_FIELD, Entity.FIELD_ENTITY_TYPE, Entity.FIELD_FULLY_QUALIFIED_NAME);

  /**
   * A captured lineage-ES write plus the entity whose search document carries the edge. The {@code
   * toEntity} is retained so a post-commit drain that fails the {@code updateLineage}/{@code
   * updateChildren} round trip can enqueue that entity to the durable search-index retry outbox
   * (the same entity-keyed recovery the direct entity-index path uses) instead of silently losing
   * the edge — the DB lineage rows were already committed inside the transaction.
   */
  public record DeferredLineageEsWrite(Runnable esWrite, EntityReference toEntity) {
    public void run() {
      esWrite.run();
    }
  }

  private LineageUtil() {}

  /** A successful HTTP response can still contain incomplete hits after a search timeout. */
  public static void rejectTimedOutSearch(final boolean timedOut, final String indexAlias) {
    if (timedOut) {
      throw new SearchException(
          String.format("Lineage search for index [%s] timed out.", indexAlias));
    }
  }

  /**
   * Open a lineage-ES deferral scope on the current thread. While open, the lineage-ES leaves
   * enqueue their work instead of running it inline. Returns {@code true} if this call opened the
   * scope (caller owns draining/closing it), {@code false} if a scope was already open (nested call
   * — the outer owner stays responsible). Pair a {@code true} result with a {@code finally} that
   * calls {@link #drainLineageDeferred()} after commit and {@link #clearLineageDeferred()} on
   * failure.
   */
  public static boolean beginLineageDeferral() {
    boolean opened = DEFERRED_LINEAGE_ES.get() == null;
    if (opened) {
      DEFERRED_LINEAGE_ES.set(new ArrayList<>());
    }
    return opened;
  }

  /**
   * Number of closures captured in the currently-open scope, or {@code 0} when no scope is open. A
   * nested (non-owning) caller records this before contributing so it can {@link
   * #rollbackToCheckpoint(int)} its own contributions on a deadlock replay without disturbing
   * closures the outer owner captured.
   */
  public static int checkpoint() {
    List<DeferredLineageEsWrite> deferred = DEFERRED_LINEAGE_ES.get();
    return deferred == null ? 0 : deferred.size();
  }

  /** Drop every closure captured after {@code checkpoint} so a retried nested flush re-captures cleanly. */
  public static void rollbackToCheckpoint(int checkpoint) {
    List<DeferredLineageEsWrite> deferred = DEFERRED_LINEAGE_ES.get();
    if (deferred != null) {
      while (deferred.size() > checkpoint) {
        deferred.removeLast();
      }
    }
  }

  /** Return the closures captured since {@link #beginLineageDeferral} and close the scope. */
  public static List<DeferredLineageEsWrite> drainLineageDeferred() {
    List<DeferredLineageEsWrite> deferred = DEFERRED_LINEAGE_ES.get();
    DEFERRED_LINEAGE_ES.remove();
    return deferred == null ? List.of() : deferred;
  }

  /** Discard captured closures and close the scope without running them (failed transaction). */
  public static void clearLineageDeferred() {
    DEFERRED_LINEAGE_ES.remove();
  }

  private static void deferOrRun(Runnable esWrite, EntityReference toEntity) {
    List<DeferredLineageEsWrite> deferred = DEFERRED_LINEAGE_ES.get();
    if (deferred != null) {
      deferred.add(new DeferredLineageEsWrite(esWrite, toEntity));
    } else {
      esWrite.run();
    }
  }

  /**
   * Runs {@code searchWrite} after the open deferral scope's transaction commits, or now when none
   * is open. {@code toEntity} is the entity whose document is enqueued for a retry if it fails.
   */
  public static void runAfterCommit(Runnable searchWrite, EntityReference toEntity) {
    deferOrRun(searchWrite, toEntity);
  }

  /**
   * Runs captured lineage search writes, enqueuing the document of any that fails to the search
   * index retry queue: the database rows they mirror are already committed.
   */
  public static void runDeferred(List<DeferredLineageEsWrite> writes) {
    for (DeferredLineageEsWrite write : writes) {
      try {
        write.run();
      } catch (RuntimeException e) {
        enqueueRetry(write.toEntity(), e);
      }
    }
  }

  private static void enqueueRetry(EntityReference toEntity, RuntimeException failure) {
    LOG.warn("Deferred lineage search write failed for {}; enqueuing retry", toEntity, failure);
    if (toEntity != null) {
      SearchIndexRetryQueue.enqueue(
          toEntity.getId() == null ? null : toEntity.getId().toString(),
          toEntity.getFullyQualifiedName(),
          toEntity.getType(),
          SearchIndexRetryQueue.failureReason("lineage", failure));
    }
  }

  /**
   * Makes the search copy of the edge {@code from -> to} match the stored row, reading the row when
   * the write runs, after commit, never the value the writer's transaction computed. Two rollup
   * writers commit in lock order, but their syncs can still interleave as read A, read B, write B,
   * write A, which leaves A's older read in search. So each sync reads the row again after its
   * write and writes again while it differs: the last sync to write then read a row no later commit
   * changed. Both writes are synchronous, so they land in the order they are made.
   * ADR:2026-11-26-domain-lineage-rollup-writers-lock-guard-rows-in-one-order
   */
  public static void syncLineageEdgeToSearch(EntityReference from, EntityReference to) {
    deferOrRun(() -> syncOrEnqueueRetry(from, to), to);
  }

  // The row is committed whatever search does, so a failed sync must not fail the write that made
  // it: a write path that runs it inline would report the stored change as failed.
  private static void syncOrEnqueueRetry(EntityReference from, EntityReference to) {
    try {
      writeStoredEdgeToSearch(from, to);
    } catch (RuntimeException e) {
      enqueueRetry(to, e);
    }
  }

  private static void writeStoredEdgeToSearch(EntityReference from, EntityReference to) {
    String written;
    String stored = storedEdgeJson(from, to);
    int writes = 0;
    do {
      writeEdgeToSearch(from, to, stored);
      written = stored;
      stored = storedEdgeJson(from, to);
      writes++;
    } while (!Objects.equals(written, stored) && writes < MAX_EDGE_SYNC_WRITES);
    invalidateLineageCaches(from, to);
  }

  /** The stored row's lineage json, or null when no row exists. */
  private static String storedEdgeJson(EntityReference from, EntityReference to) {
    CollectionDAO.EntityRelationshipObject stored =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .getRecord(from.getId(), to.getId(), Relationship.UPSTREAM.ordinal());
    return stored == null ? null : stored.getJson();
  }

  private static void writeEdgeToSearch(
      EntityReference from, EntityReference to, String storedJson) {
    if (storedJson == null) {
      removeLineageFromSearchNow(from, to);
    } else {
      doAddLineageToSearch(from, to, LineageDomainRollups.detailsOf(storedJson));
    }
  }

  // The synchronous form of doDeleteLineageFromSearch, on the index the add writes to: that one
  // starts a background task over every index, which a later add on the same document could
  // precede.
  private static void removeLineageFromSearchNow(EntityReference from, EntityReference to) {
    String uniqueValue = getDocumentUniqueId(from, to);
    SearchRepository searchRepository = Entity.getSearchRepository();
    String indexName =
        searchRepository.getWriteIndexName(searchRepository.getIndexMapping(to.getType()));
    try {
      searchRepository
          .getSearchClient()
          .updateChildren(
              List.of(indexName),
              UPSTREAM_LINEAGE_DOC_UNIQUE_ID,
              List.of(uniqueValue),
              new ImmutablePair<>(
                  REMOVE_LINEAGE_SCRIPT, Collections.singletonMap("docUniqueId", uniqueValue)));
    } catch (IOException e) {
      throw new SearchException(
          String.format(
              "Could not remove lineage edge %s from search: %s", uniqueValue, e.getMessage()));
    }
  }

  /**
   * @deprecated No caller in this repository; kept for callers outside it. It recounts from direct
   *     domain assignments only, missing inherited ones: use {@link LineageDomainRollups#move}.
   */
  @Deprecated(since = "2.1.0")
  public static void addDomainLineage(
      UUID entityId, String entityType, EntityReference updatedDomain) {
    if (!nullOrEmpty(updatedDomain)) {
      List<CollectionDAO.EntityRelationshipObject> downstreamDomains =
          Entity.getCollectionDAO().relationshipDAO().findDownstreamDomains(entityId, entityType);
      List<CollectionDAO.EntityRelationshipObject> upstreamDomains =
          Entity.getCollectionDAO().relationshipDAO().findUpstreamDomains(entityId, entityType);
      for (CollectionDAO.EntityRelationshipObject downstreamDomain : downstreamDomains) {
        insertDomainLineage(
            updatedDomain,
            Entity.getEntityReferenceById(
                downstreamDomain.getFromEntity(),
                UUID.fromString(downstreamDomain.getFromId()),
                Include.ALL));
      }
      for (CollectionDAO.EntityRelationshipObject upstreamDomain : upstreamDomains) {
        insertDomainLineage(
            Entity.getEntityReferenceById(
                upstreamDomain.getFromEntity(),
                UUID.fromString(upstreamDomain.getFromId()),
                Include.ALL),
            updatedDomain);
      }
    }
  }

  /**
   * @deprecated No caller in this repository; kept for callers outside it. It recounts from direct
   *     domain assignments only, missing inherited ones: use {@link LineageDomainRollups#move}.
   */
  @Deprecated(since = "2.1.0")
  public static void removeDomainLineage(
      UUID entityId, String entityType, EntityReference updatedDomain) {
    if (!nullOrEmpty(updatedDomain)) {
      List<CollectionDAO.EntityRelationshipObject> downstreamDomains =
          Entity.getCollectionDAO().relationshipDAO().findDownstreamDomains(entityId, entityType);
      List<CollectionDAO.EntityRelationshipObject> upstreamDomains =
          Entity.getCollectionDAO().relationshipDAO().findUpstreamDomains(entityId, entityType);
      for (CollectionDAO.EntityRelationshipObject downstreamDomain : downstreamDomains) {
        updateLineage(
            updatedDomain,
            Entity.getEntityReferenceById(
                downstreamDomain.getFromEntity(),
                UUID.fromString(downstreamDomain.getFromId()),
                Include.ALL));
      }
      for (CollectionDAO.EntityRelationshipObject upstreamDomain : upstreamDomains) {
        updateLineage(
            Entity.getEntityReferenceById(
                upstreamDomain.getFromEntity(),
                UUID.fromString(upstreamDomain.getFromId()),
                Include.ALL),
            updatedDomain);
      }
    }
  }

  private static void updateLineage(EntityReference fromRef, EntityReference toRef) {
    if (fromRef == null || toRef == null) return;

    CollectionDAO.EntityRelationshipObject relation =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .getRecord(fromRef.getId(), toRef.getId(), Relationship.UPSTREAM.ordinal());

    if (relation == null) return;

    LineageDetails lineageDetails = JsonUtils.readValue(relation.getJson(), LineageDetails.class);
    final int assetEdges = nullOrDefault(lineageDetails.getAssetEdges(), 0);
    if (assetEdges - 1 < 1) {
      Entity.getCollectionDAO()
          .relationshipDAO()
          .delete(
              fromRef.getId(),
              fromRef.getType(),
              toRef.getId(),
              toRef.getType(),
              Relationship.UPSTREAM.ordinal());
      deleteLineageFromSearch(fromRef, toRef, lineageDetails);
    } else {
      lineageDetails.withAssetEdges(assetEdges - 1);
      Entity.getCollectionDAO()
          .relationshipDAO()
          .insert(
              fromRef.getId(),
              toRef.getId(),
              fromRef.getType(),
              toRef.getType(),
              Relationship.UPSTREAM.ordinal(),
              JsonUtils.pojoToJson(lineageDetails));
      addLineageToSearch(fromRef, toRef, lineageDetails);
    }
  }

  static void deleteLineageFromSearch(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    deferOrRun(
        () -> {
          doDeleteLineageFromSearch(fromEntity, toEntity);
          invalidateLineageCaches(fromEntity, toEntity);
        },
        toEntity);
  }

  private static void doDeleteLineageFromSearch(
      EntityReference fromEntity, EntityReference toEntity) {
    String uniqueValue = getDocumentUniqueId(fromEntity, toEntity);
    Entity.getSearchRepository()
        .getSearchClient()
        .updateChildren(
            GLOBAL_SEARCH_ALIAS,
            new ImmutablePair<>("upstreamLineage.docUniqueId", uniqueValue),
            new ImmutablePair<>(
                REMOVE_LINEAGE_SCRIPT, Collections.singletonMap("docUniqueId", uniqueValue)));
  }

  private static void insertDomainLineage(EntityReference fromDomain, EntityReference toDomain) {
    int count =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .countDomainChildAssets(fromDomain.getId(), toDomain.getId());
    insertLineage(count, fromDomain, toDomain);
  }

  private static void insertLineage(int count, EntityReference fromRef, EntityReference toRef) {
    // Two assets of one domain or data product give it no edge to itself.
    if (fromRef.getId().equals(toRef.getId())) {
      return;
    }
    if (count > 0) {
      LineageDetails domainLineageDetails = LineageDomainRollups.newRollupDetails(count);
      Entity.getCollectionDAO()
          .relationshipDAO()
          .insert(
              fromRef.getId(),
              toRef.getId(),
              fromRef.getType(),
              toRef.getType(),
              Relationship.UPSTREAM.ordinal(),
              JsonUtils.pojoToJson(domainLineageDetails));
      addLineageToSearch(fromRef, toRef, domainLineageDetails);
    }
  }

  static void addLineageToSearch(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    deferOrRun(
        () -> {
          doAddLineageToSearch(fromEntity, toEntity, lineageDetails);
          invalidateLineageCaches(fromEntity, toEntity);
        },
        toEntity);
  }

  /**
   * The lineage caches a changed edge can be served from: the scene cache, the search-side lineage
   * cache of both ends, and the cached lineage rooted at them. A regular lineage write invalidates
   * these after it changes an edge, and so does a rollup write, once its search write has run.
   */
  public static void invalidateLineageCaches(EntityReference from, EntityReference to) {
    LineageSceneCache.getInstance().invalidateAll();
    var searchClient = Entity.getSearchRepository().getSearchClient();
    if (from != null) {
      searchClient.invalidateLineageCache(from.getFullyQualifiedName());
    }
    if (to != null) {
      searchClient.invalidateLineageCache(to.getFullyQualifiedName());
    }
    var cachedLineage = CacheBundle.getCachedLineage();
    if (cachedLineage != null && from != null && to != null) {
      cachedLineage.invalidateEdge(from.getId(), to.getId());
    }
  }

  private static void doAddLineageToSearch(
      EntityReference fromEntity, EntityReference toEntity, LineageDetails lineageDetails) {
    IndexMapping destinationIndexMapping =
        Entity.getSearchRepository().getIndexMapping(toEntity.getType());
    // Route to the staged rebuild index when a reindex is in flight so lineage edges written
    // mid-reindex survive the final alias swap instead of being dropped with the old index.
    String destinationIndexName =
        Entity.getSearchRepository().getWriteIndexName(destinationIndexMapping);
    // For lineage from -> to (not stored) since the doc itself is the toEntity
    EsLineageData lineageData =
        buildEntityLineageData(fromEntity, toEntity, lineageDetails).withToEntity(null);
    Pair<String, String> to = new ImmutablePair<>("_id", toEntity.getId().toString());
    Entity.getSearchRepository()
        .getSearchClient()
        .updateLineage(destinationIndexName, to, lineageData);
  }

  /**
   * The data product pairs whose rollup changes when an entity gains or loses {@code
   * dataProductIds}: each of them against each product its lineage neighbours hold.
   */
  public static Set<Pair<UUID, UUID>> dataProductPairs(
      UUID entityId, String entityType, Collection<UUID> dataProductIds) {
    Set<Pair<UUID, UUID>> pairs = new HashSet<>();
    if (!dataProductIds.isEmpty()) {
      CollectionDAO.EntityRelationshipDAO dao = Entity.getCollectionDAO().relationshipDAO();
      Set<UUID> downstream = heldDataProducts(dao.findDownstreamDataProducts(entityId, entityType));
      Set<UUID> upstream = heldDataProducts(dao.findUpstreamDataProducts(entityId, entityType));
      for (UUID dataProductId : dataProductIds) {
        downstream.forEach(neighbour -> pairs.add(Pair.of(dataProductId, neighbour)));
        upstream.forEach(neighbour -> pairs.add(Pair.of(neighbour, dataProductId)));
      }
    }
    return pairs;
  }

  private static Set<UUID> heldDataProducts(List<CollectionDAO.EntityRelationshipObject> has) {
    return has.stream().map(row -> UUID.fromString(row.getFromId())).collect(Collectors.toSet());
  }

  /**
   * Recounts each pair of two different data products from the stored asset edges, for a batch that
   * rewrites many assets' data products at once. A pair no asset edge connects any more loses its
   * rollup, but an edge drawn between the products stays.
   */
  public static void recountDataProductsLineage(Set<Pair<UUID, UUID>> pairs) {
    for (Pair<UUID, UUID> pair : pairs) {
      if (!pair.getLeft().equals(pair.getRight())) {
        recountDataProductLineage(
            Entity.getEntityReferenceById(Entity.DATA_PRODUCT, pair.getLeft(), Include.ALL),
            Entity.getEntityReferenceById(Entity.DATA_PRODUCT, pair.getRight(), Include.ALL));
      }
    }
  }

  private static void recountDataProductLineage(EntityReference from, EntityReference to) {
    int count =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .countDataProductsChildAssets(from.getId(), to.getId());
    storeDataProductCount(from, to, storedLineage(from, to), count);
  }

  /**
   * Applies the asset edges an entity's data product change adds or removes: each product it gains
   * or loses changes its pair with a neighbour's product by the entity's own edges to that
   * neighbour's assets. The neighbours' products do not change here, so the delta is exact.
   */
  public static void adjustDataProductsLineage(
      UUID entityId, String entityType, Collection<UUID> gained, Collection<UUID> lost) {
    if (!gained.isEmpty() || !lost.isEmpty()) {
      CollectionDAO.EntityRelationshipDAO dao = Entity.getCollectionDAO().relationshipDAO();
      Map<UUID, Long> downstream =
          edgesPerDataProduct(dao.findDownstreamDataProducts(entityId, entityType));
      Map<UUID, Long> upstream =
          edgesPerDataProduct(dao.findUpstreamDataProducts(entityId, entityType));
      gained.forEach(product -> adjustAgainstNeighbours(product, downstream, upstream, 1));
      lost.forEach(product -> adjustAgainstNeighbours(product, downstream, upstream, -1));
    }
  }

  private static Map<UUID, Long> edgesPerDataProduct(
      List<CollectionDAO.EntityRelationshipObject> has) {
    return has.stream()
        .collect(
            Collectors.groupingBy(row -> UUID.fromString(row.getFromId()), Collectors.counting()));
  }

  private static void adjustAgainstNeighbours(
      UUID product, Map<UUID, Long> downstream, Map<UUID, Long> upstream, int sign) {
    downstream.forEach(
        (neighbour, edges) ->
            adjustDataProductLineage(product, neighbour, sign * Math.toIntExact(edges)));
    upstream.forEach(
        (neighbour, edges) ->
            adjustDataProductLineage(neighbour, product, sign * Math.toIntExact(edges)));
  }

  /** Adds {@code delta} asset edges to a pair's rollup. A pair of one product is never written. */
  public static void adjustDataProductLineage(UUID fromId, UUID toId, int delta) {
    if (delta != 0 && !fromId.equals(toId)) {
      EntityReference from =
          Entity.getEntityReferenceById(Entity.DATA_PRODUCT, fromId, Include.ALL);
      EntityReference to = Entity.getEntityReferenceById(Entity.DATA_PRODUCT, toId, Include.ALL);
      LineageDetails stored = storedLineage(from, to);
      int current = stored == null ? 0 : nullOrDefault(stored.getAssetEdges(), 0);
      storeDataProductCount(from, to, stored, current + delta);
    }
  }

  private static LineageDetails storedLineage(EntityReference from, EntityReference to) {
    CollectionDAO.EntityRelationshipObject row =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .getRecord(from.getId(), to.getId(), Relationship.UPSTREAM.ordinal());
    return row == null ? null : JsonUtils.readValue(row.getJson(), LineageDetails.class);
  }

  /**
   * A stored edge whose source is not {@code ChildAssets} was drawn between the products. It keeps
   * its details and only carries the count, as {@code LineageRepository} does when an asset edge is
   * added under it, so no count replaces or deletes it
   * (ADR:2026-11-26-data-product-lineage-rollups-move-by-exact-deltas-and-drawn-edges-stay).
   */
  private static void storeDataProductCount(
      EntityReference from, EntityReference to, LineageDetails stored, int count) {
    if (stored == null) {
      insertLineage(count, from, to);
    } else if (count <= 0 && stored.getSource() == LineageDetails.Source.CHILD_ASSETS) {
      Entity.getCollectionDAO()
          .relationshipDAO()
          .delete(
              from.getId(),
              from.getType(),
              to.getId(),
              to.getType(),
              Relationship.UPSTREAM.ordinal());
      deleteLineageFromSearch(from, to, stored);
    } else {
      recountStoredLineage(from, to, stored, count);
    }
  }

  private static void recountStoredLineage(
      EntityReference from, EntityReference to, LineageDetails stored, int count) {
    Integer assetEdges = count > 0 ? count : null;
    if (!Objects.equals(stored.getAssetEdges(), assetEdges)) {
      stored.withAssetEdges(assetEdges);
      Entity.getCollectionDAO()
          .relationshipDAO()
          .insert(
              from.getId(),
              to.getId(),
              from.getType(),
              to.getType(),
              Relationship.UPSTREAM.ordinal(),
              JsonUtils.pojoToJson(stored));
      addLineageToSearch(from, to, stored);
    }
  }

  /**
   * The entity behind the single document a lineage root lookup returns, or empty when nothing is
   * indexed under the FQN. The hits are keyed by FQN, which is why {@link #ROOT_SOURCE_FIELDS}
   * carries it.
   */
  @SuppressWarnings("unchecked")
  public static Optional<EntityReference> lineageRoot(Map<String, Object> hitsByFqn) {
    return hitsByFqn.values().stream()
        .findFirst()
        .map(doc -> rootReference((Map<String, Object>) doc));
  }

  private static EntityReference rootReference(Map<String, Object> doc) {
    Object id = doc.get(ROOT_ID_FIELD);
    return new EntityReference()
        .withId(id == null ? null : UUID.fromString(id.toString()))
        .withType(Objects.toString(doc.get(Entity.FIELD_ENTITY_TYPE), null))
        .withFullyQualifiedName(Objects.toString(doc.get(Entity.FIELD_FULLY_QUALIFIED_NAME), null));
  }

  public static NodeInformation getNodeInformation(
      Map<String, Object> sourceMap,
      Integer entityDownstreamCount,
      Integer entityUpstreamCount,
      Integer nodeDepth) {
    // sourceMap.remove("upstreamLineage");
    return new NodeInformation()
        .withEntity(sourceMap)
        .withPaging(
            new LayerPaging()
                .withEntityDownstreamCount(entityDownstreamCount)
                .withEntityUpstreamCount(entityUpstreamCount))
        .withNodeDepth(nodeDepth);
  }

  /**
   * Batch-fetches entity-level tags from the database for multiple entities and replaces the mixed
   * ES tags with table-level-only tags. Uses a single DB query for all FQNs. Tier tags are excluded
   * since they have their own column in the Impact Analysis table.
   *
   * @param entityDocs list of entity source maps from ES
   */
  public static void replaceWithEntityLevelTagsBatch(List<Map<String, Object>> entityDocs) {
    if (entityDocs == null || entityDocs.isEmpty()) {
      return;
    }
    try {
      List<String> fqns = new ArrayList<>();
      for (Map<String, Object> doc : entityDocs) {
        String fqn = (String) doc.get("fullyQualifiedName");
        if (fqn != null) {
          fqns.add(fqn);
        }
      }
      if (fqns.isEmpty()) {
        return;
      }

      // Single DB query for all entity FQNs
      List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> batchResults =
          Entity.getCollectionDAO().tagUsageDAO().getTagsInternalBatch(fqns);

      // Group by FQN hash and convert to TagLabel, filtering out Tier
      Map<String, List<TagLabel>> tagsByFqnHash = new HashMap<>();
      List<TagLabel> allTags = new ArrayList<>();
      for (CollectionDAO.TagUsageDAO.TagLabelWithFQNHash result : batchResults) {
        TagLabel tag = result.toTagLabel();
        if (tag.getTagFQN() != null && !tag.getTagFQN().startsWith("Tier.")) {
          allTags.add(tag);
          tagsByFqnHash.computeIfAbsent(result.getTargetFQNHash(), k -> new ArrayList<>()).add(tag);
        }
      }

      // Batch-enrich all tags with name, displayName, description, style
      TagLabelUtil.applyTagCommonFieldsBatch(allTags);

      // Replace tags in each entity doc
      for (Map<String, Object> doc : entityDocs) {
        String fqn = (String) doc.get("fullyQualifiedName");
        if (fqn != null) {
          String fqnHash = FullyQualifiedName.buildHash(fqn);
          List<TagLabel> entityTags = tagsByFqnHash.getOrDefault(fqnHash, new ArrayList<>());
          doc.put("tags", entityTags);
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to fetch entity-level tags for Impact Analysis, falling back to ES tags", e);
    }
  }
}
