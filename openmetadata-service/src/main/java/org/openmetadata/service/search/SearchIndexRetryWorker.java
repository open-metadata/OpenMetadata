package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_FAILED;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING_RETRY_1;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING_RETRY_2;

import io.dropwizard.lifecycle.Managed;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

/**
 * Background worker that continuously retries failed live-indexing writes from
 * {@code search_index_retry_queue}.
 */
@Slf4j
public class SearchIndexRetryWorker implements Managed {

  private static final int CONSUMER_THREADS = 4;
  private static final int POLL_INTERVAL_SECONDS = 5;
  private static final int CLAIM_BATCH_SIZE = 25;
  private static final int MAX_CASCADE_REINDEX = 5000;
  private static final int SUSPENSION_REFRESH_INTERVAL_MS = 5000;
  private static final int CANDIDATE_TYPES_REFRESH_INTERVAL_MS = 60000;

  private static final List<String> ACTIVE_REINDEX_JOB_STATUSES =
      List.of("RUNNING", "READY", "STOPPING");
  private static final List<String> PURGEABLE_QUEUE_STATUSES =
      List.of(STATUS_PENDING, STATUS_PENDING_RETRY_1, STATUS_PENDING_RETRY_2, STATUS_FAILED);

  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final List<Thread> workerThreads = new ArrayList<>();
  private final Object scopeRefreshLock = new Object();
  private final Object candidateTypesLock = new Object();

  private volatile long lastScopeRefreshAt;
  private volatile String activeScopeSignature = "";
  private volatile long candidateTypesLastRefreshAt;
  private volatile List<String> cachedCandidateEntityTypes = Collections.emptyList();

  public SearchIndexRetryWorker(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
  }

  @Override
  public void start() {
    if (!running.compareAndSet(false, true)) {
      return;
    }

    for (int i = 0; i < CONSUMER_THREADS; i++) {
      final int workerId = i;
      Thread thread = new Thread(() -> runLoop(workerId), "search-index-retry-worker-" + workerId);
      thread.setDaemon(true);
      workerThreads.add(thread);
      thread.start();
    }

    LOG.info("Started search index retry worker with {} consumer threads", CONSUMER_THREADS);
  }

