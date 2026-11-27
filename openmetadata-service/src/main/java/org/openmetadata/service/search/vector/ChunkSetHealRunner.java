package org.openmetadata.service.search.vector;

import java.io.IOException;
import java.time.Duration;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.vector.VectorIndexService.ChunkSetsBounded;
import org.openmetadata.service.search.vector.VectorIndexService.DeletedEntityChunksRemoved;
import org.openmetadata.service.search.vector.VectorIndexService.LiveEntities;

/**
 * Runs the live chunk index's one-time cleanups at startup, {@link
 * VectorIndexService#removeChunksNoHeaderCounts} and then {@link
 * VectorIndexService#removeChunksOfDeletedEntities}, until the index records both, on one server at
 * a time. The sweep deletes by the header's bound, so it runs only once the heal has finished. A
 * pass that fails, or finds another server holding the lease, is tried again after a backoff that
 * doubles from {@link #FIRST_RETRY} up to {@link #LONGEST_RETRY}. Each server keeps trying until
 * both records are there, so a server that stops part way leaves the pass to the next one once its
 * lease expires. One line per cleanup is logged at the end.
 */
@Slf4j
public final class ChunkSetHealRunner implements Runnable {
  static final Duration FIRST_RETRY = Duration.ofSeconds(30);
  static final Duration LONGEST_RETRY = Duration.ofMinutes(15);

  /** Lets one server at a time run the heal. Concurrent passes are safe, only wasted. */
  public interface Lease {
    boolean tryAcquire();

    void release();
  }

  /** Waits between attempts. */
  interface Pause {
    void sleep(Duration duration) throws InterruptedException;
  }

  private final VectorIndexService service;
  private final Lease lease;
  private final LiveEntities live;
  private final Pause pause;
  private boolean warned;
  private boolean warnedAtTheCap;

  public ChunkSetHealRunner(VectorIndexService service, Lease lease, LiveEntities live) {
    this(service, lease, live, duration -> Thread.sleep(duration));
  }

  ChunkSetHealRunner(VectorIndexService service, Lease lease, LiveEntities live, Pause pause) {
    this.service = service;
    this.lease = lease;
    this.live = live;
    this.pause = pause;
  }

  @Override
  public void run() {
    Duration wait = FIRST_RETRY;
    boolean done = false;
    for (int attempt = 1; !done && !Thread.currentThread().isInterrupted(); attempt++) {
      done = attempt(attempt, wait);
      if (!done) {
        pauseFor(wait);
        wait = doubled(wait);
      }
    }
  }

  private static Duration doubled(Duration wait) {
    Duration next = wait.multipliedBy(2);
    return next.compareTo(LONGEST_RETRY) > 0 ? LONGEST_RETRY : next;
  }

  private boolean attempt(int attempt, Duration wait) {
    boolean done = false;
    try {
      if (lease.tryAcquire()) {
        done = healHoldingTheLease(attempt, wait);
      } else {
        LOG.debug("Another server holds the chunk heal lease; trying again later");
      }
    } catch (RuntimeException e) {
      logFailure(attempt, wait, e);
    }
    return done;
  }

  private boolean healHoldingTheLease(int attempt, Duration wait) {
    boolean done;
    try {
      done = heal(attempt, wait);
    } finally {
      releaseTheLease();
    }
    return done;
  }

  private boolean heal(int attempt, Duration wait) {
    boolean done = false;
    try {
      logOutcome(service.removeChunksNoHeaderCounts(), attempt);
      logSweep(service.removeChunksOfDeletedEntities(live), attempt);
      done = true;
    } catch (IOException | RuntimeException e) {
      logFailure(attempt, wait, e);
    }
    return done;
  }

  private void releaseTheLease() {
    try {
      lease.release();
    } catch (RuntimeException e) {
      LOG.info("Could not release the chunk heal lease; it expires on its own: {}", e.getMessage());
    }
  }

  private static void logOutcome(Optional<ChunkSetsBounded> healed, int attempts) {
    healed.ifPresentOrElse(
        outcome ->
            LOG.info(
                "Chunk index {} holds no chunk its header does not count: removed {} chunks of {}"
                    + " entities in {} attempts",
                outcome.index(),
                outcome.chunks(),
                outcome.parents(),
                attempts),
        () -> LOG.debug("The chunk index already holds no chunk its header does not count"));
  }

  private static void logSweep(Optional<DeletedEntityChunksRemoved> swept, int attempts) {
    swept.ifPresentOrElse(
        outcome ->
            LOG.info(
                "Chunk index {} holds no chunk of a deleted entity: removed the chunks of {}"
                    + " entities in {} attempts",
                outcome.index(),
                outcome.parents(),
                attempts),
        () -> LOG.debug("The chunk index already holds no chunk of a deleted entity"));
  }

  /** Warns on this server's first failure and once more when the wait reaches its cap. */
  private void logFailure(int attempt, Duration wait, Exception e) {
    String message =
        "Could not finish the chunk index cleanup (attempt {}); trying again, at most every {}"
            + " minutes: {}";
    boolean atTheCap = wait.equals(LONGEST_RETRY);
    boolean warn = !warned || (atTheCap && !warnedAtTheCap);
    warned = true;
    warnedAtTheCap = atTheCap;
    if (warn) {
      LOG.warn(message, attempt, LONGEST_RETRY.toMinutes(), e.getMessage());
    } else {
      LOG.debug(message, attempt, LONGEST_RETRY.toMinutes(), e.getMessage());
    }
  }

  private void pauseFor(Duration wait) {
    try {
      pause.sleep(wait);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.debug("Stopped waiting to finish the chunk index cleanup");
    }
  }
}
