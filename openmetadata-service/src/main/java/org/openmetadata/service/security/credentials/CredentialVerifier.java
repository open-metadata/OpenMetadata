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
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
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
 * behind, the next check starts or joins one single-flight read of its principal on a small read
 * pool and waits for it within {@code loadTimeout}; when that read fails, does not finish in time
 * or gets no slot, the check throws {@link CredentialUnavailableException} ("cannot confirm"),
 * which is not {@link AuthenticationException} ("confirmed not current").
 *
 * <p>All state is per instance. Every stamp is a {@link Ticker} reading compared by difference.
 */
@Slf4j
public final class CredentialVerifier implements Managed {
  private static final String SWEEP_THREAD_NAME = "om-credential-verifier";
  private static final String READ_THREAD_NAME_PREFIX = "om-credential-read-";
  private static final AtomicInteger READ_THREADS = new AtomicInteger();
  private static final long NANOS_PER_SECOND = TimeUnit.SECONDS.toNanos(1);
  private static final long DEEP_RETRY_CAP_NANOS = TimeUnit.MINUTES.toNanos(1);
  private static final long READ_THREAD_IDLE_SECONDS = 60;
  private static final int QUEUED_READS_PER_THREAD = 16;
  private static final BooleanSupplier NEVER_CREATES = () -> false;

  private final CredentialVerificationConfig config;
  private final CredentialSource source;
  private final Ticker ticker;
  private final CheckDecision.Policy policy;
  private final CredentialMetrics metrics;
  private final List<RevocationListener> revocationListeners;
  private final Cache<CredentialSubject, VerifiedCredentials> entries;
  private final ConcurrentMap<CredentialSubject, InFlightRead> inFlight = new ConcurrentHashMap<>();
  private final ThreadPoolExecutor requestReads;
  private final Set<CredentialSubject> nudged = ConcurrentHashMap.newKeySet();
  private final AtomicLong lastCompleteSweepStartNanos;
  private final AtomicLong nextDeepVerifyNanos;
  private final long deepRetryIntervalNanos;
  private final AtomicBoolean drainScheduled = new AtomicBoolean();
  private final AtomicReference<ScheduledExecutorService> sweeper = new AtomicReference<>();

  /**
   * A read of one subject that may create its entry: a check's read, a refresh or a nudge. It is
   * registered in {@link #inFlight} until it has installed its result, so checks of the subject
   * join it instead of reading again. Its future completes with the entry to decide on, with null
   * when the source left the subject out, or exceptionally with whatever the read threw. A refresh
   * or nudge supersedes the read it finds registered: no check can join that read any more, and it
   * never creates an entry, though it may still replace an older one.
   */
  private static final class InFlightRead {
    private final CompletableFuture<VerifiedCredentials> result = new CompletableFuture<>();
    private volatile RequestRead task;
    private volatile boolean superseded;

    private boolean mayCreate() {
      return !superseded;
    }
  }

  /**
   * A check's read on the request-read pool. A throwable of any kind fails it, so every waiter
   * fails at once. An {@link Error} is rethrown after that, as on any thread; any other failure
   * reaches the waiters, which report it.
   */
  private final class RequestRead implements Runnable {
    private final CredentialSubject subject;
    private final InFlightRead read;
    private final ReadReason reason;
    private final long stampNanos;

    private RequestRead(
        CredentialSubject subject, InFlightRead read, ReadReason reason, long stampNanos) {
      this.subject = subject;
      this.read = read;
      this.reason = reason;
      this.stampNanos = stampNanos;
    }

    @Override
    public void run() {
      try {
        readAndInstall(Map.of(subject, read), stampNanos, reason);
      } catch (RuntimeException failure) {
        LOG.debug("The credential read of {} failed", subject.principal(), failure);
      }
    }

