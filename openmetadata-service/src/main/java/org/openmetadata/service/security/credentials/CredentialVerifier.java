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

package org.openmetadata.service.security.credentials;

import com.codahale.metrics.health.HealthCheck;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;
import com.github.benmanes.caffeine.cache.RemovalCause;
import com.github.benmanes.caffeine.cache.Ticker;
import com.google.common.collect.Lists;
import io.dropwizard.lifecycle.Managed;
import io.micrometer.core.instrument.Metrics;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.credentials.CredentialMetrics.EvictionCause;
import org.openmetadata.service.security.credentials.CredentialMetrics.NudgeOutcome;
import org.openmetadata.service.security.credentials.CredentialMetrics.ReadOutcome;
import org.openmetadata.service.security.credentials.CredentialMetrics.ReadReason;
import org.openmetadata.service.security.credentials.CredentialMetrics.SweepQuery;
import org.openmetadata.service.security.credentials.CredentialMetrics.UnavailableCause;

/**
 * This server's view of which OpenMetadata-signed credentials are current.
 *
 * <p>{@link #require} never accepts a token on the strength of a database read that began more than
 * {@code maxStaleness} ago, so a revocation committed at T is honored by every server for every check
 * that begins at or after T + maxStaleness, whatever happens to sweeps, peers or the writer. A
 * background sweep re-confirms every cached principal each {@code sweepInterval} with one fingerprint
 * query per {@code batchSize} principals and re-reads only the ones whose fingerprint moved, so in
 * steady state a check is a lock-free cache read, a clock read and a set lookup. When the sweep falls
 * behind, the next check does one single-flight read on the request thread; when that read fails,
 * times out or gets no permit, the check throws {@link CredentialUnavailableException} ("cannot
 * confirm"), which is not {@link AuthenticationException} ("confirmed not current").
 *
 * <p>All state is per instance. Every stamp is a {@link Ticker} reading compared by difference.
 */
@Slf4j
public final class CredentialVerifier implements Managed {
  private static final String SWEEP_THREAD_NAME = "om-credential-verifier";
  private static final long NANOS_PER_SECOND = TimeUnit.SECONDS.toNanos(1);

  private final CredentialVerificationConfig config;
  private final CredentialSource source;
  private final Ticker ticker;
  private final CheckDecision.Policy policy;
  private final CredentialMetrics metrics;
  private final List<RevocationListener> revocationListeners;
  private final Cache<CredentialSubject, VerifiedCredentials> entries;
  private final ConcurrentMap<CredentialSubject, InFlightRead> inFlight = new ConcurrentHashMap<>();
  private final Semaphore requestThreadReads;
  private final Set<CredentialSubject> nudged = ConcurrentHashMap.newKeySet();
  private final AtomicLong lastCompleteSweepStartNanos;
  private final AtomicLong lastDeepVerifyNanos;
  private final AtomicBoolean started = new AtomicBoolean();
  private volatile ScheduledExecutorService sweeper;

  /** A request-thread read that others may join; it lives in {@link #inFlight} only while it runs. */
  private record InFlightRead(long stampNanos, CompletableFuture<VerifiedCredentials> result) {}

  /** Create and read start the idle window; an update (sweep or re-read) keeps what is left of it. */
  private record IdleExpiry(long idleExpiryNanos)
      implements Expiry<CredentialSubject, VerifiedCredentials> {
    @Override
    public long expireAfterCreate(CredentialSubject key, VerifiedCredentials value, long now) {
      return idleExpiryNanos;
    }

    @Override
    public long expireAfterUpdate(
        CredentialSubject key, VerifiedCredentials value, long now, long currentDuration) {
      return currentDuration;
    }

    @Override
    public long expireAfterRead(
        CredentialSubject key, VerifiedCredentials value, long now, long currentDuration) {
      return idleExpiryNanos;
    }
  }

