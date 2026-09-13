package org.openmetadata.service.entity.write;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.rdf.RdfTagUpdater;
import org.openmetadata.service.search.SearchIndexRetryQueue;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.LineageUtil;
import org.openmetadata.service.util.PostCommitActionQueue;

/** Coordinates ownership, retry checkpoints and ordered publication of committed effects. */
@Slf4j
final class EntityPostCommitEffects {
  private final String entityType;
  private final DeferredCacheInvalidations cacheInvalidations;

  EntityPostCommitEffects(String entityType, DeferredCacheInvalidations cacheInvalidations) {
    this.entityType = entityType;
    this.cacheInvalidations = cacheInvalidations;
  }

  Scope newScope() {
    return new Scope();
  }

  /**
   * Holds the per-thread RDF + lineage-ES + Redis-L2-cache deferral collectors for one flush. {@link
   * #reopenForAttempt()} resets all three collectors at the start of every deadlock-retry attempt so
   * a replayed body never inherits closures/keys captured by a rolled-back attempt. {@link
   * #finish(boolean)} drains all three once on success (running the captured work post-commit on the
   * request thread) or clears all three on failure. A scope only owns (and therefore drains) the
   * collectors it actually opened — an inner flush nested under an outer scope leaves draining to the
   * outer owner, so a retried inner flush never double-enqueues into the outer collector.
   */
  final class Scope {
    private boolean opened;
    private boolean ownsRdf;
    private boolean ownsLineageEs;
    private boolean ownsSearchWrite;
    private boolean ownsCache;
    private boolean ownsPostCommitActions;
    private int rdfCheckpoint;
    private int lineageEsCheckpoint;
    private int searchWriteCheckpoint;
    private int postCommitActionCheckpoint;

    void reopenForAttempt() {
      if (opened) {
        resetForReplay();
      } else {
        openCollectors();
        opened = true;
      }
    }

    /** First attempt: take ownership of any collector not already open and checkpoint the rest. */
    private void openCollectors() {
      rdfCheckpoint = RdfTagUpdater.checkpoint();
      lineageEsCheckpoint = LineageUtil.checkpoint();
      searchWriteCheckpoint = SearchRepository.searchWriteCheckpoint();
      postCommitActionCheckpoint = PostCommitActionQueue.checkpoint();
      ownsRdf = RdfTagUpdater.beginDeferral();
      ownsLineageEs = LineageUtil.beginLineageDeferral();
      ownsSearchWrite = SearchRepository.beginSearchWriteDeferral();
      ownsCache = cacheInvalidations.begin();
      ownsPostCommitActions = PostCommitActionQueue.begin();
    }

    /**
     * Deadlock replay: clear an owned collector outright, but for a collector owned by an outer
     * scope only roll back this flush's own contributions (back to the entry checkpoint) so the
     * inner replay never double-enqueues into the outer owner's collector. The cache collector
     * de-duplicates by (type, id), so re-recording a key on replay is idempotent and needs no
     * checkpoint.
     */
    private void resetForReplay() {
      if (ownsRdf) {
        RdfTagUpdater.clearDeferred();
        RdfTagUpdater.beginDeferral();
      } else {
        RdfTagUpdater.rollbackToCheckpoint(rdfCheckpoint);
      }
      if (ownsLineageEs) {
        LineageUtil.clearLineageDeferred();
        LineageUtil.beginLineageDeferral();
      } else {
        LineageUtil.rollbackToCheckpoint(lineageEsCheckpoint);
      }
      if (ownsSearchWrite) {
        SearchRepository.clearSearchWriteDeferred();
        SearchRepository.beginSearchWriteDeferral();
      } else {
        SearchRepository.rollbackSearchWriteToCheckpoint(searchWriteCheckpoint);
      }
      if (ownsCache) {
        cacheInvalidations.clear();
        cacheInvalidations.begin();
      }
      if (ownsPostCommitActions) {
        PostCommitActionQueue.clear();
        PostCommitActionQueue.begin();
      } else {
        PostCommitActionQueue.rollbackToCheckpoint(postCommitActionCheckpoint);
      }
    }

    void finish(boolean committed) {
      if (committed) {
        drain();
      } else {
        clear();
      }
    }

