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
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.LongAdder;
import java.util.function.ToDoubleFunction;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bench.BenchmarkMetrics;
import org.openmetadata.it.tests.CredentialFixtures;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Latency and throughput of {@code GET /v1/users/loggedInUser} authenticated by a bot token, by a
 * personal access token, and by a session token of the same principal (the control, which has no
 * stored check), and the cost of a credential's first request.
 *
 * <p>Compile-time it touches only REST, {@link CredentialFixtures} and the global meter registry
 * read by name, so the same source runs against a build that has no verifier: its meters are then
 * absent, the proof-of-work checks are skipped and the report says so. Run it against both builds
 * and compare the two reports. Files that must travel to the other build: this class, {@code
 * LoadCell}, {@code CredentialMeters}, {@code CredentialPopulation}, {@code Percentiles}, {@code
 * JvmCpu}, and {@code CredentialFixtures} with the bootstrap and bench classes it already uses.
 *
 * <p>What limits a number: the client and the server share one JVM, so every cell records process
 * CPU and a cell that uses most of the cores is flagged JVM-bound; its figures describe the JVM,
 * not the server. A cell with any non-200 voids the run. Properties {@code credential.bench.*}
 * shorten the run for a smoke test; the defaults are the measured configuration.
 */
@Tag("scale")
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class CredentialAuthBenchIT {
  private static final Logger LOG = LoggerFactory.getLogger(CredentialAuthBenchIT.class);
  private static final int[] CONCURRENCY = {1, 16, 64};
  private static final String[] CELLS = {"control-bot", "bot", "control-pat", "pat"};
  private static final Duration WARM_UP = seconds("credential.bench.warmUpSeconds", 10);
  private static final Duration MEASURE = seconds("credential.bench.measureSeconds", 30);
  private static final int REPETITIONS = Integer.getInteger("credential.bench.repetitions", 3);
  private static final int COLD_PRINCIPALS = Integer.getInteger("credential.bench.cold", 1000);
  private static final int STATEMENT_REQUESTS = 200;
  private static final int COLD_CONCURRENCY = 64;

  private final CredentialMeters meters = CredentialMeters.ofServer();
  private final List<String> problems = new ArrayList<>();

  /** Meter readings that bracket a window. */
  private record Reading(double accepts, double requestReads, CredentialMeters.TimerTotals auth) {}

  private record Cell(
      int repetition,
      int concurrency,
      String label,
      LoadCell.Result result,
      double acceptsDelta,
      double requestReadsAfterWarmUp,
      double serverAuthMeanMillis,
      double machineLoad) {}

  private record Tokens(String bot, String pat, String controlBot, String controlPat) {
    String of(String label) {
      return switch (label) {
        case "bot" -> bot;
        case "pat" -> pat;
        case "control-bot" -> controlBot;
        default -> controlPat;
      };
    }
  }

  @Test
  void latencyAndThroughputByConcurrency(TestNamespace ns) throws Exception {
    Tokens tokens = tokens(ns);
    Map<String, Object> statements = statementsPerRequest(tokens);
    List<Cell> cells = new ArrayList<>();
    for (int repetition = 1; repetition <= REPETITIONS; repetition++) {
      for (int concurrency : CONCURRENCY) {
        for (String label : CELLS) {
          cells.add(runCell(repetition, concurrency, label, tokens.of(label)));
        }
      }
    }
    publish("credential-auth-bench.json", report(cells, statements));
    failOnProblems();
  }

  @Test
  void firstRequestOfEveryPrincipalAtConcurrencySixtyFour(TestNamespace ns) throws Exception {
    List<String> tokens = coldTokens(ns);
    double missesBefore = misses();
    long startedAt = System.nanoTime();
    ColdRun run = sendOnce(tokens);
    double elapsedSeconds = (System.nanoTime() - startedAt) / 1e9;
    double missReads = misses() - missesBefore;
    Map<String, Object> report = coldReport(run, elapsedSeconds, missReads, tokens.size());
    publish("credential-auth-bench-cold.json", report);
    checkCold(run, missReads, tokens.size());
    failOnProblems();
  }

  private Tokens tokens(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "benchbot");
    User owner = CredentialFixtures.createUser(ns, "benchown");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("benchpat"));
    return new Tokens(
        CredentialFixtures.botToken(bot),
        pat.getJwtToken(),
        CredentialFixtures.loginToken(bot),
        CredentialFixtures.loginToken(owner));
  }

  private Cell runCell(int repetition, int concurrency, String label, String token)
      throws InterruptedException, ExecutionException {
    Reading before = read();
    Reading[] windowOpen = new Reading[1];
    LoadCell.Result result =
        LoadCell.run(
            LOGGED_IN_USER, token, concurrency, WARM_UP, MEASURE, () -> windowOpen[0] = read());
    Reading after = read();
    Cell cell =
        new Cell(
            repetition,
            concurrency,
            label,
            result,
            after.accepts() - before.accepts(),
            after.requestReads() - windowOpen[0].requestReads(),
            authMeanMillis(windowOpen[0], after),
            JvmCpu.machineLoad());
    verifyCell(cell);
    return cell;
  }

  private void verifyCell(Cell cell) {
    String where = "rep %d c=%d %s".formatted(cell.repetition(), cell.concurrency(), cell.label());
    if (cell.result().errors() > 0) {
      problems.add(where + ": " + cell.result().errors() + " non-200, " + cell.result().statuses());
    }
    if (meters.verifierPresent()) {
      double expected = cell.label().startsWith("control") ? 0 : cell.result().sent();
      expectEqual(where + ": ACCEPT checks vs requests sent", expected, cell.acceptsDelta());
      expectEqual(
          where + ": request-thread reads after warm-up", 0, cell.requestReadsAfterWarmUp());
    }
  }

  private void expectEqual(String what, double expected, double actual) {
    if (expected != actual) {
      problems.add(what + ": expected " + expected + " but saw " + actual);
    }
  }

  private Reading read() {
    return new Reading(
        meters.counterSum("om.credential.checks", "decision", "accept"),
        checkReads(),
        meters.timerTotals("request.latency.auth"));
  }

  private double checkReads() {
    return meters.counterSum("om.credential.reads", "reason", "miss")
        + meters.counterSum("om.credential.reads", "reason", "stale")
        + meters.counterSum("om.credential.reads", "reason", "unknown_token");
  }

  private static double authMeanMillis(Reading from, Reading to) {
    long count = to.auth().count() - from.auth().count();
    return count == 0 ? Double.NaN : (to.auth().totalMillis() - from.auth().totalMillis()) / count;
  }

  /** Statements a request issues, counted on the server, for each credential and its control. */
  private Map<String, Object> statementsPerRequest(Tokens tokens) {
    Map<String, Object> perRequest = new LinkedHashMap<>();
    perRequest.put("bot", statementPair(tokens.controlBot(), tokens.bot()));
    perRequest.put("pat", statementPair(tokens.controlPat(), tokens.pat()));
    return perRequest;
  }

  private Map<String, Object> statementPair(String controlToken, String credentialToken) {
    for (int i = 0; i < 20; i++) {
      CredentialFixtures.status(LOGGED_IN_USER, controlToken);
      CredentialFixtures.status(LOGGED_IN_USER, credentialToken);
    }
    int control = 0;
    int credential = 0;
    double readsBefore = checkReads();
    try (SqlQueryCounter counter = SqlQueryCounter.forRequests(Entity.getJdbi(), "")) {
      for (int i = 0; i < STATEMENT_REQUESTS; i++) {
        int before = counter.count();
        assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, controlToken));
        int afterControl = counter.count();
        assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, credentialToken));
        control += afterControl - before;
        credential += counter.count() - afterControl;
      }
    }
    if (meters.verifierPresent()) {
      expectEqual("statements per " + STATEMENT_REQUESTS + " requests", control, credential);
      expectEqual(
          "check reads over " + STATEMENT_REQUESTS + " requests", 0, checkReads() - readsBefore);
    }
    return Map.of("controlStatements", control, "credentialStatements", credential);
  }

  /** Principals the server has never seen: the in-process server cannot be restarted. */
  private List<String> coldTokens(TestNamespace ns) {
    int half = COLD_PRINCIPALS / 2;
    List<String> tokens = new ArrayList<>();
    CredentialPopulation.bots(ns, "coldbot", half).forEach(p -> tokens.add(p.rawToken()));
    CredentialPopulation.users(ns, "coldown", COLD_PRINCIPALS - half, 1)
        .forEach(p -> tokens.add(p.rawToken()));
    return tokens;
  }

  private record ColdRun(double p99Millis, Map<Integer, Long> statuses) {}

  private ColdRun sendOnce(List<String> tokens) throws InterruptedException, ExecutionException {
    AtomicInteger next = new AtomicInteger();
    double[] millis = new double[tokens.size()];
    Map<Integer, LongAdder> statuses = new ConcurrentHashMap<>();
    try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {
      List<Future<?>> workers = new ArrayList<>();
      for (int i = 0; i < COLD_CONCURRENCY; i++) {
        workers.add(pool.submit(() -> drain(tokens, next, millis, statuses)));
      }
      for (Future<?> worker : workers) {
        worker.get();
      }
    }
    Map<Integer, Long> counted = new TreeMap<>();
    statuses.forEach((status, count) -> counted.put(status, count.sum()));
    return new ColdRun(Percentiles.of(millis, 99), counted);
  }

  private static void drain(
      List<String> tokens, AtomicInteger next, double[] millis, Map<Integer, LongAdder> statuses) {
    for (int i = next.getAndIncrement(); i < tokens.size(); i = next.getAndIncrement()) {
      long start = System.nanoTime();
      int status = CredentialFixtures.status(LOGGED_IN_USER, tokens.get(i));
      millis[i] = (System.nanoTime() - start) / 1e6;
      statuses.computeIfAbsent(status, ignored -> new LongAdder()).increment();
    }
  }

  private double misses() {
    return meters.counterSum("om.credential.reads", "reason", "miss", "outcome", "ok");
  }

  private Map<String, Object> coldReport(
      ColdRun run, double elapsedSeconds, double missReads, int principals) {
    Map<String, Object> report = new LinkedHashMap<>();
    report.put("verifierPresent", meters.verifierPresent());
    report.put("principals", principals);
    report.put("concurrency", COLD_CONCURRENCY);
    report.put("secondsUntilAllAnswered", elapsedSeconds);
    report.put("p99Millis", run.p99Millis());
    report.put("statuses", run.statuses());
    report.put("missReads", missReads);
    report.put("note", "principals created for this run; the in-process server cannot restart");
    return report;
  }

  private void checkCold(ColdRun run, double missReads, int principals) {
    long answered = run.statuses().values().stream().mapToLong(Long::longValue).sum();
    expectEqual("answers", principals, answered);
    expectEqual("200 answers", principals, run.statuses().getOrDefault(200, 0L));
    if (meters.verifierPresent()) {
      expectEqual("miss reads", principals, missReads);
    }
  }

  private Map<String, Object> report(List<Cell> cells, Map<String, Object> statements) {
    Map<String, Object> report = new LinkedHashMap<>();
    report.put("verifierPresent", meters.verifierPresent());
    report.put("warmUpSeconds", WARM_UP.toSeconds());
    report.put("measureSeconds", MEASURE.toSeconds());
    report.put("repetitions", REPETITIONS);
    report.put("cores", JvmCpu.cores());
    report.put("statementsPerRequestSet", statements);
    report.put("cells", cells.stream().map(CredentialAuthBenchIT::row).toList());
    report.put("summary", summary(cells));
    summary(cells).forEach(LOG::info);
    return report;
  }

  private static Map<String, Object> row(Cell cell) {
    LoadCell.Result r = cell.result();
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("repetition", cell.repetition());
    row.put("concurrency", cell.concurrency());
    row.put("cell", cell.label());
    row.put("sent", r.sent());
    row.put("measured", r.measured());
    row.put("errors", r.errors());
    row.put("p50Micros", r.p50Micros());
    row.put("p95Micros", r.p95Micros());
    row.put("p99Micros", r.p99Micros());
    row.put("requestsPerSecond", r.requestsPerSecond());
    row.put("jvmCpuCores", r.cpuCores());
    row.put("jvmBound", r.jvmBound());
    row.put("acceptChecksDelta", cell.acceptsDelta());
    row.put("requestThreadReadsAfterWarmUp", cell.requestReadsAfterWarmUp());
    row.put("serverAuthMeanMillis", cell.serverAuthMeanMillis());
    row.put("machineLoad", cell.machineLoad());
    return row;
  }

  /** One line per concurrency and cell: the median over repetitions with the range. */
  private static List<String> summary(List<Cell> cells) {
    List<String> lines = new ArrayList<>();
    for (int concurrency : CONCURRENCY) {
      for (String label : CELLS) {
        List<Cell> group =
            cells.stream()
                .filter(c -> c.concurrency() == concurrency && c.label().equals(label))
                .toList();
        lines.add(summaryLine(concurrency, label, group));
      }
    }
    return lines;
  }

  private static String summaryLine(int concurrency, String label, List<Cell> group) {
    return "c=%d %-11s p50 %s us | p95 %s us | p99 %s us | %s req/s | JVM CPU %s cores%s"
        .formatted(
            concurrency,
            label,
            Percentiles.spread(values(group, c -> c.result().p50Micros()), "%.0f"),
            Percentiles.spread(values(group, c -> c.result().p95Micros()), "%.0f"),
            Percentiles.spread(values(group, c -> c.result().p99Micros()), "%.0f"),
            Percentiles.spread(values(group, c -> c.result().requestsPerSecond()), "%.0f"),
            Percentiles.spread(values(group, c -> c.result().cpuCores()), "%.1f"),
            group.stream().anyMatch(c -> c.result().jvmBound()) ? " JVM-BOUND" : "");
  }

  private static List<Double> values(List<Cell> group, ToDoubleFunction<Cell> field) {
    return group.stream().map(c -> field.applyAsDouble(c)).toList();
  }

  private static void publish(String file, Map<String, Object> report) throws IOException {
    BenchmarkMetrics.write(report, file);
    LOG.info("{}\n{}", file, report);
  }

  private void failOnProblems() {
    if (!problems.isEmpty()) {
      fail("The run is void:\n" + String.join("\n", problems));
    }
  }

  private static Duration seconds(String property, long fallback) {
    return Duration.ofSeconds(Long.getLong(property, fallback));
  }
}
