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

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * The {@code om_credential_*} meters on {@code /prometheus}. Every tag value is an enum here, and
 * every counter the hot path touches is resolved once in the constructor, so a check does no tag
 * lookup and allocates nothing.
 */
final class CredentialMetrics {

  enum ReadReason {
    MISS,
    STALE,
    UNKNOWN_TOKEN,
    SWEEP,
    DEEP,
    NUDGE,
    REFRESH;

    /** A check's own read of one subject, as opposed to a sweep, deep, refresh or nudge read. */
    boolean startedByCheck() {
      return this == MISS || this == STALE || this == UNKNOWN_TOKEN;
    }

    /**
     * Whether a read of this reason may reuse a cached digest. Only reads on the sweep thread do.
     * That thread also runs the deep reads, so the record such a read reuses already holds the
     * latest deep read's result. A read on any other thread can overlap a deep read, so it
     * decrypts.
     */
    boolean reusesDecrypt() {
      return this == SWEEP || this == NUDGE;
    }

    static ReadReason of(CheckDecision load) {
      return switch (load) {
        case LOAD_MISSING -> MISS;
        case LOAD_STALE -> STALE;
        case LOAD_UNKNOWN_TOKEN -> UNKNOWN_TOKEN;
        case ACCEPT, REJECT, DEFER -> throw new IllegalArgumentException(load + " needs no read");
      };
    }
  }

  enum ReadOutcome {
    OK,
    ERROR,
    TIMEOUT,
    NO_PERMIT
  }

  enum UnavailableCause {
    READ_FAILED,
    /** The statement ran, but this subject's rows could not be converted, so nothing confirms it. */
    SUBJECT_READ_FAILED,
    TIMEOUT,
    NO_PERMIT,
    /** A check's read produced no record within missRefreshMinAge, so no read was started. */
    BACKOFF,
    /**
     * An entry read within missRefreshMinAge lacks the token without showing it withdrawn, so the
     * token may be newer than that read. No further read is started.
     */
    DEFERRED,
    /** The thread waiting for a check's read was interrupted; its flag is restored. */
    INTERRUPTED
  }

  enum SweepQuery {
    FINGERPRINT,
    FULL
  }

  enum EvictionCause {
    SIZE,
    IDLE
  }

  enum NudgeOutcome {
    QUEUED,
    DROPPED
  }

  enum DecryptOutcome {
    PERFORMED,
    SKIPPED_UNCHANGED
  }

  private final MeterRegistry registry;
  private final Counter[] checks = new Counter[CheckDecision.values().length];
  private final DistributionSummary acceptedEntryAgeSeconds;
  private final Map<ReadReason, Map<ReadOutcome, Counter>> reads = new EnumMap<>(ReadReason.class);
  private final Map<ReadReason, Timer> readLatency = new EnumMap<>(ReadReason.class);
  private final Timer sweepLatency;
  private final Map<SweepQuery, Counter> sweepQueries;
  private final Counter sweepChangedSubjects;
  private final Map<EvictionCause, Counter> evictions;
  private final Map<NudgeOutcome, Counter> nudgesReceived;
  private final Map<UnavailableCause, Counter> unavailable;
  private final Map<DecryptOutcome, Counter> decrypts;
  private final Counter revocationsObserved;
  private final Counter unreadableSubjects;