  @Override
  public void stop() {
    if (!running.compareAndSet(true, false)) {
      return;
    }

    for (Thread thread : workerThreads) {
      if (thread != null) {
        thread.interrupt();
      }
    }

    for (Thread thread : workerThreads) {
      if (thread == null) {
        continue;
      }
      try {
        thread.join(10_000);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
    workerThreads.clear();
    SearchIndexRetryQueue.clearSuspension();
    LOG.info("Stopped search index retry worker");
  }

  private void runLoop(int workerId) {
    while (running.get()) {
      try {
        refreshReindexSuspensionScopeIfNeeded();

        List<CollectionDAO.SearchIndexRetryQueueDAO.SearchIndexRetryRecord> claimed =
            collectionDAO.searchIndexRetryQueueDAO().claimPending(CLAIM_BATCH_SIZE);
        if (claimed.isEmpty()) {
          sleep(POLL_INTERVAL_SECONDS);
          continue;
        }

        for (CollectionDAO.SearchIndexRetryQueueDAO.SearchIndexRetryRecord record : claimed) {
          if (!running.get()) {
            return;
          }
          processRecord(record);
        }
      } catch (Exception e) {
        LOG.error("Unexpected error in search index retry worker {}", workerId, e);
        sleep(POLL_INTERVAL_SECONDS);
      }
    }
  }

  private void refreshReindexSuspensionScopeIfNeeded() {
    long now = System.currentTimeMillis();
    if (now - lastScopeRefreshAt < SUSPENSION_REFRESH_INTERVAL_MS) {
      return;
    }

    synchronized (scopeRefreshLock) {
      long currentTime = System.currentTimeMillis();
      if (currentTime - lastScopeRefreshAt < SUSPENSION_REFRESH_INTERVAL_MS) {
        return;
      }
      lastScopeRefreshAt = currentTime;

      List<SearchIndexJobRecord> activeJobs =
          collectionDAO.searchIndexJobDAO().findByStatusesWithLimit(ACTIVE_REINDEX_JOB_STATUSES, 1);

      if (activeJobs.isEmpty()) {
        if (!activeScopeSignature.isEmpty() || SearchIndexRetryQueue.isStreamingSuspended()) {
          SearchIndexRetryQueue.clearSuspension();
          activeScopeSignature = "";
          LOG.info("Cleared live search indexing suspension - no active reindex jobs");
        }
        return;
      }

      SearchIndexJobRecord activeJob = activeJobs.getFirst();
      EventPublisherJob jobConfiguration = null;
      try {
        if (activeJob.jobConfiguration() != null) {
          jobConfiguration =
              JsonUtils.readValue(activeJob.jobConfiguration(), EventPublisherJob.class);
        }
      } catch (Exception e) {
        LOG.warn("Failed to parse job configuration for active reindex job {}", activeJob.id(), e);
      }

      Set<String> requestedEntities =
          normalizeReindexEntities(
              jobConfiguration != null ? jobConfiguration.getEntities() : null);
      Set<String> searchableEntities = searchRepository.getSearchEntities();

      boolean containsAllToken =
          requestedEntities.stream().anyMatch(entity -> "all".equalsIgnoreCase(entity));
      Set<String> suspendedTypes =
          containsAllToken ? new HashSet<>(searchableEntities) : new HashSet<>(requestedEntities);
      suspendedTypes.retainAll(searchableEntities);

      boolean suspendAll =
          !searchableEntities.isEmpty() && suspendedTypes.containsAll(searchableEntities);
      String newSignature = buildScopeSignature(activeJob.id(), suspendedTypes, suspendAll);

      if (newSignature.equals(activeScopeSignature)) {
        return;
      }

      activeScopeSignature = newSignature;
      SearchIndexRetryQueue.updateSuspension(suspendedTypes, suspendAll);

      if (suspendAll) {
        int purged =
            collectionDAO.searchIndexRetryQueueDAO().deleteByStatuses(PURGEABLE_QUEUE_STATUSES);
        LOG.info(
            "Activated live search indexing suspension for all entity types using reindex job {} and purged {} retry queue rows",
            activeJob.id(),
            purged);
      } else {
        LOG.info(
            "Activated live search indexing suspension for {} entity types using reindex job {}",
            suspendedTypes.size(),
            activeJob.id());
      }
    }
  }

  private String buildScopeSignature(String jobId, Set<String> suspendedTypes, boolean suspendAll) {
    List<String> sorted = new ArrayList<>(suspendedTypes);
    Collections.sort(sorted);
    return jobId + "|" + suspendAll + "|" + String.join(",", sorted);
  }

  private Set<String> normalizeReindexEntities(Set<String> rawEntities) {
    Set<String> normalized = new HashSet<>();
    if (rawEntities == null) {
      return normalized;
    }
    for (String entityType : rawEntities) {
      String value = SearchIndexRetryQueue.normalize(entityType);
      if (!value.isEmpty()) {
        normalized.add(value);
      }
    }
    return normalized;
  }

  private void processRecord(CollectionDAO.SearchIndexRetryQueueDAO.SearchIndexRetryRecord record) {
    String retryStatus = SearchIndexRetryQueue.normalize(record.getStatus());
    if (retryStatus.isEmpty()) {
      retryStatus = STATUS_PENDING;
    }
    String nextRetryStatus = nextRetryStatus(retryStatus);

    try {
      if (SearchIndexRetryQueue.isSuspendAllStreaming()) {
        collectionDAO
            .searchIndexRetryQueueDAO()
            .deleteByEntity(record.getEntityId(), record.getEntityFqn());
        return;
      }

      EntityReference root = resolveEntityReference(record);
      if (root != null) {
        if (SearchIndexRetryQueue.isEntityTypeSuspended(root.getType())) {
          collectionDAO
              .searchIndexRetryQueueDAO()
              .deleteByEntity(record.getEntityId(), record.getEntityFqn());
          return;
        }

        reindexEntityCascade(root);
        collectionDAO
            .searchIndexRetryQueueDAO()
            .deleteByEntity(record.getEntityId(), record.getEntityFqn());
        return;
      }

      // Hard-deleted entities are no longer resolvable from DB; remove stale docs by ID.
      String entityId = SearchIndexRetryQueue.normalize(record.getEntityId());
      if (!entityId.isEmpty()) {
        removeStaleEntityById(entityId);
        collectionDAO
            .searchIndexRetryQueueDAO()
            .deleteByEntity(record.getEntityId(), record.getEntityFqn());
        return;
      }

      collectionDAO
          .searchIndexRetryQueueDAO()
          .updateFailureAndStatus(
              record.getEntityId(),
              record.getEntityFqn(),
              "Unable to resolve entity for retry from entityId/entityFqn",
              nextRetryStatus);
    } catch (Exception e) {
      collectionDAO
          .searchIndexRetryQueueDAO()
          .updateFailureAndStatus(
              record.getEntityId(),
              record.getEntityFqn(),
              SearchIndexRetryQueue.failureReason("retryFailed", e),
              nextRetryStatus);
      LOG.debug(
          "Retry failed for entityId={} entityFqn={} nextStatus={}: {}",
          record.getEntityId(),
          record.getEntityFqn(),
          nextRetryStatus,
          e.getMessage());
    }
  }

  private EntityReference resolveEntityReference(
      CollectionDAO.SearchIndexRetryQueueDAO.SearchIndexRetryRecord record) {
    String entityId = SearchIndexRetryQueue.normalize(record.getEntityId());
    String entityFqn = SearchIndexRetryQueue.normalize(record.getEntityFqn());

    if (!entityId.isEmpty()) {
      try {
        UUID uuid = UUID.fromString(entityId);
        EntityReference byId = resolveById(uuid);
        if (byId != null) {
          return byId;
        }
      } catch (IllegalArgumentException ignored) {
        LOG.debug("Invalid entityId {} in retry queue", entityId);
      }
    }

    if (!entityFqn.isEmpty()) {
      EntityReference byFqn = resolveByFqn(entityFqn);
      if (byFqn != null) {
        return byFqn;
      }
    }
    return null;
  }

  private EntityReference resolveById(UUID id) {
    List<String> typesToTry = candidateEntityTypes();
    for (String entityType : typesToTry) {
      try {
        EntityReference ref = Entity.getEntityReferenceById(entityType, id, Include.ALL);
        if (ref != null && ref.getId() != null) {
          return ref;
        }
      } catch (Exception ignored) {
        // Continue trying other entity types.
      }
    }
    return null;
  }

  private EntityReference resolveByFqn(String fqn) {
    List<String> typesToTry = candidateEntityTypes();
    for (String entityType : typesToTry) {
      try {
        EntityReference ref = Entity.getEntityReferenceByName(entityType, fqn, Include.ALL);
        if (ref != null && ref.getId() != null) {
          return ref;
        }
      } catch (Exception ignored) {
        // Continue trying other entity types.
      }
    }
    return null;
  }

  private List<String> candidateEntityTypes() {
    long now = System.currentTimeMillis();
    if (now - candidateTypesLastRefreshAt < CANDIDATE_TYPES_REFRESH_INTERVAL_MS
        && !cachedCandidateEntityTypes.isEmpty()) {
      return cachedCandidateEntityTypes;
    }

    synchronized (candidateTypesLock) {
      long currentTime = System.currentTimeMillis();
      if (currentTime - candidateTypesLastRefreshAt < CANDIDATE_TYPES_REFRESH_INTERVAL_MS
          && !cachedCandidateEntityTypes.isEmpty()) {
        return cachedCandidateEntityTypes;
      }

      Set<String> indexedTypes = searchRepository.getSearchEntities();
      List<String> resolved = new ArrayList<>();
      for (String entityType : Entity.getEntityList()) {
        if (!indexedTypes.contains(entityType)) {
          continue;
        }
        try {
          EntityRepository<?> repository = Entity.getEntityRepository(entityType);
          if (repository != null) {
            resolved.add(entityType);
          }
        } catch (Exception ignored) {
          // Skip non-entity index mappings.
        }
      }

      cachedCandidateEntityTypes = List.copyOf(resolved);
      candidateTypesLastRefreshAt = currentTime;
      return cachedCandidateEntityTypes;
    }
  }

  private void reindexEntityCascade(EntityReference root) throws Exception {
    ArrayDeque<EntityReference> queue = new ArrayDeque<>();
    Set<String> visited = new HashSet<>();
    List<EntityInterface> entitiesToIndex = new ArrayList<>();
    queue.add(root);
    int processed = 0;

    while (!queue.isEmpty() && processed < MAX_CASCADE_REINDEX) {
      EntityReference current = queue.poll();
      if (current == null || current.getId() == null || current.getType() == null) {
        continue;
      }

      String visitKey = current.getType() + ":" + current.getId();
      if (!visited.add(visitKey)) {
        continue;
      }

      if (!searchRepository.checkIfIndexingIsSupported(current.getType())) {
        continue;
      }

      EntityInterface entity;
      try {
        entity = Entity.getEntity(current, "*", Include.ALL);
      } catch (Exception ex) {
        continue;
      }

      if (entity == null) {
        continue;
      }

      entitiesToIndex.add(entity);
      processed++;

      addChildrenByRelation(
          queue,
          entity.getId(),
          entity.getEntityReference().getType(),
          Relationship.CONTAINS.ordinal());

      if (Entity.DOMAIN.equals(entity.getEntityReference().getType())
          || Entity.DATA_PRODUCT.equals(entity.getEntityReference().getType())) {
        addChildrenByRelation(
            queue,
            entity.getId(),
            entity.getEntityReference().getType(),
            Relationship.HAS.ordinal());
      }
    }

    if (processed >= MAX_CASCADE_REINDEX) {
      LOG.warn(
          "Stopped retry cascade early after reaching max cascade limit for root {}:{}",
          root.getType(),
          root.getId());
    }

    if (!entitiesToIndex.isEmpty()) {
      upsertEntitiesInBulk(entitiesToIndex);
    }
  }

  private void upsertEntitiesInBulk(List<EntityInterface> entitiesToIndex) throws Exception {
    if (entitiesToIndex.size() == 1) {
      upsertEntityDirect(entitiesToIndex.getFirst());
      return;
    }

    Map<String, List<EntityInterface>> entitiesByType = new HashMap<>();
    for (EntityInterface entity : entitiesToIndex) {
      if (entity == null || entity.getEntityReference() == null) {
        continue;
      }
      String entityType = SearchIndexRetryQueue.normalize(entity.getEntityReference().getType());
      if (entityType.isEmpty()) {
        continue;
      }
      entitiesByType.computeIfAbsent(entityType, ignored -> new ArrayList<>()).add(entity);
    }

    if (entitiesByType.isEmpty()) {
      return;
    }

    Set<String> failedEntityIds = ConcurrentHashMap.newKeySet();
    BulkSink bulkSink = searchRepository.createBulkSink(200, 5, 10L * 1024L * 1024L);
    bulkSink.setFailureCallback(
        (entityType, entityId, entityFqn, errorMessage) -> {
          if (entityId != null && !entityId.isEmpty()) {
            failedEntityIds.add(entityId);
          }
        });

    try {
      for (Map.Entry<String, List<EntityInterface>> entry : entitiesByType.entrySet()) {
        Map<String, Object> context = new HashMap<>();
        context.put(ReindexingUtil.ENTITY_TYPE_KEY, entry.getKey());
        bulkSink.write(entry.getValue(), context);
      }

      boolean flushComplete = bulkSink.flushAndAwait(60);
      if (!flushComplete) {
        throw new RuntimeException("Retry bulk flush timed out");
      }
    } finally {
      try {
        bulkSink.close();
      } catch (Exception e) {
        LOG.warn("Failed to close retry bulk sink cleanly", e);
      }
    }

    if (!failedEntityIds.isEmpty()) {
      throw new RuntimeException(
          "Retry bulk indexing failed for " + failedEntityIds.size() + " entities");
    }
  }

  private void upsertEntityDirect(EntityInterface entity) throws Exception {
    if (entity == null || entity.getEntityReference() == null || entity.getId() == null) {
      return;
    }
    String entityType = entity.getEntityReference().getType();
    IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
    if (indexMapping == null) {
      return;
    }
    Object doc =
        searchRepository
            .getSearchIndexFactory()
            .buildIndex(entityType, entity)
            .buildSearchIndexDoc();
    searchRepository
        .getSearchClient()
        .createEntity(
            indexMapping.getIndexName(searchRepository.getClusterAlias()),
            entity.getId().toString(),
            JsonUtils.pojoToJson(doc));
  }

  private void addChildrenByRelation(
      ArrayDeque<EntityReference> queue, UUID fromId, String fromEntityType, int relation) {
    List<CollectionDAO.EntityRelationshipRecord> children =
        collectionDAO.relationshipDAO().findTo(fromId, fromEntityType, relation);
    for (CollectionDAO.EntityRelationshipRecord child : children) {
      if (child == null || child.getId() == null || child.getType() == null) {
        continue;
      }
      if (!searchRepository.checkIfIndexingIsSupported(child.getType())) {
        continue;
      }
      queue.add(new EntityReference().withId(child.getId()).withType(child.getType()));
    }
  }

  private void removeStaleEntityById(String entityId) {
    for (String entityType : searchRepository.getSearchEntities()) {
      IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
      if (indexMapping == null) {
        continue;
      }
      try {
        searchRepository
            .getSearchClient()
            .deleteEntity(indexMapping.getIndexName(searchRepository.getClusterAlias()), entityId);
      } catch (Exception ignored) {
        // Ignore not-found / index mismatch and continue best-effort cleanup.
      }
    }
  }

  private void sleep(int seconds) {
    try {
      Thread.sleep(seconds * 1000L);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private String nextRetryStatus(String currentStatus) {
    return switch (currentStatus) {
      case STATUS_PENDING -> STATUS_PENDING_RETRY_1;
      case STATUS_PENDING_RETRY_1 -> STATUS_PENDING_RETRY_2;
      case STATUS_PENDING_RETRY_2 -> STATUS_FAILED;
      default -> STATUS_FAILED;
    };
  }
}