  /** Called on the thread that installed a re-read showing {@code subject} lost digests. */
  public interface RevocationListener {
    void revoked(CredentialSubject subject, Collection<TokenDigest> removed);
  }

  /** Builds the one production verifier, over the global meter registry like the cache bundle. */
  public static CredentialVerifier create(
      CredentialVerificationConfig config,
      Jdbi jdbi,
      Supplier<SecretsManager> secretsManager,
      List<RevocationListener> revocationListeners) {
    return new CredentialVerifier(
        config,
        new JdbiCredentialSource(jdbi, secretsManager, config),
        Ticker.systemTicker(),
        new CredentialMetrics(Metrics.globalRegistry),
        revocationListeners);
  }

  CredentialVerifier(
      CredentialVerificationConfig config,
      CredentialSource source,
      Ticker ticker,
      CredentialMetrics metrics,
      List<RevocationListener> revocationListeners) {
    this.config = config;
    this.source = source;
    this.ticker = ticker;
    this.metrics = metrics;
    this.policy = config.policy();
    this.revocationListeners = List.copyOf(revocationListeners);
    this.requestThreadReads = new Semaphore(config.maxConcurrentRequestReads());
    this.entries =
        Caffeine.newBuilder()
            .ticker(ticker)
            .maximumSize(config.maxSubjects())
            .expireAfter(new IdleExpiry(config.idleExpiryNanos()))
            .evictionListener(this::recordEviction)
            .build();
    long now = ticker.read();
    this.lastCompleteSweepStartNanos = new AtomicLong(now);
    this.lastDeepVerifyNanos = new AtomicLong(now);
    metrics.registerGauges(this::cachedSubjects, this::lastCompleteSweepAgeSeconds);
  }

  /**
   * Returns normally iff {@code credential} is acceptable right now.
   *
   * @param rejectionMessage the reason inside the {@link AuthenticationException} thrown for a
   *     token that is confirmed not current or unrecognized; transport vocabulary, so the caller
   *     chooses it
   * @throws AuthenticationException the token is confirmed not current
   * @throws CredentialUnavailableException the verifier could not confirm within the bound
   */
  public void require(OmCredential credential, String rawToken, String rejectionMessage) {
    switch (credential) {
      case OmCredential.NotStored notStored -> {}
      case OmCredential.Unrecognized unrecognized -> throw AuthenticationException
          .getInvalidTokenException(rejectionMessage);
      case OmCredential.Stored stored -> requireCurrent(
          stored.subject(), TokenDigest.of(rawToken), rejectionMessage);
    }
  }

  /** Seconds a 503 tells clients to wait: the sweep interval, rounded up. */
  public long retryAfterSeconds() {
    return Math.ceilDiv(config.sweepIntervalNanos(), NANOS_PER_SECOND);
  }

  /** Unhealthy when no sweep has completed within maxStaleness; the hot path then pays reads. */
  public HealthCheck healthCheck() {
    return new HealthCheck() {
      @Override
      protected Result check() {
        long ageNanos = ticker.read() - lastCompleteSweepStartNanos.get();
        return ageNanos <= config.maxStalenessNanos()
            ? Result.healthy()
            : Result.unhealthy(
                "No complete credential sweep for %d ms; the bound is %d ms",
                TimeUnit.NANOSECONDS.toMillis(ageNanos), config.maxStaleness().toMilliseconds());
      }
    };
  }

  /** Idempotent. The first sweep runs at once, so an empty cache is confirmed before traffic. */
  @Override
  public void start() {
    if (started.compareAndSet(false, true)) {
      ScheduledExecutorService scheduler =
          Executors.newSingleThreadScheduledExecutor(CredentialVerifier::sweepThread);
      scheduler.scheduleWithFixedDelay(
          this::sweepSafely, 0, config.sweepIntervalNanos(), TimeUnit.NANOSECONDS);
      sweeper = scheduler;
      LOG.info(
          "Credential verifier started: maxStaleness={} sweepInterval={}",
          config.maxStaleness(),
          config.sweepInterval());
    }
  }

