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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import com.github.dockerjava.api.DockerClient;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.testcontainers.DockerClientFactory;

/**
 * With Redis unreachable, bot and PAT requests are checked in memory and issue no database
 * statements beyond the control's, and the verifier starts no read for them, and revoking a token still works and takes effect on the next
 * request.
 *
 * <p>The failure modelled is a Redis that accepts connections and never answers, which is what a
 * paused container, a stalled node or a dropped network route looks like to a client: every Redis
 * call waits for its command timeout. A stopped container would refuse connections instead, but
 * its mapped port can change on restart and the server keeps the original URL, so it could not be
 * restored for the classes that run after this one. The container is unpaused in a {@code finally},
 * and the test waits until the server's own Redis client works again.
 *
 * <p>Pausing Redis slows any request running meanwhile, so the class is {@link Isolated} and is
 * listed with the other global-state classes in {@code pom.xml}.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
@EnabledIf(value = "org.openmetadata.it.bootstrap.TestSuiteBootstrap#isRedisEnabled")
class CredentialRedisDownIT {
  private static final int WARM_UP_REQUESTS = 10;
  // Each request waits out the Redis command timeout of its cache calls, so the sample is small.
  private static final int MEASURED_REQUESTS = 30;
  private static final Duration RECONNECT_WITHIN = Duration.ofSeconds(60);

  @Test
  void botRequestsIssueTheStatementsOfASessionTokenWhileRedisIsDown(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "downbot");
    String botToken = CredentialFixtures.botToken(bot);
    String controlToken = CredentialFixtures.loginToken(bot);
    warm(botToken, controlToken);

    withRedisPaused(() -> assertSameStatements(botToken, controlToken));
  }

  @Test
  void patRequestsIssueTheStatementsOfASessionTokenWhileRedisIsDown(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "downpat");
    String patToken = CredentialFixtures.createPat(owner, ns.prefix("pat")).getJwtToken();
    String controlToken = CredentialFixtures.loginToken(owner);
    warm(patToken, controlToken);

    withRedisPaused(() -> assertSameStatements(patToken, controlToken));
  }

  @Test
  void revokedBotTokenIsRejectedOnTheNextRequestWhileRedisIsDown(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "downrevbot");
    String botToken = CredentialFixtures.botToken(bot);
    assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, botToken), "before the revoke");

    withRedisPaused(
        () -> {
          CredentialFixtures.revokeBotToken(bot);
          assertEquals(401, CredentialFixtures.status(LOGGED_IN_USER, botToken));
        });
  }

  @Test
  void revokedPatIsRejectedOnTheNextRequestWhileRedisIsDown(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "downrevpat");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));
    assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, pat.getJwtToken()));

    withRedisPaused(
        () -> {
          CredentialFixtures.revokePat(owner, pat);
          assertEquals(401, CredentialFixtures.status(LOGGED_IN_USER, pat.getJwtToken()));
        });
  }

  private static void warm(String credentialToken, String controlToken) {
    for (int i = 0; i < WARM_UP_REQUESTS; i++) {
      assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, controlToken), "warm-up control");
      assertEquals(
          200, CredentialFixtures.status(LOGGED_IN_USER, credentialToken), "warm-up token");
    }
  }

  private static void assertSameStatements(String credentialToken, String controlToken) {
    int control = 0;
    int credential = 0;
    double readsBefore = CredentialFixtures.checkStartedReads();
    try (SqlQueryCounter counter = SqlQueryCounter.forRequests(Entity.getJdbi(), "")) {
      for (int i = 0; i < MEASURED_REQUESTS; i++) {
        int before = counter.count();
        assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, controlToken), "control");
        int afterControl = counter.count();
        assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, credentialToken), "token");
        control += afterControl - before;
        credential += counter.count() - afterControl;
      }
    }
    PerRequestCost.assertNoPerRequestCost(
        "statements", MEASURED_REQUESTS, control, credential, "Redis paused");
    assertEquals(
        0,
        CredentialFixtures.checkStartedReads() - readsBefore,
        "the verifier started no read for any request while Redis was paused");
  }

  private static void withRedisPaused(Runnable whilePaused) {
    DockerClient docker = DockerClientFactory.lazyClient();
    String containerId = TestSuiteBootstrap.getRedisContainer().getContainerId();
    assertNotNull(containerId, "the Redis lane runs against an embedded Redis container");
    docker.pauseContainerCmd(containerId).exec();
    try {
      whilePaused.run();
    } finally {
      docker.unpauseContainerCmd(containerId).exec();
      awaitServerReconnected();
    }
  }

  /** The server's Redis client works again: a write through it is readable. */
  private static void awaitServerReconnected() {
    String key = "credential-redis-down-probe:" + System.nanoTime();
    Awaitility.await("the server's Redis client works again after the container resumed")
        .atMost(RECONNECT_WITHIN.toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(500, TimeUnit.MILLISECONDS)
        .ignoreExceptions()
        .until(
            () ->
                CacheBundle.getCacheProvider().trySet(key, "up", Duration.ofMinutes(1))
                    && CacheBundle.getCacheProvider().get(key).isPresent());
  }
}
