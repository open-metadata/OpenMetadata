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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.DisabledIf;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bench.BenchmarkMetrics;
import org.openmetadata.it.bootstrap.ForkedServerNode;
import org.openmetadata.it.bootstrap.ForkedServerNode.Settings;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.PropagationBench.Mode;
import org.openmetadata.it.tests.PropagationBench.Outcome;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;

/**
 * A credential changed through server A, the suite's server, is honoured by server B, a second
 * server in its own JVM on the same database, within {@code maxStaleness}. Nothing about the
 * credential is shared between the two but the database (and Redis, in the Redis lane), so the
 * result does not depend on any static of the test JVM.
 *
 * <p>Both lanes run this class. In each, B rejects a revoked, rotated or soft-deleted credential
 * within the bound and accepts a created one. Without Redis a test also checks that B's sweep saw the
 * change; with Redis, a test checks that B received a nudge from A. Whether the nudge or the sweep
 * delivered a given change is not asserted, because either may arrive first.
 *
 * <p>Bench mode ({@code -Dcredential.propagation.bench=true}) measures propagation latency, 100
 * trials per mode and the modes the lane can run: without Redis, with Redis, the slowest sweep the
 * configuration allows on B, and {@code waitForPropagation}. It writes
 * {@code target/benchmark/credential-propagation-<lane>.json}.
 */
@Tag("multi-node")
@ExtendWith(TestNamespaceExtension.class)
class CredentialRevocationTwoProcessIT {
  private static final Duration CLIENT_SLACK = Duration.ofMillis(100);
  private static final Duration MISS_REFRESH_MIN_AGE = Duration.ofMillis(500);
  private static final long POLL_MILLIS = 25;
  private static final int WARM_REQUESTS = 1000;
  private static final String SLOWEST_SWEEP = "sweepInterval";

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

  @Test
  void botTokenRevokedThroughAIsRejectedByBWithinMaxStaleness(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "tpbot");
    String token = CredentialFixtures.botToken(bot);
    assertEquals(200, statusOnB(token), "B accepts the bot token before the revoke");

    CredentialFixtures.revokeBotToken(bot);