  @Override
  public void stop() {
    if (started.compareAndSet(true, false)) {
      sweeper.shutdownNow();
      sweeper = null;
    }
  }

  Duration maxStaleness() {
    return Duration.ofNanos(config.maxStalenessNanos());
  }

  long cachedSubjects() {
    entries.cleanUp();
    return entries.estimatedSize();
  }

  /**
   * Re-reads {@code subject} on the calling thread after one of its credentials changed here, so
   * this server is read-your-writes. Only a cached or in-flight subject is read: anything else loads
   * fresh on its next check. The in-flight case matters, because a read stamped before the commit
   * could still install the old set, and the merge keeps this later stamp over it.
   */
  void refreshNow(CredentialSubject subject) {
    if (isCachedOrInFlight(subject)) {
      rereadQuietly(List.of(subject), ReadReason.REFRESH);
    }
  }

  /** A peer says {@code subject} changed. Queued for the sweep thread; never read here. */
  void nudge(CredentialSubject subject) {
    boolean queued = nudged.size() < config.maxSubjects();
    if (queued) {
      nudged.add(subject);
      scheduleDrain();
    }
    metrics.recordNudgeReceived(queued ? NudgeOutcome.QUEUED : NudgeOutcome.DROPPED);
  }

  /**
   * One pass: drain nudges, then re-confirm every cached subject in batches. The stamp is read
   * before each query. A batch failure leaves its entries to age out and does not stop the others;
   * the health and deep-verify stamps move only when every batch succeeded.
   */
  void sweepOnce() {
    long sweepStart = ticker.read();
    drainNudges();
    boolean deep = sweepStart - lastDeepVerifyNanos.get() >= config.deepVerifyIntervalNanos();
    boolean complete = true;
    List<CredentialSubject> subjects = List.copyOf(entries.asMap().keySet());
    for (List<CredentialSubject> batch : Lists.partition(subjects, config.batchSize())) {
      complete &= sweepBatch(batch, deep);
    }
    if (complete && deep) {
      lastDeepVerifyNanos.set(sweepStart);
    }
    if (complete) {
      lastCompleteSweepStartNanos.set(sweepStart);
    }
    metrics.recordSweep(ticker.read() - sweepStart);
  }

  private void requireCurrent(
      CredentialSubject subject, TokenDigest digest, String rejectionMessage) {
    if (!isCurrent(subject, digest)) {
      throw AuthenticationException.getInvalidTokenException(rejectionMessage);
    }
  }

  private boolean isCurrent(CredentialSubject subject, TokenDigest digest) {
    long now = ticker.read();
    VerifiedCredentials entry = entries.getIfPresent(subject);
    CheckDecision decision = CheckDecision.decide(entry, now, digest, policy);
    if (decision.needsLoad()) {
      entry = readOnRequestThread(subject, ReadReason.of(decision));
      now = ticker.read();
      decision = CheckDecision.decideAfterLoad(entry, now, digest, policy);
    }
    if (decision == CheckDecision.LOAD_STALE) {
      throw unavailable(
          UnavailableCause.TIMEOUT,
          "The credential read for " + subject.principal() + " finished outside maxStaleness",
          null);
    }
    metrics.recordCheck(decision, entry.ageNanos(now));
    return decision == CheckDecision.ACCEPT;
  }

  /**
   * Joins the read in flight for {@code subject} when it is stamped within the last
   * missRefreshMinAge (so a new token is still seen within that bound); otherwise starts one.
   */
  private VerifiedCredentials readOnRequestThread(CredentialSubject subject, ReadReason reason) {
    long now = ticker.read();
    InFlightRead mine = new InFlightRead(now, new CompletableFuture<>());
    InFlightRead current =
        inFlight.compute(subject, (key, running) -> isJoinable(running, now) ? running : mine);
    return current == mine ? own(subject, mine, reason) : join(subject, current);
  }