    /** No slot, at once or within the budget of a waiter: every waiter answers NO_PERMIT. */
    private void reject(RejectedExecutionException why) {
      metrics.recordRead(reason, ReadOutcome.NO_PERMIT, ticker.read() - stampNanos);
      fail(subject, read, why);
    }
  }

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
    this.requestReads = readPool(config.maxConcurrentRequestReads());
    this.entries =
        Caffeine.newBuilder()
            .ticker(ticker)
            .maximumSize(config.maxSubjects())
            .expireAfter(new IdleExpiry(config.idleExpiryNanos()))
            .evictionListener(this::recordEviction)
            .build();
    long now = ticker.read();
    this.lastCompleteSweepStartNanos = new AtomicLong(now);
    this.nextDeepVerifyNanos = new AtomicLong(now + config.deepVerifyIntervalNanos());
    this.deepRetryIntervalNanos = Math.min(config.deepVerifyIntervalNanos(), DEEP_RETRY_CAP_NANOS);
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

  /**
   * Idempotent, and safe to race with {@link #stop}: the scheduler is published before it is
   * scheduled, and a call that finds one published discards its own. The first sweep runs at once,
   * so an empty cache is confirmed before traffic.
   */
  @Override
  public void start() {
    ScheduledExecutorService scheduler =
        Executors.newSingleThreadScheduledExecutor(CredentialVerifier::sweepThread);
    if (sweeper.compareAndSet(null, scheduler)) {
      scheduleSweeps(scheduler);
    } else {
      scheduler.shutdownNow();
    }
  }