    awaitUnauthorizedOnB(token);
  }

  @Test
  void patRevokedThroughAIsRejectedByBWithinMaxStaleness(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "tppat");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));
    assertEquals(200, statusOnB(pat.getJwtToken()), "B accepts the PAT before the revoke");

    CredentialFixtures.revokePat(owner, pat);

    awaitUnauthorizedOnB(pat.getJwtToken());
  }

  @Test
  void patCreatedThroughAIsAcceptedByBOnASingleRequestOnceMissRefreshMinAgeHasPassed(
      TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "tpnew");
    PersonalAccessToken first = CredentialFixtures.createPat(owner, ns.prefix("first"));
    assertEquals(200, statusOnB(first.getJwtToken()), "B has the owner cached");
    PersonalAccessToken second = CredentialFixtures.createPat(owner, ns.prefix("second"));

    Awaitility.await("missRefreshMinAge has passed on B")
        .pollDelay(MISS_REFRESH_MIN_AGE.multipliedBy(2))
        .until(() -> true);

    assertEquals(200, statusOnB(second.getJwtToken()), "B's first answer for the new PAT");
  }

  @Test
  void botTokenRotatedThroughAIsReplacedOnB(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "tprot");
    String oldToken = CredentialFixtures.botToken(bot);
    assertEquals(200, statusOnB(oldToken), "B accepts the bot token before the rotation");

    String newToken = CredentialFixtures.botToken(bot);

    awaitUnauthorizedOnB(oldToken);
    awaitOkOnB(newToken);
  }

  @Test
  void principalSoftDeletedThroughAIsRejectedByB(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "tpdel");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));
    assertEquals(200, statusOnB(pat.getJwtToken()), "B accepts the PAT before the delete");

    CredentialFixtures.softDeleteUser(owner);

    awaitUnauthorizedOnB(pat.getJwtToken());
  }

  @Test
  @EnabledIf("org.openmetadata.it.bootstrap.TestSuiteBootstrap#isRedisEnabled")
  void withRedisBIsToldOfARevokeThroughTheNudge(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "tpnudge");
    String token = CredentialFixtures.botToken(bot);
    assertEquals(200, statusOnB(token), "B caches the bot");
    double before = nodeB.metric("om_credential_nudges_total", "outcome", "queued");

    CredentialFixtures.revokeBotToken(bot);

    Awaitility.await("B received a credential nudge from A")
        .atMost(Duration.ofSeconds(5))
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .untilAsserted(
            () ->
                assertTrue(
                    nodeB.metric("om_credential_nudges_total", "outcome", "queued") > before));
  }

  @Test
  @DisabledIf("org.openmetadata.it.bootstrap.TestSuiteBootstrap#isRedisEnabled")
  void withoutRedisBLearnsOfARevokeFromItsSweep(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "tpswp");
    String token = CredentialFixtures.botToken(bot);
    assertEquals(200, statusOnB(token), "B caches the bot");
    double before = nodeB.metric("om_credential_sweep_changed_subjects_total");

    CredentialFixtures.revokeBotToken(bot);

    awaitUnauthorizedOnB(token);
    assertTrue(
        nodeB.metric("om_credential_sweep_changed_subjects_total") > before,
        "B's sweep saw the principal's credentials change");
  }

  @Test
  void warmRequestsToBReadNothingFromTheDatabase(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "tpwarm");
    String botToken = CredentialFixtures.botToken(bot);
    User owner = CredentialFixtures.createUser(ns, "tpwarmu");
    String patToken = CredentialFixtures.createPat(owner, ns.prefix("pat")).getJwtToken();
    assertEquals(200, statusOnB(botToken), "warm-up request for the bot");
    assertEquals(200, statusOnB(patToken), "warm-up request for the PAT owner");
    double before = requestThreadReads();

    int accepted = 0;
    for (int i = 0; i < WARM_REQUESTS; i++) {
      accepted += statusOnB(i % 2 == 0 ? botToken : patToken) == 200 ? 1 : 0;
    }

    assertEquals(WARM_REQUESTS, accepted, "every request ran and was accepted");
    assertEquals(before, requestThreadReads(), "no request waited on a database read");
  }

  @Test
  @EnabledIfSystemProperty(named = PropagationBench.ENABLED_PROPERTY, matches = "true")
  void propagationLatency(TestNamespace ns) throws Exception {
    Duration bound = maxStaleness();
    List<Outcome> outcomes = new ArrayList<>();
    boolean redis = TestSuiteBootstrap.isRedisEnabled();
    outcomes.add(runMode(redis ? "redis" : "no-redis", "a", nodeB, false, ns, bound));
    if (!redis) {
      outcomes.add(runSlowestSweep(ns, bound));
    }
    outcomes.add(runMode("wait-for-propagation", "w", nodeB, true, ns, bound));

    writeReport(outcomes, redis);
    assertWithinBound(outcomes, bound);
  }

  private static Outcome runSlowestSweep(TestNamespace ns, Duration bound) throws Exception {
    Duration slowest = bound.dividedBy(2);
    Settings settings =
        Settings.DEFAULT.withCredentialVerification(SLOWEST_SWEEP, slowest.toMillis() + "ms");
    try (ForkedServerNode slowSweep = ForkedServerNode.start(settings)) {
      return runMode("slowest-sweep", "s", slowSweep, false, ns, bound);
    }
  }

  private static Outcome runMode(
      String name,
      String tag,
      ForkedServerNode node,
      boolean waitForPropagation,
      TestNamespace ns,
      Duration bound)
      throws Exception {
    Mode mode = new Mode(name, tag, node, waitForPropagation);
    return PropagationBench.run(mode, ns, PropagationBench.trials(), bound);
  }

  private static void writeReport(List<Outcome> outcomes, boolean redis) throws IOException {
    Map<String, Object> report = new LinkedHashMap<>();
    report.put("lane", redis ? "redis" : "no-redis");
    report.put("modes", outcomes.stream().map(Outcome::report).toList());
    BenchmarkMetrics.write(
        report, "credential-propagation-" + (redis ? "redis" : "no-redis") + ".json");
  }

  private static void assertWithinBound(List<Outcome> outcomes, Duration bound) {
    for (Outcome outcome : outcomes) {
      assertEquals(
          0, outcome.tally().unexpected(), outcome.mode().name() + ": unexpected statuses");
      if (outcome.mode().waitForPropagation()) {
        assertEquals(
            0, outcome.tally().firstPollNot401(), "the first request after the call is 401");
      } else {
        double max = outcome.maxMillis();
        long allowed = bound.plus(CLIENT_SLACK).toMillis() + PropagationBench.POLL_MILLIS;
        assertTrue(
            max <= allowed, outcome.mode().name() + ": max " + max + " ms > " + allowed + " ms");
      }
    }
  }

  private double requestThreadReads() {
    return nodeB.metric("om_credential_reads_total", "reason", "miss")
        + nodeB.metric("om_credential_reads_total", "reason", "stale")
        + nodeB.metric("om_credential_reads_total", "reason", "unknown_token");
  }

  private static int statusOnB(String token) {
    return CredentialFixtures.status(nodeB.apiBase().toString(), LOGGED_IN_USER, token);
  }

  private static Duration maxStaleness() {
    return CredentialSourceTestSupport.serverMaxStaleness();
  }

  private static void awaitOkOnB(String token) {
    Duration bound = maxStaleness();
    Awaitility.await("B answers 200 within maxStaleness " + bound)
        .atMost(bound.plusSeconds(1).toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .untilAsserted(() -> assertEquals(200, statusOnB(token)));
  }

  private static void awaitUnauthorizedOnB(String token) {
    Duration bound = maxStaleness();
    Awaitility.await("B answers 401 within maxStaleness " + bound)
        .atMost(bound.plusSeconds(1).toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .untilAsserted(() -> assertEquals(401, statusOnB(token)));
  }
}
