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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bench.BenchmarkMetrics;
import org.openmetadata.it.bootstrap.ForkedServerNode;
import org.openmetadata.it.bootstrap.ForkedServerNode.Settings;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.CredentialFixtures;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;

/**
 * A burst of personal access token creations on server A, with a second server B in its own JVM
 * that has the owners cached: 1000 creates over 10 s across 100 owners, at a fixed offered rate of
 * 100 per second. Per repetition the report gives the statements B ran to re-read the owners (its
 * reads by reason and its sweep statements, scraped from its {@code /prometheus}), the p95 latency
 * of the creates on A, the errors, and the CPU of each process.
 *
 * <p>Any create that does not answer 200 voids the run. The work is proved by sending every created
 * token to B afterwards: all of them must be accepted, so B really did see the new tokens.
 *
 * <p>The limiter is named from the evidence. The offered rate is fixed, so the achieved rate equals
 * it unless A saturates. The busiest of A with the load generator (one JVM), B, and the database
 * container is reported with its cores. Three repetitions give the spread.
 */
@Tag("scale")
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class CredentialPatBurstIT {
  private static final int OWNERS = 100;
  private static final int CREATES = 1000;
  private static final Duration WINDOW = Duration.ofSeconds(10);
  private static final int REPEATS = 3;
  private static final int PROOF_WIDTH = 16;
  private static final String CREATE_PATH = "/api/v1/users/security/token";
  private static final List<String> READ_REASONS =
      List.of("miss", "stale", "unknown_token", "sweep", "deep", "nudge", "refresh");

  private static ForkedServerNode nodeB;

  @BeforeAll
  static void startNodeB() {
    nodeB = ForkedServerNode.start(Settings.DEFAULT);
  }

  @AfterAll
  static void stopNodeB() {
    if (nodeB != null) {
      nodeB.close();
    }
  }

  private record Owner(User user, String loginToken) {}

  private record Created(int status, double millis, String token) {}

  @Test
  void patBurstOnAIsReReadByB(TestNamespace ns) throws Exception {
    List<Owner> owners = warmedOwners(ns);
    List<Map<String, Object>> repetitions = new ArrayList<>();
    for (int rep = 0; rep < REPEATS; rep++) {
      repetitions.add(burst(owners, rep));
    }
    Map<String, Object> report = new LinkedHashMap<>();
    report.put("owners", OWNERS);
    report.put("createsPerRepetition", CREATES);
    report.put("windowSeconds", WINDOW.toSeconds());
    report.put("maxStalenessMillis", CredentialSourceTestSupport.serverMaxStaleness().toMillis());
    report.put("repetitions", repetitions);
    report.put("p95CreateMillisSpread", spread(repetitions, "createP95Millis"));
    report.put("bReReadStatementsSpread", spread(repetitions, "bReReadStatements"));
    BenchmarkMetrics.write(report, "credential-pat-burst.json");
    assertTrue(
        repetitions.stream().allMatch(r -> (int) r.get("errors") == 0),
        "creates failed: " + repetitions);
    assertTrue(
        repetitions.stream().allMatch(r -> (int) r.get("acceptedOnB") == CREATES),
        "tokens B did not accept: " + repetitions);
  }

  private List<Owner> warmedOwners(TestNamespace ns) {
    List<User> users =
        CredentialPopulation.inParallel(
            OWNERS, PROOF_WIDTH, i -> CredentialFixtures.createUser(ns, "pbo" + i));
    List<Owner> owners = new ArrayList<>();
    for (User user : users) {
      String seed = CredentialFixtures.createPat(user, "seed").getJwtToken();
      assertEquals(200, statusOnB(seed), "B caches the owner " + user.getName());
      owners.add(new Owner(user, CredentialFixtures.loginToken(user)));
    }
    return owners;
  }

  private Map<String, Object> burst(List<Owner> owners, int repetition) throws Exception {
    Counters before = Counters.read(nodeB);
    List<Created> created = createAtOfferedRate(owners, repetition);
    Counters after = Counters.read(nodeB);
    Map<String, Object> result = summarize(created, before, after);
    long proofStart = System.nanoTime();
    result.put("acceptedOnB", acceptOnB(created));
    result.put("secondsUntilAllAcceptedOnB", (System.nanoTime() - proofStart) / 1e9);
    return result;
  }

  private List<Created> createAtOfferedRate(List<Owner> owners, int repetition)
      throws InterruptedException, ExecutionException {
    AtomicInteger next = new AtomicInteger();
    CountDownLatch allSent = new CountDownLatch(1);
    List<Future<Created>> pending = new CopyOnWriteArrayList<>();
    long periodMicros = WINDOW.toNanos() / CREATES / 1000;
    try (ExecutorService workers = Executors.newVirtualThreadPerTaskExecutor();
        ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor()) {
      clock.scheduleAtFixedRate(
          () -> tick(owners, repetition, next, workers, pending, allSent),
          0,
          periodMicros,
          TimeUnit.MICROSECONDS);
      allSent.await();
      clock.shutdown();
      List<Created> done = new ArrayList<>();
      for (Future<Created> future : pending) {
        done.add(future.get());
      }
      return done;
    }
  }

  private void tick(
      List<Owner> owners,
      int repetition,
      AtomicInteger next,
      ExecutorService workers,
      List<Future<Created>> pending,
      CountDownLatch allSent) {
    int i = next.getAndIncrement();
    if (i < CREATES) {
      Owner owner = owners.get(i % OWNERS);
      pending.add(workers.submit(() -> create(owner, "b" + repetition + "-" + i)));
    }
    if (i == CREATES - 1) {
      allSent.countDown();
    }
  }

  private Created create(Owner owner, String tokenName) {
    String body = "{\"tokenName\":\"" + tokenName + "\",\"JWTTokenExpiry\":\"OneHour\"}";
    long start = System.nanoTime();
    HttpResponse<String> response = CredentialFixtures.put(CREATE_PATH, owner.loginToken(), body);
    double millis = (System.nanoTime() - start) / 1e6;
    String token = null;
    if (response.statusCode() == 200) {
      token = JsonUtils.readValue(response.body(), PersonalAccessToken.class).getJwtToken();
    }
    return new Created(response.statusCode(), millis, token);
  }

  private Map<String, Object> summarize(List<Created> created, Counters before, Counters after) {
    double[] millis = created.stream().mapToDouble(Created::millis).toArray();
    int errors = (int) created.stream().filter(c -> c.status() != 200).count();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("creates", created.size());
    result.put("errors", errors);
    result.put("createP50Millis", Percentiles.of(millis, 50));
    result.put("createP95Millis", Percentiles.of(millis, 95));
    result.put("createMaxMillis", Percentiles.of(millis, 100));
    result.put("bReadsByReason", after.readsDelta(before));
    result.put("bFullSweepStatements", after.fullSweeps() - before.fullSweeps());
    result.put(
        "bFingerprintSweepStatements", after.fingerprintSweeps() - before.fingerprintSweeps());
    result.put(
        "bReReadStatements",
        after.fullSweeps() - before.fullSweeps() + after.otherReads() - before.otherReads());
    result.putAll(limiter(before, after));
    return result;
  }

  private Map<String, Object> limiter(Counters before, Counters after) {
    double seconds = (after.wallNanos() - before.wallNanos()) / 1e9;
    Map<String, Double> cores = new LinkedHashMap<>();
    cores.put(
        "suiteJvmWithServerAAndGenerator", (after.suiteCpu() - before.suiteCpu()) / 1e9 / seconds);
    cores.put("serverB", (after.nodeBCpu() - before.nodeBCpu()) / 1e9 / seconds);
    cores.put("databaseContainer", (after.dbCpu() - before.dbCpu()) / 1e9 / seconds);
    String busiest =
        cores.entrySet().stream().max(Map.Entry.comparingByValue()).orElseThrow().getKey();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("windowSeconds", seconds);
    result.put("achievedCreatesPerSecond", CREATES / seconds);
    result.put("offeredCreatesPerSecond", CREATES / (double) WINDOW.toSeconds());
    result.put("cpuCores", cores);
    result.put("busiest", busiest);
    result.put("machineLoad", JvmCpu.machineLoad());
    return result;
  }

  private int acceptOnB(List<Created> created) {
    List<String> tokens = created.stream().map(Created::token).toList();
    Awaitility.await("B accepts every PAT created in the burst")
        .atMost(CredentialSourceTestSupport.serverMaxStaleness().plusSeconds(1))
        .pollInterval(100, TimeUnit.MILLISECONDS)
        .until(() -> acceptedCount(tokens) == tokens.size());
    return acceptedCount(tokens);
  }

  private int acceptedCount(List<String> tokens) {
    return (int)
        CredentialPopulation.inParallel(tokens.size(), PROOF_WIDTH, i -> statusOnB(tokens.get(i)))
            .stream()
            .filter(status -> status == 200)
            .count();
  }

  private static int statusOnB(String token) {
    return CredentialFixtures.status(nodeB.apiBase().toString(), LOGGED_IN_USER, token);
  }

  private static String spread(List<Map<String, Object>> repetitions, String key) {
    return Percentiles.spread(
        repetitions.stream().map(r -> ((Number) r.get(key)).doubleValue()).toList(), "%.1f");
  }

  /** What server B's meters and the processes' CPU read at one instant. */
  private record Counters(
      Map<String, Double> reads,
      double fullSweeps,
      double fingerprintSweeps,
      long suiteCpu,
      long nodeBCpu,
      long dbCpu,
      long wallNanos) {

    static Counters read(ForkedServerNode node) {
      Map<String, Double> reads = new LinkedHashMap<>();
      READ_REASONS.forEach(
          reason -> reads.put(reason, node.metric("om_credential_reads_total", "reason", reason)));
      String db = TestSuiteBootstrap.getDatabaseContainer().getContainerId();
      return new Counters(
          reads,
          node.metric("om_credential_sweep_queries_total", "query", "full"),
          node.metric("om_credential_sweep_queries_total", "query", "fingerprint"),
          JvmCpu.processCpuNanos(),
          node.cpuTime().toNanos(),
          ContainerCpu.usedNanos(db),
          System.nanoTime());
    }

    Map<String, Double> readsDelta(Counters before) {
      Map<String, Double> delta = new LinkedHashMap<>();
      reads.forEach((reason, count) -> delta.put(reason, count - before.reads.get(reason)));
      return delta;
    }

    /** Reads outside the sweep: request-thread loads, nudges and post-commit refreshes. */
    double otherReads() {
      return reads.entrySet().stream()
          .filter(read -> !read.getKey().equals("sweep") && !read.getKey().equals("deep"))
          .mapToDouble(Map.Entry::getValue)
          .sum();
    }
  }
}