  CredentialMetrics(MeterRegistry registry) {
    this.registry = registry;
    for (CheckDecision decision : CheckDecision.values()) {
      checks[decision.ordinal()] = counter("om.credential.checks", "decision", decision);
    }
    this.acceptedEntryAgeSeconds =
        DistributionSummary.builder("om.credential.check.entry.age.seconds")
            .description("Age of the cache entry behind each accepted check")
            .baseUnit("seconds")
            .register(registry);
    for (ReadReason reason : ReadReason.values()) {
      reads.put(reason, byOutcome(reason));
      readLatency.put(
          reason,
          Timer.builder("om.credential.read").tag("reason", tag(reason)).register(registry));
    }
    this.sweepLatency = Timer.builder("om.credential.sweep").register(registry);
    this.sweepQueries =
        perValue(SweepQuery.class, query -> counter("om.credential.sweep.queries", "query", query));
    this.sweepChangedSubjects =
        Counter.builder("om.credential.sweep.changed.subjects").register(registry);
    this.evictions =
        perValue(EvictionCause.class, cause -> counter("om.credential.evictions", "cause", cause));
    this.nudgesReceived =
        perValue(
            NudgeOutcome.class,
            outcome ->
                Counter.builder("om.credential.nudges")
                    .tag("direction", "received")
                    .tag("outcome", tag(outcome))
                    .register(registry));
    this.unavailable =
        perValue(
            UnavailableCause.class, cause -> counter("om.credential.unavailable", "cause", cause));
    this.decrypts =
        perValue(
            DecryptOutcome.class, outcome -> counter("om.credential.decrypts", "outcome", outcome));
    this.revocationsObserved =
        Counter.builder("om.credential.revocations.observed").register(registry);
    this.unreadableSubjects =
        Counter.builder("om.credential.reads.unreadable.subjects")
            .description("Subjects whose stored credentials a full read could not convert")
            .register(registry);
  }

  void registerGauges(
      Supplier<Number> cachedSubjects, Supplier<Number> lastCompleteSweepAgeSeconds) {
    Gauge.builder("om.credential.cached.subjects", cachedSubjects).register(registry);
    Gauge.builder("om.credential.sweep.last.complete.age.seconds", lastCompleteSweepAgeSeconds)
        .baseUnit("seconds")
        .register(registry);
  }

  void recordCheck(CheckDecision decision, long entryAgeNanos) {
    checks[decision.ordinal()].increment();
    if (decision == CheckDecision.ACCEPT) {
      acceptedEntryAgeSeconds.record(Math.max(0, entryAgeNanos) / 1e9);
    }
  }

  void recordRead(ReadReason reason, ReadOutcome outcome, long durationNanos) {
    reads.get(reason).get(outcome).increment();
    readLatency.get(reason).record(Math.max(0, durationNanos), TimeUnit.NANOSECONDS);
  }

  void recordSweep(long durationNanos) {
    sweepLatency.record(Math.max(0, durationNanos), TimeUnit.NANOSECONDS);
  }

  void recordSweepQuery(SweepQuery query) {
    sweepQueries.get(query).increment();
  }

  void recordSweepChanged(int subjects) {
    sweepChangedSubjects.increment(subjects);
  }

  void recordEviction(EvictionCause cause) {
    evictions.get(cause).increment();
  }

  void recordNudgeReceived(NudgeOutcome outcome) {
    nudgesReceived.get(outcome).increment();
  }

  void recordUnavailable(UnavailableCause cause) {
    unavailable.get(cause).increment();
  }

  void recordDecrypt(DecryptOutcome outcome) {
    decrypts.get(outcome).increment();
  }

  void recordRevocationObserved() {
    revocationsObserved.increment();
  }

  void recordUnreadableSubjects(long subjects) {
    unreadableSubjects.increment(subjects);
  }

  private Map<ReadOutcome, Counter> byOutcome(ReadReason reason) {
    return perValue(
        ReadOutcome.class,
        outcome ->
            Counter.builder("om.credential.reads")
                .tag("reason", tag(reason))
                .tag("outcome", tag(outcome))
                .register(registry));
  }

  private <E extends Enum<E>> Counter counter(String name, String tagKey, E tagValue) {
    return Counter.builder(name).tag(tagKey, tag(tagValue)).register(registry);
  }

  private static <E extends Enum<E>> Map<E, Counter> perValue(
      Class<E> type, Function<E, Counter> counter) {
    Map<E, Counter> counters = new EnumMap<>(type);
    for (E value : type.getEnumConstants()) {
      counters.put(value, counter.apply(value));
    }
    return counters;
  }

  private static String tag(Enum<?> value) {
    return value.name().toLowerCase(Locale.ROOT);
  }
}