  private boolean isJoinable(InFlightRead running, long nowNanos) {
    return running != null && nowNanos - running.stampNanos() <= config.missRefreshMinAgeNanos();
  }

  /** The owner removes only its own mapping, since a newer read may have replaced it. */
  private VerifiedCredentials own(CredentialSubject subject, InFlightRead mine, ReadReason reason) {
    try {
      VerifiedCredentials loaded = readUnderPermit(subject, mine.stampNanos(), reason);
      mine.result().complete(loaded);
      return loaded;
    } catch (RuntimeException failure) {
      mine.result().completeExceptionally(failure);
      throw failure;
    } finally {
      inFlight.remove(subject, mine);
    }
  }

  private VerifiedCredentials join(CredentialSubject subject, InFlightRead running) {
    try {
      return running.result().get(config.loadTimeoutNanos(), TimeUnit.NANOSECONDS);
    } catch (TimeoutException timeout) {
      throw joinFailed(
          subject, UnavailableCause.TIMEOUT, "did not finish within loadTimeout", timeout);
    } catch (ExecutionException failed) {
      throw joinFailed(subject, UnavailableCause.READ_FAILED, "failed", failed.getCause());
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw joinFailed(subject, UnavailableCause.TIMEOUT, "was interrupted", interrupted);
    }
  }

  private CredentialUnavailableException joinFailed(
      CredentialSubject subject, UnavailableCause cause, String outcome, Throwable failure) {
    return unavailable(
        cause, "The read in flight for " + subject.principal() + " " + outcome, failure);
  }

  /**
   * The stamp predates the permit wait, which only shortens the entry's trust. The read itself runs
   * outside every lock and cache compute.
   */
  private VerifiedCredentials readUnderPermit(
      CredentialSubject subject, long stampNanos, ReadReason reason) {
    acquirePermit(subject, stampNanos, reason);
    try {
      CredentialRecord record = readOne(subject, reason);
      return install(subject, new VerifiedCredentials(record, stampNanos), true);
    } finally {
      requestThreadReads.release();
    }
  }

