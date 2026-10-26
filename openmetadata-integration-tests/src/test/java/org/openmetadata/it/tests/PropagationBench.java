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
package org.openmetadata.it.tests;

import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.openmetadata.it.bootstrap.ForkedServerNode;
import org.openmetadata.it.tests.security.scale.Percentiles;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.teams.User;

/**
 * How long a token revoked through one server keeps working on another, measured from the moment the
 * client receives the revoke response. Each trial creates a bot, warms its token on server B so B
 * has it cached, revokes it through server A (the suite's server), and polls B every
 * {@value #POLL_MILLIS} ms until the first 401. Every status B returns is counted. A status other
 * than 200 or 401, or a trial that sees no 401 within the bound plus a grace period, voids the run.
 *
 * <p>With {@code waitForPropagation} the revoke call itself waits, the measure is the call's
 * duration, and the single request to B after the call must already be 401.
 */
final class PropagationBench {
  static final String ENABLED_PROPERTY = "credential.propagation.bench";
  static final long POLL_MILLIS = 10;

  private static final String TRIALS_PROPERTY = "credential.propagation.trials";
  private static final int DEFAULT_TRIALS = 100;
  private static final Duration NO_401_GRACE = Duration.ofSeconds(5);

  private PropagationBench() {}

  record Mode(String name, String tag, ForkedServerNode node, boolean waitForPropagation) {}

  /** Every status server B answered in a mode, and how many of them void the run. */
  static final class Tally {
    private final Map<Integer, Integer> statuses = new TreeMap<>();
    private int unexpected;
    private int firstPollNot401;

    synchronized void record(int status) {
      statuses.merge(status, 1, Integer::sum);
      if (status != 200 && status != 401) {
        unexpected++;
      }
    }

    synchronized void voidTrial() {
      unexpected++;
    }

    synchronized void firstPollWas(int status) {
      record(status);
      firstPollNot401 += status == 401 ? 0 : 1;
    }

    synchronized int unexpected() {
      return unexpected;
    }

    synchronized int firstPollNot401() {
      return firstPollNot401;
    }
  }

  /** Samples are milliseconds. */
  record Outcome(Mode mode, List<Double> samples, Tally tally, Duration bound) {
    double maxMillis() {
      return Percentiles.max(samples);
    }

    Map<String, Object> report() {
      Map<String, Object> report = new LinkedHashMap<>();
      report.put("mode", mode.name());
      report.put("trials", samples.size());
      report.put(
          "measure", mode.waitForPropagation() ? "revoke call duration" : "time to first 401");
      report.put("minMillis", Percentiles.min(samples));
      report.put("p50Millis", Percentiles.median(samples));
      report.put("p95Millis", Percentiles.of(samples.stream().mapToDouble(d -> d).toArray(), 95));
      report.put("maxMillis", maxMillis());
      report.put("maxStalenessMillis", bound.toMillis());
      report.put("pollMillis", POLL_MILLIS);
      report.put("statusesFromB", tally.statuses);
      report.put("unexpectedStatuses", tally.unexpected());
      report.put("firstPollNot401", tally.firstPollNot401());
      report.put("voided", tally.unexpected() > 0);
      return report;
    }
  }

  static boolean enabled() {
    return Boolean.getBoolean(ENABLED_PROPERTY);
  }

  static int trials() {
    return Integer.getInteger(TRIALS_PROPERTY, DEFAULT_TRIALS);
  }

  static Outcome run(Mode mode, TestNamespace ns, int trials, Duration bound) throws Exception {
    List<Double> samples = new ArrayList<>();
    Tally tally = new Tally();
    for (int i = 0; i < trials; i++) {
      User bot = CredentialFixtures.createBot(ns, "pb" + mode.tag() + i);
      String token = CredentialFixtures.botToken(bot);
      tally.record(statusOnB(mode, token));
      samples.add(
          mode.waitForPropagation()
              ? revokeAndWait(mode, bot, token, tally)
              : revokeAndPoll(mode, bot, token, tally, bound));
    }
    return new Outcome(mode, samples, tally, bound);
  }

  private static int statusOnB(Mode mode, String token) {
    return CredentialFixtures.status(mode.node().apiBase().toString(), LOGGED_IN_USER, token);
  }

  private static double revokeAndWait(Mode mode, User bot, String token, Tally tally) {
    long start = System.nanoTime();
    int revoke =
        CredentialFixtures.put(
                "/api/v1/users/revokeToken?waitForPropagation=true",
                SdkClients.getAdminToken(),
                "{\"id\":\"" + bot.getId() + "\"}")
            .statusCode();
    double millis = (System.nanoTime() - start) / 1e6;
    if (revoke != 200) {
      tally.voidTrial();
    }
    tally.firstPollWas(statusOnB(mode, token));
    return millis;
  }

  private static double revokeAndPoll(
      Mode mode, User bot, String token, Tally tally, Duration bound) throws Exception {
    CredentialFixtures.revokeBotToken(bot);
    long start = System.nanoTime();
    CompletableFuture<Double> first401 = new CompletableFuture<>();
    ScheduledExecutorService poller = Executors.newSingleThreadScheduledExecutor();
    poller.scheduleAtFixedRate(
        () -> pollOnce(mode, token, start, first401, tally), 0, POLL_MILLIS, TimeUnit.MILLISECONDS);
    Duration limit = bound.plus(NO_401_GRACE);
    try {
      return first401.get(limit.toMillis(), TimeUnit.MILLISECONDS);
    } catch (TimeoutException neverRejected) {
      tally.voidTrial();
      return (double) limit.toMillis();
    } finally {
      poller.shutdownNow();
    }
  }

  private static void pollOnce(
      Mode mode, String token, long start, CompletableFuture<Double> first401, Tally tally) {
    try {
      int status = statusOnB(mode, token);
      if (!first401.isDone()) {
        tally.record(status);
      }
      if (status == 401) {
        first401.complete((System.nanoTime() - start) / 1e6);
      }
    } catch (RuntimeException failure) {
      first401.completeExceptionally(failure);
    }
  }
}