    /**
     * Drain all post-commit externals synchronously on the request thread: Cache-L2 invalidation
     * first (so the next GET-by-id/by-name rebuilds fresh from DB), then the RDF / lineage-ES /
     * rename-cascade search rewrites. Running inline post-commit keeps search and lineage
     * read-your-write visible by the time the request returns. Every collector's thread-local is
     * removed UP FRONT and each run step is guarded, so one failing step (e.g. a Redis round trip in
     * {@code drainCacheInvalidations}) can never strand a later collector's thread-local on a reused
     * request thread, which would otherwise silently drop the next request's deferred writes.
     */
    private void drain() {
      List<Runnable> rdfClosures = ownsRdf ? RdfTagUpdater.drainDeferredToList() : List.of();
      List<LineageUtil.DeferredLineageEsWrite> lineageClosures =
          ownsLineageEs ? LineageUtil.drainLineageDeferred() : List.of();
      List<SearchRepository.DeferredSearchWrite> searchClosures =
          ownsSearchWrite ? SearchRepository.drainSearchWriteDeferred() : List.of();
      List<Runnable> postCommitActions =
          ownsPostCommitActions ? PostCommitActionQueue.drain() : List.of();
      if (ownsCache) {
        runGuarded(cacheInvalidations::drain);
      }
      runGuarded(() -> RdfTagUpdater.runDeferredClosures(rdfClosures));
      runGuarded(() -> runLineageEsClosures(lineageClosures));
      runGuarded(() -> runSearchWriteClosures(searchClosures));
      runGuarded(() -> PostCommitActionQueue.run(postCommitActions));
    }

    private void clear() {
      if (ownsRdf) {
        RdfTagUpdater.clearDeferred();
      }
      if (ownsLineageEs) {
        LineageUtil.clearLineageDeferred();
      }
      if (ownsSearchWrite) {
        SearchRepository.clearSearchWriteDeferred();
      }
      if (ownsCache) {
        cacheInvalidations.clear();
      }
      if (ownsPostCommitActions) {
        PostCommitActionQueue.clear();
      }
    }
  }

  private static void runGuarded(Runnable drainStep) {
    try {
      drainStep.run();
    } catch (Exception e) {
      LOG.error("Post-commit deferral drain step failed", e);
    }
  }

  /**
   * Run the rename/move/domain-change cascade ES rewrites that were captured during the wrapped
   * transaction, now that it has committed. A failure is recoverable from the committed DB rows, so
   * — for the closures that carry an entity locator — enqueue that entity to the durable, entity-keyed
   * search-index retry outbox instead of losing the cascade rewrite. Closures whose underlying {@code
   * SearchRepository.update*} method already self-enqueues on failure carry a {@code null} locator,
   * so the catch only logs and the inner enqueue stands.
   */
  private void runSearchWriteClosures(List<SearchRepository.DeferredSearchWrite> closures) {
    for (SearchRepository.DeferredSearchWrite closure : closures) {
      try {
        closure.run();
      } catch (Exception e) {
        enqueueSearchWriteRetry(closure, e);
      }
    }
  }

  private void enqueueSearchWriteRetry(
      SearchRepository.DeferredSearchWrite closure, Exception failure) {
    LOG.warn(
        "Deferred search-index cascade {} failed for {}; enqueuing retry",
        closure.operation(),
        entityType,
        failure);
    if (closure.entityId() != null || !nullOrEmpty(closure.entityFqn())) {
      SearchIndexRetryQueue.enqueue(
          closure.entityId(),
          closure.entityFqn(),
          closure.entityType() == null ? "" : closure.entityType(),
          SearchIndexRetryQueue.failureReason(closure.operation(), failure));
    }
  }

  private void runLineageEsClosures(List<LineageUtil.DeferredLineageEsWrite> closures) {
    for (LineageUtil.DeferredLineageEsWrite closure : closures) {
      try {
        closure.run();
      } catch (Exception e) {
        enqueueLineageEsRetry(closure.toEntity(), e);
      }
    }
  }

  /**
   * The DB lineage rows are committed but the post-commit ES {@code updateLineage}/{@code
   * updateChildren} round trip failed. Enqueue the affected entity to the durable, entity-keyed
   * search-index retry outbox so its document (which carries the lineage edges) is rebuilt from the
   * source-of-truth DB rows on retry — matching the direct entity-index recovery path — instead of
   * losing the edge with only a log line.
   */
  private void enqueueLineageEsRetry(EntityReference toEntity, Exception failure) {
    LOG.warn("Deferred lineage-ES update failed for {}; enqueuing retry", entityType, failure);
    if (toEntity != null) {
      String toId = toEntity.getId() != null ? toEntity.getId().toString() : null;
      SearchIndexRetryQueue.enqueue(
          toId,
          toEntity.getFullyQualifiedName(),
          toEntity.getType(),
          SearchIndexRetryQueue.failureReason("lineage", failure));
    }
  }
}
