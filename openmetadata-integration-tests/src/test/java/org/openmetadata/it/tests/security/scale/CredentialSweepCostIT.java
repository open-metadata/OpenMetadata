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

package org.openmetadata.it.tests.security.scale;

import io.dropwizard.util.Duration;
import io.micrometer.core.instrument.Timer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bench.BenchmarkMetrics;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.security.scale.CredentialPopulation.Principal;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport.TestVerifier;
import org.openmetadata.service.security.credentials.CredentialVerificationConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * What an idle server spends on the credential sweep. A verifier of this JVM, with its own config
 * and meters, caches N principals and then idles; the test reads its counters, the database's own
 * statement statistics and the database container's CPU over the idle window.
 *
 * <p>Each cell reports: sweep statements per second against the {@code ceil(N/batchSize)} per
 * sweepInterval the design predicts (plus the deep verify's share); the duration of every sweep;
 * the database's calls and rows examined for the credential statements, or which statistics were
 * unreadable; the database container's CPU; and the forced deep verify's duration and decrypts.
 *
 * <p>The limiter to look for is database CPU spent hashing each cached user's mechanism JSON. The
 * measured window is idle apart from this verifier, so the class runs {@link Isolated}. The
 * server's own verifier also sweeps, over the few principals the suite has used; the database
 * figures include it, and the report names that.
 */
@Tag("scale")
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class CredentialSweepCostIT {
  private static final Logger LOG = LoggerFactory.getLogger(CredentialSweepCostIT.class);
  private static final int[] PRINCIPALS = {250, 1000, 4000};
  private static final int[] PATS_PER_USER = {20, 5, 1};
  private static final int BOT_EVERY = 10;
  private static final int WARM_WIDTH = 16;
  private static final long SAMPLE_MILLIS = 25;
  private static final long IDLE_SECONDS = Long.getLong("credential.sweep.idleSeconds", 60);
  private static final long DEEP_SECONDS = 30;
  private static final CredentialVerificationConfig CONFIG =
      new CredentialVerificationConfig(
          null, null, null, null, null, null, 4000, null, Duration.seconds(DEEP_SECONDS));

  private final CredentialMeters server = CredentialMeters.ofServer();

  @Test
  void sweepCostByCachedPrincipalsAndPatsPerUser(TestNamespace ns) throws Exception {
    long setupStarted = System.nanoTime();
    List<Principal> population = population(ns);
    double setupSeconds = (System.nanoTime() - setupStarted) / 1e9;
    TokenRepository tokens = new TokenRepository();
    List<Map<String, Object>> cells = new ArrayList<>();
    for (int pats : PATS_PER_USER) {
      population.forEach(p -> p.keepPats(pats, tokens));
      for (int cached : PRINCIPALS) {
        cells.add(measure(population.subList(0, cached), pats));
      }
    }
    Map<String, Object> report = new LinkedHashMap<>();
    report.put("setupSeconds", setupSeconds);
    report.put("idleSeconds", IDLE_SECONDS);
    report.put("deepVerifyIntervalSeconds", DEEP_SECONDS);
    report.put("botShare", 1.0 / BOT_EVERY);
    report.put("cells", cells);
    BenchmarkMetrics.write(report, "credential-sweep-cost.json");
    cells.forEach(cell -> LOG.info("{}", cell));
  }

  /** Every {@code BOT_EVERY}th principal is a bot, so any prefix has the same mix. */
  private static List<Principal> population(TestNamespace ns) {
    int max = PRINCIPALS[PRINCIPALS.length - 1];
    int bots = max / BOT_EVERY;
    List<Principal> users = CredentialPopulation.users(ns, "sw", max - bots, PATS_PER_USER[0]);
    List<Principal> botList = CredentialPopulation.bots(ns, "sb", bots);
    List<Principal> mixed = new ArrayList<>();
    for (int i = 0; i < max; i++) {
      mixed.add(i % BOT_EVERY == 0 ? botList.get(i / BOT_EVERY) : users.get(i - 1 - i / BOT_EVERY));
    }
    return mixed;
  }

  private Map<String, Object> measure(List<Principal> cached, int pats) throws Exception {
    TestVerifier verifier = CredentialSourceTestSupport.newVerifier(Entity.getJdbi(), CONFIG);
    try {
      warm(verifier, cached);
      return idle(verifier, cached.size(), pats);
    } finally {
      verifier.stop();
    }
  }

  private static void warm(TestVerifier verifier, List<Principal> principals) {
    List<Boolean> accepted =
        CredentialPopulation.inParallel(
            principals.size(),
            WARM_WIDTH,
            i -> verifier.accepts(principals.get(i).name(), principals.get(i).rawToken()));
    if (accepted.contains(false)) {
      throw new IllegalStateException("A warmed principal's own token was not accepted");
    }
  }

  private Map<String, Object> idle(TestVerifier verifier, int cached, int pats)
      throws InterruptedException {
    DatabaseStatementStats database = new DatabaseStatementStats(Entity.getJdbi());
    Map<String, DatabaseStatementStats.Digest> dbBefore = database.snapshot().orElse(Map.of());
    String dbContainer = TestSuiteBootstrap.getDatabaseContainer().getContainerId();
    Counters before = counters(verifier);
    long cpuBefore = ContainerCpu.usedNanos(dbContainer);
    long started = System.nanoTime();
    List<Double> sweepMillis = sweepsWhileIdle(verifier);
    long wallNanos = System.nanoTime() - started;
    long cpuNanos = ContainerCpu.usedNanos(dbContainer) - cpuBefore;
    Counters after = counters(verifier);
    Map<String, DatabaseStatementStats.Digest> dbChange =
        DatabaseStatementStats.delta(dbBefore, database.snapshot().orElse(Map.of()));
    return cell(
        verifier,
        cached,
        pats,
        before,
        after,
        sweepMillis,
        wallNanos,
        cpuNanos,
        dbChange,
        database);
  }

  /** The verifier sweeps from start(); a sampler records the duration of each sweep it sees. */
  private List<Double> sweepsWhileIdle(TestVerifier verifier) throws InterruptedException {
    List<Double> durations = new ArrayList<>();
    Timer sweep = verifier.meters().timer("om.credential.sweep");
    ScheduledExecutorService sampler = Executors.newSingleThreadScheduledExecutor();
    long[] last = {sweep.count(), (long) sweep.totalTime(TimeUnit.NANOSECONDS)};
    sampler.scheduleAtFixedRate(
        () -> sample(sweep, last, durations), 0, SAMPLE_MILLIS, TimeUnit.MILLISECONDS);
    verifier.start();
    CountDownLatch window = new CountDownLatch(1);
    sampler.schedule(window::countDown, IDLE_SECONDS, TimeUnit.SECONDS);
    window.await();
    sampler.shutdownNow();
    synchronized (durations) {
      return new ArrayList<>(durations);
    }
  }

  /** A sweep is recorded only when exactly one finished since the last sample. */
  private static void sample(Timer sweep, long[] last, List<Double> durations) {
    long count = sweep.count();
    long total = (long) sweep.totalTime(TimeUnit.NANOSECONDS);
    if (count - last[0] == 1) {
      synchronized (durations) {
        durations.add((total - last[1]) / 1e6);
      }
    }
    last[0] = count;
    last[1] = total;
  }

  private record Counters(
      double fingerprintQueries,
      double fullQueries,
      double changed,
      double deepReads,
      long deepNanos,
      double decrypts,
      double cached) {}

  private static Counters counters(TestVerifier verifier) {
    CredentialMeters meters = new CredentialMeters(verifier.meters());
    return new Counters(
        meters.counterSum("om.credential.sweep.queries", "query", "fingerprint"),
        meters.counterSum("om.credential.sweep.queries", "query", "full"),
        meters.counterSum("om.credential.sweep.changed.subjects"),
        meters.counterSum("om.credential.reads", "reason", "deep"),
        meters
            .timer("om.credential.read", "reason", "deep")
            .map(t -> (long) t.totalTime(TimeUnit.NANOSECONDS))
            .orElse(0L),
        meters.counterSum("om.credential.decrypts", "outcome", "performed"),
        meters.gauge("om.credential.cached.subjects").orElse(Double.NaN));
  }

  private Map<String, Object> cell(
      TestVerifier verifier,
      int cached,
      int pats,
      Counters before,
      Counters after,
      List<Double> sweepMillis,
      long wallNanos,
      long dbCpuNanos,
      Map<String, DatabaseStatementStats.Digest> dbChange,
      DatabaseStatementStats database) {
    double seconds = wallNanos / 1e9;
    double queries =
        after.fingerprintQueries()
            - before.fingerprintQueries()
            + after.fullQueries()
            - before.fullQueries();
    int batches = (int) Math.ceil(cached / 500.0);
    Map<String, Object> cell = new LinkedHashMap<>();
    cell.put("cachedPrincipals", cached);
    cell.put("patsPerUser", pats);
    cell.put("cachedSubjectsGauge", after.cached());
    cell.put("sweepStatementsPerSecond", queries / seconds);
    cell.put("designStatementsPerSecond", batches / 2.0 + batches / (double) DEEP_SECONDS);
    cell.put("sweepsSeen", sweepMillis.size());
    cell.put("sweepMillisP50", percentile(sweepMillis, 50));
    cell.put("sweepMillisP95", percentile(sweepMillis, 95));
    cell.put("changedSubjects", after.changed() - before.changed());
    cell.put("deepVerifies", after.deepReads() - before.deepReads());
    cell.put("deepMillisTotal", (after.deepNanos() - before.deepNanos()) / 1e6);
    cell.put("decryptsPerformed", after.decrypts() - before.decrypts());
    cell.put("dbContainerCpuCores", dbCpuNanos / (double) wallNanos);
    cell.put("dbStatisticsSource", database.source());
    cell.put("dbStatements", describe(dbChange, seconds));
    return cell;
  }

  private static double percentile(List<Double> values, double percent) {
    return values.isEmpty()
        ? Double.NaN
        : Percentiles.of(values.stream().mapToDouble(Double::doubleValue).toArray(), percent);
  }

  private static List<String> describe(
      Map<String, DatabaseStatementStats.Digest> change, double seconds) {
    List<String> lines = new ArrayList<>();
    change.forEach(
        (text, d) ->
            lines.add(
                "%s statements/s=%.2f rowsExamined/s=%.0f rowsSent/s=%.0f"
                    .formatted(
                        DatabaseStatementStats.isFullRead(text) ? "full-read" : "fingerprint",
                        d.calls() / seconds,
                        d.rowsExamined() / seconds,
                        d.rowsSent() / seconds)));
    return lines;
  }
}
