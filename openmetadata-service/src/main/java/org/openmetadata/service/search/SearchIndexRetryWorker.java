package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_FAILED;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_IN_PROGRESS;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING_RETRY_1;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING_RETRY_2;
import static org.openmetadata.service.search.SearchIndexRetryQueue.normalize;

import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import io.dropwizard.lifecycle.Managed;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Tags;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexRetryQueueDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexRetryQueueDAO.SearchIndexRetryRecord;
import os.org.opensearch.client.opensearch._types.OpenSearchException;

/**
 * Background worker that continuously retries failed live-indexing writes from {@code
 * search_index_retry_queue}.
 *
 * <p>Resilience behaviour:
 *
 * <ul>
 *   <li>Pre-check: skips claiming when the search client is unreachable, with exponential backoff.
 *   <li>Error classification: uses HTTP status codes from ES/OS exceptions to distinguish
 *       non-retryable client errors (4xx except 429) from retryable server/network errors.
 *   <li>Stale recovery: reclaims records stuck IN_PROGRESS for longer than the stale threshold.
 * </ul>
 */
@Slf4j
public class SearchIndexRetryWorker implements Managed {

  private static final int CONSUMER_THREADS = 4;
  private static final int POLL_INTERVAL_SECONDS = 5;
  private static final int CLAIM_BATCH_SIZE = 25;
  private static final int MAX_CASCADE_REINDEX = 5000;
  private static final int CASCADE_BATCH_SIZE = 200;
  private static final int MAX_BACKOFF_SECONDS = 60;
  private static final long RETRY_BASE_DELAY_MILLIS = 10_000L;
  private static final long RETRY_MAX_DELAY_MILLIS = 3_600_000L;
  private static final int MAX_RETRY_DELAY_DOUBLINGS = 20;

  /** With the hourly cap, about a day of retries before a transient failure is dead-lettered. */
  static final int RETRYABLE_ATTEMPTS = 32;

  private static final List<String> QUEUE_STATUSES =
      List.of(
          STATUS_PENDING,
          STATUS_PENDING_RETRY_1,
          STATUS_PENDING_RETRY_2,
          STATUS_IN_PROGRESS,
          STATUS_FAILED);
  private static final Map<String, AtomicLong> QUEUE_DEPTH = registerQueueDepthGauges();
  private static final int CANDIDATE_TYPES_REFRESH_INTERVAL_MS = 60000;
  private static final long MAINTENANCE_INTERVAL_MS = 60_000;
  private static final long STALE_THRESHOLD_MS = 10 * 60 * 1000;

  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;
  private final SearchDocumentRebuilder rebuilder;
  private final SearchScopeRepair scopeRepair;
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final List<Thread> workerThreads = new ArrayList<>();
  private final Object candidateTypesLock = new Object();
  private final Object maintenanceLock = new Object();

  private volatile long lastMaintenanceAt;
  private volatile long candidateTypesLastRefreshAt;
  private volatile List<String> cachedCandidateEntityTypes = Collections.emptyList();
  private final AtomicInteger consecutiveUnavailableCount = new AtomicInteger();

