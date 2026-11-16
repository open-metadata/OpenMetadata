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
import static org.openmetadata.it.tests.CredentialFixtures.PIPELINE_CONFIG;

import com.github.dockerjava.api.DockerClient;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;
import org.openmetadata.service.security.credentials.Credentials;
import org.testcontainers.DockerClientFactory;

/**
 * While the database is unreachable the server cannot confirm a bot or PAT token, so REST and the
 * MCP transport answer 503 with {@code Retry-After}, and the server accepts the token again once
 * the database is back.
 *
 * <p>Pausing the shared database breaks any request running meanwhile, so the class is {@link
 * Isolated} and is listed with the other global-state classes in {@code pom.xml}.
 *
 * <p>All three credentials call {@code GET /v1/system/config/pipeline-service-client}. Its handler
 * builds the answer from the loaded configuration and does no database read, and the filter chain
 * resolves a session token's user from caches that the test fills before pausing (the e-mail to user
 * name cache lives 60 s and the test pauses within seconds of filling it). So a 200 for the session
 * token shows the 503s are the credential check and nothing else.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class CredentialDatabaseOutageIT {
  private static final Duration MARGIN = Duration.ofSeconds(3);
  private static final long POLL_MILLIS = 250;
  // Request-thread reads give up after loadTimeout, which the default config sets to 2 s.
  private static final Duration READ_GIVES_UP = Duration.ofSeconds(2);

  @Test
  void botAndPatGet503WithRetryAfterWhileASessionTokenStillWorks(TestNamespace ns) {
    Principals principals = warmPrincipals(ns, "outage");

    withDatabasePaused(
        () -> {
          awaitUnavailable(principals.botToken());
          awaitUnavailable(principals.patToken());
          assertRetryAfter(CredentialFixtures.get(PIPELINE_CONFIG, principals.botToken()));
          assertRetryAfter(CredentialFixtures.get(PIPELINE_CONFIG, principals.patToken()));
          assertMcpAsksToRetry(principals.botToken());
          assertMcpAsksToRetry(principals.patToken());
          assertEquals(
              200,
              CredentialFixtures.status(PIPELINE_CONFIG, principals.sessionToken()),
              "a session token has no stored check, so the pause does not reach it");
        });
  }

  @Test
  void botAndPatAreAcceptedAgainWithinASweepIntervalOfTheDatabaseReturning(TestNamespace ns) {
    Principals principals = warmPrincipals(ns, "recover");

    withDatabasePaused(
        () -> {
          awaitUnavailable(principals.botToken());
          awaitUnavailable(principals.patToken());
        });

    Duration sweepInterval = Duration.ofSeconds(Credentials.verifier().retryAfterSeconds());
    Duration allowed = sweepInterval.plusSeconds(1).plus(MARGIN);
    Awaitility.await("200 for the bot token after the database resumed, within " + allowed)
        .atMost(allowed.toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .untilAsserted(
            () ->
                assertEquals(
                    200, CredentialFixtures.status(PIPELINE_CONFIG, principals.botToken())));
    Awaitility.await("200 for the PAT after the database resumed, within " + allowed)
        .atMost(allowed.toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .untilAsserted(
            () ->
                assertEquals(
                    200, CredentialFixtures.status(PIPELINE_CONFIG, principals.patToken())));
  }

  private record Principals(String botToken, String patToken, String sessionToken) {}

  /** Every token is used once against a live database, so the verifier and the caches are warm. */
  private static Principals warmPrincipals(TestNamespace ns, String base) {
    User bot = CredentialFixtures.createBot(ns, base + "bot");
    User owner = CredentialFixtures.createUser(ns, base + "own");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));
    Principals principals =
        new Principals(
            CredentialFixtures.botToken(bot),
            pat.getJwtToken(),
            CredentialFixtures.loginToken(owner));
    for (String token : new String[] {principals.botToken(), principals.patToken()}) {
      assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, token), "warm-up with a live DB");
    }
    assertEquals(200, CredentialFixtures.status(PIPELINE_CONFIG, principals.sessionToken()));
    return principals;
  }

  private static void awaitUnavailable(String token) {
    Duration bound = CredentialSourceTestSupport.serverMaxStaleness();
    Duration allowed = bound.plus(READ_GIVES_UP).plus(MARGIN);
    Awaitility.await("503 once the entry is older than maxStaleness " + bound)
        .atMost(allowed.toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .untilAsserted(() -> assertEquals(503, CredentialFixtures.status(PIPELINE_CONFIG, token)));
  }

  private static void assertRetryAfter(HttpResponse<String> response) {
    assertEquals(503, response.statusCode(), response.body());
    assertEquals(
        String.valueOf(Credentials.verifier().retryAfterSeconds()),
        response.headers().firstValue("Retry-After").orElse(null),
        "Retry-After is the sweep interval rounded up");
  }

  /** A challenge would tell an MCP client its token is invalid, so it would drop a valid token. */
  private static void assertMcpAsksToRetry(String token) {
    HttpResponse<String> response = CredentialFixtures.mcpInitialize(token);
    assertRetryAfter(response);
    assertEquals(Optional.empty(), response.headers().firstValue("WWW-Authenticate"));
  }

  private static void withDatabasePaused(Runnable whilePaused) {
    DockerClient docker = DockerClientFactory.lazyClient();
    assertNotNull(
        TestSuiteBootstrap.getDatabaseContainer(),
        "the suite runs against an embedded database container");
    String containerId = TestSuiteBootstrap.getDatabaseContainer().getContainerId();
    assertNotNull(containerId, "the embedded database container has an id");
    docker.pauseContainerCmd(containerId).exec();
    try {
      whilePaused.run();
    } finally {
      docker.unpauseContainerCmd(containerId).exec();
    }
  }
}