  private void acquirePermit(CredentialSubject subject, long stampNanos, ReadReason reason) {
    long remainingNanos = config.loadTimeoutNanos() - (ticker.read() - stampNanos);
    try {
      if (!requestThreadReads.tryAcquire(Math.max(0, remainingNanos), TimeUnit.NANOSECONDS)) {
        metrics.recordRead(reason, ReadOutcome.NO_PERMIT, ticker.read() - stampNanos);
        throw unavailable(
            UnavailableCause.NO_PERMIT,
            "No request-read permit for " + subject.principal() + " within loadTimeout",
            null);
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw unavailable(
          UnavailableCause.NO_PERMIT,
          "Interrupted while waiting for a request-read permit for " + subject.principal(),
          interrupted);
    }
  }

  private CredentialRecord readOne(CredentialSubject subject, ReadReason reason) {
    List<CredentialSubject> one = List.of(subject);
    try {
      return timedRead(one, cachedRecords(one), reason)
          .getOrDefault(subject, CredentialRecord.ABSENT);
    } catch (RuntimeException failure) {
      throw unavailable(
          UnavailableCause.READ_FAILED,
          "Could not read the stored credentials of " + subject.principal(),
          failure);
    }
  }

  /** The only call into the source for full reads. Records the read; a failure propagates as is. */
  private Map<CredentialSubject, CredentialRecord> timedRead(
      Collection<CredentialSubject> subjects,
      Map<CredentialSubject, CredentialRecord> previous,
      ReadReason reason) {
    long started = ticker.read();
    try {
      Map<CredentialSubject, CredentialRecord> records = source.read(subjects, previous);
      metrics.recordRead(reason, ReadOutcome.OK, ticker.read() - started);
      return records;
    } catch (RuntimeException failure) {
      metrics.recordRead(reason, ReadOutcome.ERROR, ticker.read() - started);
      throw failure;
    }
  }

  /**
   * Newer-wins install. {@code createIfAbsent} is true for request, refresh and nudge reads, which
   * must beat a slower read still in flight, and false for sweeps, so a sweep can never create an
   * entry or revive one that idled out while the sweep ran. Listeners hear about digests the
   * replaced record held and the installed one lacks, after the merge returns.
   */
  private VerifiedCredentials install(
      CredentialSubject subject, VerifiedCredentials candidate, boolean createIfAbsent) {
    AtomicReference<VerifiedCredentials> replaced = new AtomicReference<>();
    BiFunction<VerifiedCredentials, VerifiedCredentials, VerifiedCredentials> newer =
        (existing, incoming) -> {
          replaced.set(existing);
          return VerifiedCredentials.newer(existing, incoming);
        };
    VerifiedCredentials installed =
        createIfAbsent
            ? entries.asMap().merge(subject, candidate, newer)
            : entries
                .asMap()
                .computeIfPresent(subject, (key, existing) -> newer.apply(existing, candidate));
    if (installed == candidate && replaced.get() != null) {
      notifyRemovedDigests(subject, replaced.get().record(), candidate.record());
    }
    return installed;
  }

  private void notifyRemovedDigests(
      CredentialSubject subject, CredentialRecord before, CredentialRecord after) {
    Set<TokenDigest> removed = new HashSet<>(before.digests());
    removed.removeAll(after.digests());
    if (!removed.isEmpty()) {
      metrics.recordRevocationObserved();
      Set<TokenDigest> frozen = Set.copyOf(removed);
      revocationListeners.forEach(listener -> notifyQuietly(listener, subject, frozen));
    }
  }

  private static void notifyQuietly(
      RevocationListener listener, CredentialSubject subject, Set<TokenDigest> removed) {
    try {
      listener.revoked(subject, removed);
    } catch (RuntimeException failure) {
      LOG.warn("Revocation listener failed for {}", subject.principal(), failure);
    }
  }

  private boolean sweepBatch(List<CredentialSubject> batch, boolean deep) {
    boolean succeeded = false;
    try {
      if (deep) {
        reread(batch, ReadReason.DEEP, Map.of(), false);
        metrics.recordSweepQuery(SweepQuery.FULL);
      } else {
        reconfirm(batch);
      }
      succeeded = true;
    } catch (RuntimeException failure) {
      LOG.warn(
          "Credential sweep batch of {} subjects failed; their entries age out until a pass succeeds",
          batch.size(),
          failure);
    }
    return succeeded;
  }

  /** One fingerprint query for the batch, then a full read of only the subjects that moved. */
  private void reconfirm(List<CredentialSubject> batch) {
    long stamp = ticker.read();
    Map<CredentialSubject, SourceFingerprint> fingerprints = source.fingerprints(batch);
    metrics.recordSweepQuery(SweepQuery.FINGERPRINT);
    List<CredentialSubject> changed = restamp(batch, fingerprints, stamp);
    metrics.recordSweepChanged(changed.size());
    if (!changed.isEmpty()) {
      reread(changed, ReadReason.SWEEP, cachedRecords(changed), false);
      metrics.recordSweepQuery(SweepQuery.FULL);
    }
  }

  /**
   * Moves the stamp of each entry whose own fingerprint the later query returned and lists the
   * cached subjects whose fingerprint differs. An entry that idled out meanwhile stays absent.
   */
  private List<CredentialSubject> restamp(
      List<CredentialSubject> batch,
      Map<CredentialSubject, SourceFingerprint> fingerprints,
      long stamp) {
    List<CredentialSubject> changed = new ArrayList<>();
    for (CredentialSubject subject : batch) {
      SourceFingerprint fingerprint = fingerprints.getOrDefault(subject, SourceFingerprint.ABSENT);
      VerifiedCredentials entry =
          entries
              .asMap()
              .computeIfPresent(
                  subject, (key, current) -> current.reconfirmedAt(fingerprint, stamp));
      if (entry != null && !fingerprint.equals(entry.record().fingerprint())) {
        changed.add(subject);
      }
    }
    return changed;
  }

  private void reread(
      List<CredentialSubject> subjects,
      ReadReason reason,
      Map<CredentialSubject, CredentialRecord> previous,
      boolean createIfAbsent) {
    long stamp = ticker.read();
    Map<CredentialSubject, CredentialRecord> records = timedRead(subjects, previous, reason);
    for (CredentialSubject subject : subjects) {
      CredentialRecord record = records.getOrDefault(subject, CredentialRecord.ABSENT);
      install(subject, new VerifiedCredentials(record, stamp), createIfAbsent);
    }
  }

  private void rereadQuietly(List<CredentialSubject> subjects, ReadReason reason) {
    try {
      reread(subjects, reason, cachedRecords(subjects), true);
    } catch (RuntimeException failure) {
      LOG.warn(
          "Could not re-read {} credential subjects after a {}; the sweep converges within the bound",
          subjects.size(),
          reason,
          failure);
    }
  }

  private void drainNudges() {
    List<CredentialSubject> subjects = new ArrayList<>();
    for (Iterator<CredentialSubject> queued = nudged.iterator(); queued.hasNext(); ) {
      subjects.add(queued.next());
      queued.remove();
    }
    List<CredentialSubject> relevant = subjects.stream().filter(this::isCachedOrInFlight).toList();
    for (List<CredentialSubject> batch : Lists.partition(relevant, config.batchSize())) {
      rereadQuietly(batch, ReadReason.NUDGE);
    }
  }

  private void scheduleDrain() {
    ScheduledExecutorService running = sweeper;
    if (running != null) {
      try {
        running.execute(this::drainNudges);
      } catch (RejectedExecutionException stopped) {
        LOG.debug("Nudge drain not scheduled; the verifier is stopped", stopped);
      }
    }
  }

  /** An exception escaping a fixed-delay task cancels every later run, so none may escape. */
  private void sweepSafely() {
    try {
      sweepOnce();
    } catch (Throwable failure) {
      LOG.error("Credential sweep failed; entries age out until the next pass succeeds", failure);
    }
  }

  private boolean isCachedOrInFlight(CredentialSubject subject) {
    return entries.policy().getIfPresentQuietly(subject) != null || inFlight.containsKey(subject);
  }

  /** Cached records for decrypt reuse, read without touching idle expiry. */
  private Map<CredentialSubject, CredentialRecord> cachedRecords(
      Collection<CredentialSubject> subjects) {
    Map<CredentialSubject, CredentialRecord> previous = new HashMap<>();
    for (CredentialSubject subject : subjects) {
      VerifiedCredentials entry = entries.policy().getIfPresentQuietly(subject);
      if (entry != null) {
        previous.put(subject, entry.record());
      }
    }
    return previous;
  }

  private CredentialUnavailableException unavailable(
      UnavailableCause cause, String message, Throwable failure) {
    metrics.recordUnavailable(cause);
    return new CredentialUnavailableException(message, failure);
  }

  private void recordEviction(
      CredentialSubject subject, VerifiedCredentials entry, RemovalCause cause) {
    switch (cause) {
      case SIZE -> metrics.recordEviction(EvictionCause.SIZE);
      case EXPIRED -> metrics.recordEviction(EvictionCause.IDLE);
      default -> {}
    }
  }

  private double lastCompleteSweepAgeSeconds() {
    return (ticker.read() - lastCompleteSweepStartNanos.get()) / 1e9;
  }

  private static Thread sweepThread(Runnable task) {
    Thread thread = new Thread(task, SWEEP_THREAD_NAME);
    thread.setDaemon(true);
    return thread;
  }
}