  public SearchIndexRetryWorker(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
    this.rebuilder = new SearchDocumentRebuilder(searchRepository);
    this.scopeRepair = new SearchScopeRepair(searchRepository, rebuilder);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

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
    LOG.info("Stopped search index retry worker");
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------

  private void runLoop(int workerId) {
    while (running.get()) {
      try {
        runMaintenanceIfDue();

        if (!waitForClientAvailability(workerId)) {
          continue;
        }

        List<SearchIndexRetryRecord> claimed =
            collectionDAO.searchIndexRetryQueueDAO().claimPending(CLAIM_BATCH_SIZE);
        if (claimed.isEmpty()) {
          sleep(POLL_INTERVAL_SECONDS);
          continue;
        }

        for (SearchIndexRetryRecord record : claimed) {
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

  // ---------------------------------------------------------------------------
  // Record processing
  // ---------------------------------------------------------------------------

  private void processRecord(SearchIndexRetryRecord record) {
    try {
      if (SearchRepairScope.ENTITY_TYPE.equals(normalize(record.getEntityType()))) {
        repairScope(record);
        return;
      }
      EntityReference root = resolveEntityReference(record);
      if (root != null) {
        EntityInterface<?> rootEntity = reindexEntityCascade(root);
        propagateAfterRetry(rootEntity, record.getFailureReason());
        completeClaim(record);
        return;
      }

      String entityId = normalize(record.getEntityId());
      if (!entityId.isEmpty()) {
        rebuilder.removeDocument(entityId, record.getEntityType());
        completeClaim(record);
        return;
      }

      recordRetryFailure(
          record,
          "Unable to resolve entity for retry from entityId/entityFqn",
          nextRetryStatus(record.getRetryCount()));
    } catch (Exception e) {
      handleProcessingError(record, e);
    }
  }

  /**
   * Rebuilds the documents a recorded repair still matches. A scope too large for one pass is
   * queued again; the next pass skips what this one rewrote.
   */
  private void repairScope(SearchIndexRetryRecord record) throws Exception {
    SearchRepairScope scope = SearchIndexRetryQueue.getRepairScope(record.getFailureReason());
    if (scope == null) {
      recordRetryFailure(record, "Search repair row carries no scope", STATUS_FAILED);
      return;
    }
    boolean settled = scopeRepair.repair(scope);
    if (completeClaim(record) && !settled) {
      SearchIndexRetryQueue.enqueueRepair(
          scope, "Continuing a search repair that matched more documents than one pass rebuilds");
    }
  }

  private void handleProcessingError(SearchIndexRetryRecord record, Exception e) {
    String reason = SearchIndexRetryQueue.failureReason("retryFailed", e);
    if (isRetryable(e)) {
      String nextStatus = retryableNextStatus(record.getRetryCount());
      if (!recordRetryFailure(record, reason, nextStatus)) {
        return;
      }
      if (STATUS_FAILED.equals(nextStatus)) {
        Metrics.counter("search.retry.processed", "result", "exhausted").increment();
        LOG.warn(
            "Retryable failures hit the {}-attempt ceiling for entityId={} entityFqn={}; "
                + "dead-lettering to FAILED: {}",
            RETRYABLE_ATTEMPTS,
            record.getEntityId(),
            record.getEntityFqn(),
            e.getMessage());
      } else {
        LOG.debug(
            "Retry failed for entityId={} entityFqn={} nextStatus={}: {}",
            record.getEntityId(),
            record.getEntityFqn(),
            nextStatus,
            e.getMessage());
      }
    } else {
      if (!recordRetryFailure(record, reason, STATUS_FAILED)) {
        return;
      }
      Metrics.counter("search.retry.processed", "result", "non_retryable").increment();
      LOG.warn(
          "Non-retryable error for entityId={} entityFqn={}, marking as FAILED: {}",
          record.getEntityId(),
          record.getEntityFqn(),
          e.getMessage());
    }
  }

  boolean recordRetryFailure(SearchIndexRetryRecord record, String reason, String status) {
    String retainedReason =
        SearchIndexRetryQueue.preserveRetryContext(record.getFailureReason(), reason);
    int updated =
        collectionDAO
            .searchIndexRetryQueueDAO()
            .updateFailureAndRetryCount(
                record.getEntityId(),
                record.getEntityFqn(),
                retainedReason,
                status,
                record.getClaimToken(),
                System.currentTimeMillis() + retryDelayMillis(record.getRetryCount() + 1));
    if (updated == 0) {
      recordSuperseded(record);
      return false;
    }
    Metrics.counter("search.retry.processed", "result", "failure").increment();
    return true;
  }

  boolean completeClaim(SearchIndexRetryRecord record) {
    int deleted =
        collectionDAO
            .searchIndexRetryQueueDAO()
            .deleteClaimed(record.getEntityId(), record.getEntityFqn(), record.getClaimToken());
    if (deleted == 0) {
      recordSuperseded(record);
      return false;
    }
    Metrics.counter("search.retry.processed", "result", "success").increment();
    return true;
  }

  private void recordSuperseded(SearchIndexRetryRecord record) {
    Metrics.counter("search.retry.processed", "result", "superseded").increment();
    LOG.debug(
        "Search retry claim was superseded for entityId={} entityFqn={}",
        record.getEntityId(),
        record.getEntityFqn());
  }

  // ---------------------------------------------------------------------------
  // Entity resolution
  // ---------------------------------------------------------------------------

  private EntityReference resolveEntityReference(SearchIndexRetryRecord record) {
    String entityId = normalize(record.getEntityId());
    String entityFqn = normalize(record.getEntityFqn());
    String entityType = normalize(record.getEntityType());

    if (!entityId.isEmpty()) {
      try {
        UUID uuid = UUID.fromString(entityId);
        EntityReference byHint = resolveByIdWithHint(uuid, entityType);
        if (byHint != null) {
          return byHint;
        }
        EntityReference byId = resolveById(uuid);
        if (byId != null) {
          return byId;
        }
      } catch (IllegalArgumentException ignored) {
        LOG.debug("Invalid entityId {} in retry queue", entityId);
      }
    }

    if (!entityFqn.isEmpty()) {
      EntityReference byHint = resolveByFqnWithHint(entityFqn, entityType);
      if (byHint != null) {
        return byHint;
      }
      return resolveByFqn(entityFqn);
    }
    return null;
  }

  private EntityReference resolveByIdWithHint(UUID id, String entityType) {
    if (entityType.isEmpty()) {
      return null;
    }
    try {
      EntityReference ref = Entity.getEntityReferenceById(entityType, id, Include.ALL);
      if (ref != null && ref.getId() != null) {
        return ref;
      }
    } catch (EntityNotFoundException ignored) {
      // Not found with hint, fall through.
    }
    return null;
  }

  private EntityReference resolveByFqnWithHint(String fqn, String entityType) {
    if (entityType.isEmpty()) {
      return null;
    }
    try {
      EntityReference ref = Entity.getEntityReferenceByName(entityType, fqn, Include.ALL);
      if (ref != null && ref.getId() != null) {
        return ref;
      }
    } catch (EntityNotFoundException ignored) {
      // Not found with hint, fall through.
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
      } catch (EntityNotFoundException ignored) {
        // Entity not found for this type, continue trying others.
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
      } catch (EntityNotFoundException ignored) {
        // Entity not found for this type, continue trying others.
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

  // ---------------------------------------------------------------------------
  // Reindexing
  // ---------------------------------------------------------------------------

  EntityInterface<?> reindexEntityCascade(EntityReference root) throws Exception {
    ArrayDeque<EntityReference> queue = new ArrayDeque<>();
    Set<String> visited = new HashSet<>();
    List<EntityInterface<?>> entitiesToIndex = new ArrayList<>();
    Map<UUID, Long> relationshipRevisions = new HashMap<>();
    queue.add(root);
    int processed = 0;
    EntityInterface<?> rootEntity = null;
    final long cascadeStartedAt = System.currentTimeMillis();
    long batchReadAt = cascadeStartedAt;

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

      if (entitiesToIndex.isEmpty()) {
        batchReadAt = System.currentTimeMillis();
      }
      SearchDocumentRebuilder.StableEntitySnapshot snapshot;
      try {
        snapshot = rebuilder.load(current);
      } catch (EntityNotFoundException ex) {
        rebuilder.removeDocument(current.getId().toString(), current.getType());
        continue;
      }

      EntityInterface<?> entity = snapshot.entity();
      if (entity == null) {
        throw new IllegalStateException(
            "Loaded an empty entity while processing search retry for " + current.getId());
      }
      if (root.getId().equals(current.getId()) && root.getType().equals(current.getType())) {
        rootEntity = entity;
      }

      entitiesToIndex.add(entity);
      if (snapshot.relationshipRevision() != null) {
        relationshipRevisions.put(entity.getId(), snapshot.relationshipRevision());
      }
      processed++;

      if (entitiesToIndex.size() >= CASCADE_BATCH_SIZE) {
        rebuilder.write(entitiesToIndex, relationshipRevisions, batchReadAt);
        entitiesToIndex.clear();
        relationshipRevisions.clear();
      }

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

    if (!entitiesToIndex.isEmpty()) {
      rebuilder.write(entitiesToIndex, relationshipRevisions, batchReadAt);
    }
    if (!queue.isEmpty()) {
      repairRestOfCascade(root, cascadeStartedAt);
    }
    return rootEntity;
  }

  /**
   * A cascade stops after {@link #MAX_CASCADE_REINDEX} entities; the documents that inherit from
   * the root and were not rebuilt since the cascade started are recorded for repair instead.
   */
  private void repairRestOfCascade(EntityReference root, long cascadeStartedAt) {
    LOG.info(
        "Retry cascade for {}:{} reached {} entities; repairing the rest from search",
        root.getType(),
        root.getId(),
        MAX_CASCADE_REINDEX);
    searchRepository
        .inheritingDocuments(root, cascadeStartedAt)
        .ifPresent(
            scope ->
                SearchIndexRetryQueue.enqueueRepair(
                    scope, "Retry cascade passed " + MAX_CASCADE_REINDEX + " descendants"));
  }

  void propagateAfterRetry(EntityInterface<?> rootEntity, String failureReason) throws IOException {
    ChangeDescription propagationChangeDescription =
        SearchIndexRetryQueue.getPropagationContext(failureReason);
    if (rootEntity != null && propagationChangeDescription != null) {
      searchRepository.propagateEntityAfterRetry(rootEntity, propagationChangeDescription);
    }
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

  // ---------------------------------------------------------------------------
  // Resilience: client availability, backoff, and error classification
  // ---------------------------------------------------------------------------

  /**
   * Returns {@code true} if the search client is reachable. When unreachable, backs off
   * exponentially (5 s → 10 s → 20 s → … → 60 s cap) so the worker does not burn retries while
   * the search cluster is down.
   */
  private boolean waitForClientAvailability(int workerId) {
    if (searchRepository.getSearchClient().isClientAvailable()) {
      consecutiveUnavailableCount.set(0);
      return true;
    }
    int attempt = consecutiveUnavailableCount.incrementAndGet();
    int backoffSeconds =
        Math.min(POLL_INTERVAL_SECONDS * (1 << Math.min(attempt, 4)), MAX_BACKOFF_SECONDS);
    Metrics.counter("search.retry.client.unavailable").increment();
    LOG.warn(
        "Search client unavailable, worker {} backing off for {}s (attempt {})",
        workerId,
        backoffSeconds,
        attempt);
    sleep(backoffSeconds);
    return false;
  }

  /**
   * Classifies an exception as retryable or not by inspecting the cause chain for ES/OS exceptions
   * that carry an HTTP status code. Classification rules:
   *
   * <ul>
   *   <li>{@link IOException} (connection refused, timeout) → always retryable
   *   <li>4xx (except 429) → non-retryable (bad mapping, field limit, version conflict, …)
   *   <li>429 / 5xx → retryable (rate-limited, server error, cluster overload)
   *   <li>No status code found → defaults to retryable (conservative)
   * </ul>
   */
  boolean isRetryable(Throwable t) {
    if (t instanceof IOException) {
      return true;
    }
    int status = extractSearchStatusCode(t);
    if (status > 0) {
      return SearchIndexRetryQueue.isRetryableStatusCode(status);
    }
    return true;
  }

  private int extractSearchStatusCode(Throwable t) {
    Throwable current = t;
    while (current != null) {
      if (current instanceof ElasticsearchException esEx) {
        return esEx.status();
      }
      if (current instanceof OpenSearchException osEx) {
        return osEx.status();
      }
      Throwable cause = current.getCause();
      if (cause == current) {
        break;
      }
      current = cause;
    }
    return -1;
  }

  // ---------------------------------------------------------------------------
  // Scheduling
  // ---------------------------------------------------------------------------

  /** Once a minute: reclaim abandoned claims and publish the queue depth. */
  private void runMaintenanceIfDue() {
    long now = System.currentTimeMillis();
    if (now - lastMaintenanceAt < MAINTENANCE_INTERVAL_MS) {
      return;
    }

    synchronized (maintenanceLock) {
      long currentTime = System.currentTimeMillis();
      if (currentTime - lastMaintenanceAt < MAINTENANCE_INTERVAL_MS) {
        return;
      }
      lastMaintenanceAt = currentTime;

      try {
        publishQueueDepth();
      } catch (JdbiException e) {
        LOG.warn("Failed to publish search retry queue depth: {}", e.getMessage());
      }
      try {
        java.sql.Timestamp cutoff = new java.sql.Timestamp(currentTime - STALE_THRESHOLD_MS);
        int recovered = collectionDAO.searchIndexRetryQueueDAO().recoverStaleInProgress(cutoff);
        if (recovered > 0) {
          Metrics.counter("search.retry.stale.recovered").increment(recovered);
          LOG.info("Recovered {} stale IN_PROGRESS retry queue records", recovered);
        }
      } catch (Exception e) {
        LOG.warn("Failed to recover stale IN_PROGRESS records: {}", e.getMessage());
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private void sleep(int seconds) {
    try {
      Thread.sleep(seconds * 1000L);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private String nextRetryStatus(int retryCount) {
    return switch (retryCount) {
      case 0 -> STATUS_PENDING_RETRY_1;
      case 1 -> STATUS_PENDING_RETRY_2;
      default -> STATUS_FAILED;
    };
  }

  /**
   * Next status for a transient failure. The row is retried after {@link #retryDelayMillis} until
   * {@link #RETRYABLE_ATTEMPTS} attempts are spent, then dead-lettered as FAILED.
   */
  String retryableNextStatus(int retryCount) {
    String status;
    if (retryCount == 0) {
      status = STATUS_PENDING_RETRY_1;
    } else if (retryCount < RETRYABLE_ATTEMPTS - 1) {
      status = STATUS_PENDING_RETRY_2;
    } else {
      status = STATUS_FAILED;
    }
    return status;
  }

  /** Wait before the next attempt of a row that has failed {@code failures} times. */
  static long retryDelayMillis(final int failures) {
    final int doublings = Math.clamp(failures - 1L, 0, MAX_RETRY_DELAY_DOUBLINGS);
    return Math.min(RETRY_MAX_DELAY_MILLIS, RETRY_BASE_DELAY_MILLIS << doublings);
  }

  /** Publishes how many rows wait in each state, so a growing backlog or dead letters can alert. */
  void publishQueueDepth() {
    final SearchIndexRetryQueueDAO retryQueueDAO = collectionDAO.searchIndexRetryQueueDAO();
    QUEUE_DEPTH.forEach((status, depth) -> depth.set(retryQueueDAO.countByStatus(status)));
  }

  private static Map<String, AtomicLong> registerQueueDepthGauges() {
    final Map<String, AtomicLong> depths = new LinkedHashMap<>();
    for (final String status : QUEUE_STATUSES) {
      depths.put(
          status,
          Metrics.gauge("search.retry.queue.depth", Tags.of("status", status), new AtomicLong()));
    }
    return Map.copyOf(depths);
  }
}