  /** Idempotent; takes the published scheduler, so exactly one call shuts each one down. */
  @Override
  public void stop() {
    ScheduledExecutorService running = sweeper.getAndSet(null);
    if (running != null) {
      running.shutdownNow();
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
   * fresh on its next check. The read supersedes the read in flight, if any, so no read registered
   * before it can create the subject's entry, even once the entry this refresh installs is evicted.
   * A read registered later is stamped after that registration, so after the write committed.
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
   * the health stamp moves only when every batch was reconfirmed. When the deep verify is due, each
   * batch is reconfirmed first and then read in full with every decrypt forced. A deep read that
   * fails leaves its entries trusted by their fingerprints and health untouched, and the pass is
   * retried after {@code min(deepVerifyInterval, 1 min)}: a batch fails only on a statement
   * failure, since the source converts subjects on their own, so the whole pass is what to retry,
   * and one stamp holds that decision.
   */
  void sweepOnce() {
    long sweepStart = ticker.read();
    drainNudges();
    boolean deep = sweepStart - nextDeepVerifyNanos.get() >= 0;
    boolean complete = true;
    boolean deepVerified = true;
    List<CredentialSubject> subjects = List.copyOf(entries.asMap().keySet());
    for (List<CredentialSubject> batch : Lists.partition(subjects, config.batchSize())) {
      BatchOutcome outcome = sweepBatch(batch, deep);
      complete &= outcome.reconfirmed();
      deepVerified &= outcome.deepVerified();
    }
    if (deep) {
      long interval = deepVerified ? config.deepVerifyIntervalNanos() : deepRetryIntervalNanos;
      nextDeepVerifyNanos.set(sweepStart + interval);
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

  /** The clock is read after the lookup, so the age it gives the entry errs on the older side. */
  private boolean isCurrent(CredentialSubject subject, TokenDigest digest) {
    VerifiedCredentials entry = entries.getIfPresent(subject);
    long now = ticker.read();
    CheckDecision decision = CheckDecision.decide(entry, now, digest, policy);
    if (decision.needsLoad()) {
      entry = loadForCheck(subject, digest, now, ReadReason.of(decision));
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
   * Joins the read in flight for {@code subject}, whatever its age, or starts one, and waits for it
   * within what is left of {@code loadTimeout} since the check's first clock read. A result that
   * lacks the digest and comes from a full read older than that clock read minus missRefreshMinAge
   * cannot show a token created since, so the check then joins or starts one newer read within the
   * same budget. That read was registered after this check joined the first one, so after this
   * check began, and is stamped later still. A check therefore waits for at most two reads and
   * never answers "not current" from a read too old to decide.
   */
  private VerifiedCredentials loadForCheck(
      CredentialSubject subject, TokenDigest digest, long checkStartNanos, ReadReason reason) {
    long deadlineNanos = checkStartNanos + config.loadTimeoutNanos();
    VerifiedCredentials loaded =
        awaitRead(subject, joinOrStart(subject, digest, reason), deadlineNanos);
    boolean tooOldToDecide =
        !loaded.record().holds(digest)
            && checkStartNanos - loaded.fullReadAtNanos() > config.missRefreshMinAgeNanos();
    if (tooOldToDecide) {
      loaded = awaitRead(subject, joinOrStart(subject, digest, reason), deadlineNanos);
    }
    return loaded;
  }

  /**
   * Single flight: a check joins the read registered for its subject or registers its own. The
   * owner of a new registration decides again on the cached entry first, because the read it
   * missed may have installed its entry and left the registry between this check's lookup and its
   * registration; that decision keeps the new-token floor, since it is the same decision at a later
   * instant. A read is stamped after it is registered, so a read registered after some instant is
   * stamped after it too, and before it waits for a pool slot.
   */
  private InFlightRead joinOrStart(
      CredentialSubject subject, TokenDigest digest, ReadReason reason) {
    InFlightRead mine = new InFlightRead();
    InFlightRead running = inFlight.putIfAbsent(subject, mine);
    if (running == null) {
      readUnlessCached(subject, mine, digest, reason);
    }
    return running == null ? mine : running;
  }

  private void readUnlessCached(
      CredentialSubject subject, InFlightRead read, TokenDigest digest, ReadReason reason) {
    VerifiedCredentials cached = entries.getIfPresent(subject);
    long stampNanos = ticker.read();
    if (cached != null && !CheckDecision.decide(cached, stampNanos, digest, policy).needsLoad()) {
      finish(subject, read, cached);
    } else {
      submit(subject, read, reason, stampNanos);
    }
  }

  /** A read the pool cannot even queue answers NO_PERMIT at once, to every waiter. */
  private void submit(
      CredentialSubject subject, InFlightRead read, ReadReason reason, long stampNanos) {
    RequestRead task = new RequestRead(subject, read, reason, stampNanos);
    read.task = task;
    try {
      requestReads.execute(task);
    } catch (RejectedExecutionException full) {
      task.reject(full);
    }
  }

  /** Every waiter, the one that started the read included, waits within its own check's budget. */
  private VerifiedCredentials awaitRead(
      CredentialSubject subject, InFlightRead read, long deadlineNanos) {
    VerifiedCredentials loaded = resultWithin(subject, read, deadlineNanos);
    if (loaded == null) {
      throw unavailable(
          UnavailableCause.SUBJECT_READ_FAILED,
          "The stored credentials of " + subject.principal() + " could not be converted",
          null);
    }
    return loaded;
  }

  private VerifiedCredentials resultWithin(
      CredentialSubject subject, InFlightRead read, long deadlineNanos) {
    try {
      return read.result.get(Math.max(0, deadlineNanos - ticker.read()), TimeUnit.NANOSECONDS);
    } catch (TimeoutException timeout) {
      throw timedOut(subject, read, timeout);
    } catch (ExecutionException failed) {
      throw failed(subject, failed.getCause());
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw unavailable(
          UnavailableCause.TIMEOUT,
          "Interrupted while waiting for the read of " + subject.principal(),
          interrupted);
    }
  }

  /**
   * A read still queued when a waiter's budget ends is withdrawn, so no slot is spent on a result
   * nobody waits for, and counts as a read that got no slot. One that a thread took finishes in the
   * background and installs its result under the usual newer-wins rule.
   */
  private CredentialUnavailableException timedOut(
      CredentialSubject subject, InFlightRead read, TimeoutException timeout) {
    RequestRead queued = read.task;
    boolean withdrawn = queued != null && requestReads.remove(queued);
    if (withdrawn) {
      queued.reject(new RejectedExecutionException("no read slot within loadTimeout"));
    }
    return withdrawn
        ? unavailable(
            UnavailableCause.NO_PERMIT,
            "No read slot for " + subject.principal() + " within loadTimeout",
            timeout)
        : unavailable(
            UnavailableCause.TIMEOUT,
            "The read of " + subject.principal() + " did not finish within loadTimeout",
            timeout);
  }

  private CredentialUnavailableException failed(CredentialSubject subject, Throwable cause) {
    return cause instanceof RejectedExecutionException
        ? unavailable(UnavailableCause.NO_PERMIT, "No read slot for " + subject.principal(), cause)
        : unavailable(
            UnavailableCause.READ_FAILED,
            "Could not read the stored credentials of " + subject.principal(),
            cause);
  }

  /**
   * One full read of registered subjects, then each install. A throwable of any kind fails every
   * read not yet finished, so no check is left waiting for it, and is rethrown.
   */
  private void readAndInstall(
      Map<CredentialSubject, InFlightRead> reads, long stampNanos, ReadReason reason) {
    try {
      Map<CredentialSubject, CredentialRecord> records =
          timedRead(reads.keySet(), cachedRecords(reads.keySet()), reason);
      reads.forEach(
          (subject, read) ->
              finish(subject, read, installRead(subject, read, records.get(subject), stampNanos)));
    } catch (Throwable failure) {
      reads.forEach((subject, read) -> fail(subject, read, failure));
      throw failure;
    }
  }

  /** Null when the source left the subject out: unconfirmed, so nothing is installed. */
  private VerifiedCredentials installRead(
      CredentialSubject subject, InFlightRead read, CredentialRecord record, long stampNanos) {
    return record == null
        ? null
        : install(subject, new VerifiedCredentials(record, stampNanos), read::mayCreate);
  }

  /** Deregisters before completing, so a check that reads again can never find a finished read. */
  private void finish(CredentialSubject subject, InFlightRead read, VerifiedCredentials entry) {
    inFlight.remove(subject, read);
    read.result.complete(entry);
  }

  private void fail(CredentialSubject subject, InFlightRead read, Throwable failure) {
    inFlight.remove(subject, read);
    read.result.completeExceptionally(failure);
  }

  /**
   * The only call into the source for full reads. Records the read, whatever it ends in, and the
   * subjects it left out; a failure propagates as is.
   */
  private Map<CredentialSubject, CredentialRecord> timedRead(
      Collection<CredentialSubject> subjects,
      Map<CredentialSubject, CredentialRecord> previous,
      ReadReason reason) {
    long started = ticker.read();
    try {
      Map<CredentialSubject, CredentialRecord> records = source.read(subjects, previous);
      metrics.recordRead(reason, ReadOutcome.OK, ticker.read() - started);
      long unreadable = subjects.stream().filter(subject -> !records.containsKey(subject)).count();
      if (unreadable > 0) {
        metrics.recordUnreadableSubjects(unreadable);
      }
      return records;
    } catch (RuntimeException | Error failure) {
      metrics.recordRead(reason, ReadOutcome.ERROR, ticker.read() - started);
      throw failure;
    }
  }

  /**
   * Newer-wins install, under the subject's slot lock. An absent slot is filled only while {@code
   * mayCreate} answers true there: a sweep never creates an entry, so it cannot revive one that
   * idled out while it ran, and a superseded read never does, so it cannot recreate an entry that a
   * later refresh installed and the cache then evicted. Returns the cache's entry, or the candidate
   * when the cache holds none. Listeners hear about digests the replaced record held and the
   * installed one lacks, after the compute returns.
   */
  private VerifiedCredentials install(
      CredentialSubject subject, VerifiedCredentials candidate, BooleanSupplier mayCreate) {
    AtomicReference<VerifiedCredentials> replaced = new AtomicReference<>();
    VerifiedCredentials installed =
        entries
            .asMap()
            .compute(
                subject,
                (key, existing) -> {
                  replaced.set(existing);
                  return merged(existing, candidate, mayCreate);
                });
    if (installed == candidate && replaced.get() != null) {
      notifyRemovedDigests(subject, replaced.get().record(), candidate.record());
    }
    return installed == null ? candidate : installed;
  }

  private static VerifiedCredentials merged(
      VerifiedCredentials existing, VerifiedCredentials candidate, BooleanSupplier mayCreate) {
    VerifiedCredentials kept;
    if (existing != null) {
      kept = VerifiedCredentials.newer(existing, candidate);
    } else {
      kept = mayCreate.getAsBoolean() ? candidate : null;
    }
    return kept;
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

  private record BatchOutcome(boolean reconfirmed, boolean deepVerified) {}

  private BatchOutcome sweepBatch(List<CredentialSubject> batch, boolean deep) {
    boolean reconfirmed = reconfirmQuietly(batch);
    boolean deepVerified = !deep || (reconfirmed && deepReadQuietly(batch));
    return new BatchOutcome(reconfirmed, deepVerified);
  }

  private boolean reconfirmQuietly(List<CredentialSubject> batch) {
    boolean succeeded = false;
    try {
      reconfirm(batch);
      succeeded = true;
    } catch (RuntimeException failure) {
      LOG.warn(
          "Credential sweep batch of {} subjects failed; their entries age out until a pass succeeds",
          batch.size(),
          failure);
    }
    return succeeded;
  }

  /** The deep verify: every decrypt forced, so a secret edited inside the secrets manager is seen. */
  private boolean deepReadQuietly(List<CredentialSubject> batch) {
    boolean succeeded = false;
    try {
      reread(batch, ReadReason.DEEP, Map.of());
      metrics.recordSweepQuery(SweepQuery.FULL);
      succeeded = true;
    } catch (RuntimeException failure) {
      LOG.warn(
          "Deep credential verification of {} subjects failed; they stay trusted by fingerprint and"
              + " the pass is retried in {} ms",
          batch.size(),
          TimeUnit.NANOSECONDS.toMillis(deepRetryIntervalNanos),
          failure);
    }
    return succeeded;
  }

  /** One fingerprint query for the batch, then a full read of only the subjects that moved. */
  private void reconfirm(List<CredentialSubject> batch) {
    long stamp = ticker.read();
    Map<CredentialSubject, SourceFingerprint> fingerprints = source.fingerprints(batch);
    metrics.recordSweepQuery(SweepQuery.FINGERPRINT);
    List<CredentialSubject> changed = confirm(batch, fingerprints, stamp);
    metrics.recordSweepChanged(changed.size());
    if (!changed.isEmpty()) {
      reread(changed, ReadReason.SWEEP, cachedRecords(changed));
      metrics.recordSweepQuery(SweepQuery.FULL);
    }
  }

  /**
   * Moves the trust stamp of each entry whose own fingerprint the later query returned and lists
   * the cached subjects whose fingerprint differs. The entries are read quietly and confirmed in
   * place, so a reconfirmation is neither a cache write nor an access: a confirmation that lands on
   * an entry a newer read has replaced meanwhile changes nothing the cache holds, and an entry that
   * idled out stays absent.
   */
  private List<CredentialSubject> confirm(
      List<CredentialSubject> batch,
      Map<CredentialSubject, SourceFingerprint> fingerprints,
      long stamp) {
    List<CredentialSubject> changed = new ArrayList<>();
    for (CredentialSubject subject : batch) {
      SourceFingerprint fingerprint = fingerprints.getOrDefault(subject, SourceFingerprint.ABSENT);
      VerifiedCredentials entry = entries.policy().getIfPresentQuietly(subject);
      if (entry != null && !entry.confirm(fingerprint, stamp)) {
        changed.add(subject);
      }
    }
    return changed;
  }

  /** A sweep's or a deep verify's read: it replaces cached entries and never creates one. */
  private void reread(
      List<CredentialSubject> subjects,
      ReadReason reason,
      Map<CredentialSubject, CredentialRecord> previous) {
    long stamp = ticker.read();
    Map<CredentialSubject, CredentialRecord> records = timedRead(subjects, previous, reason);
    for (CredentialSubject subject : subjects) {
      CredentialRecord record = records.get(subject);
      if (record != null) {
        install(subject, new VerifiedCredentials(record, stamp), NEVER_CREATES);
      }
    }
  }

  /**
   * A refresh or nudge read. It registers for each subject, superseding the read in flight, and is
   * stamped after that, so a check that begins later joins it and no read registered earlier can
   * create the subject's entry from then on.
   */
  private void rereadQuietly(List<CredentialSubject> subjects, ReadReason reason) {
    Map<CredentialSubject, InFlightRead> reads = new HashMap<>();
    subjects.forEach(subject -> reads.put(subject, supersede(subject)));
    try {
      readAndInstall(reads, ticker.read(), reason);
    } catch (RuntimeException failure) {
      LOG.warn(
          "Could not re-read {} credential subjects after a {}; the sweep converges within the bound",
          subjects.size(),
          reason,
          failure);
    }
  }

  private InFlightRead supersede(CredentialSubject subject) {
    InFlightRead mine = new InFlightRead();
    InFlightRead previous = inFlight.put(subject, mine);
    if (previous != null) {
      previous.superseded = true;
    }
    return mine;
  }

  /**
   * Clears the pending flag before it takes the queued subjects, so a nudge queued after it took
   * them schedules the next drain.
   */
  private void drainNudges() {
    drainScheduled.set(false);
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

  /** A stop that took the scheduler before this call scheduled on it leaves it shut down. */
  private void scheduleSweeps(ScheduledExecutorService scheduler) {
    try {
      scheduler.scheduleWithFixedDelay(
          this::sweepSafely, 0, config.sweepIntervalNanos(), TimeUnit.NANOSECONDS);
      LOG.info(
          "Credential verifier started: maxStaleness={} sweepInterval={}",
          config.maxStaleness(),
          config.sweepInterval());
    } catch (RejectedExecutionException stopped) {
      LOG.debug("Credential sweeps not scheduled; the verifier was stopped meanwhile", stopped);
    }
  }

  /** At most one drain waits on the sweep thread, however many nudges arrive meanwhile. */
  private void scheduleDrain() {
    ScheduledExecutorService running = sweeper.get();
    if (running != null && drainScheduled.compareAndSet(false, true)) {
      try {
        running.execute(this::drainNudges);
      } catch (RejectedExecutionException stopped) {
        drainScheduled.set(false);
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

  /**
   * The registry is read before the cache. A read leaves the registry once it has finished, its
   * install included, or been superseded, and a superseded read never creates an entry, so when
   * neither holds the subject, no read registered before this call can still create its entry.
   */
  private boolean isCachedOrInFlight(CredentialSubject subject) {
    return inFlight.containsKey(subject) || entries.policy().getIfPresentQuietly(subject) != null;
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
    return daemon(task, SWEEP_THREAD_NAME);
  }

  /**
   * Checks' reads run here, on platform threads because JDBC drivers pin a virtual carrier under
   * {@code synchronized}; a check waits for its read within its own budget, and a read that outlives
   * it finishes in the background. The pool is as wide as maxConcurrentRequestReads. Its queue
   * holds QUEUED_READS_PER_THREAD reads per thread and sheds the rest, so a database that stops
   * answering cannot grow it without bound. Idle threads exit.
   */
  private static ThreadPoolExecutor readPool(int threads) {
    ThreadPoolExecutor pool =
        new ThreadPoolExecutor(
            threads,
            threads,
            READ_THREAD_IDLE_SECONDS,
            TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(threads * QUEUED_READS_PER_THREAD),
            task -> daemon(task, READ_THREAD_NAME_PREFIX + READ_THREADS.incrementAndGet()));
    pool.allowCoreThreadTimeOut(true);
    return pool;
  }

  private static Thread daemon(Runnable task, String name) {
    Thread thread = new Thread(task, name);
    thread.setDaemon(true);
    return thread;
  }
}
