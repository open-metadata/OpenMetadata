/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.security.auth;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.system.TestLoginCredentialsRequest;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.system.TestLoginSession;
import org.openmetadata.schema.system.TestLoginStage;
import org.openmetadata.service.security.TestLoginOidcHandler;
import org.openmetadata.service.security.saml.TestLoginSamlHandler;

/**
 * Orchestrates the Test Login round-trips whose live login runs on the server: confidential OIDC,
 * SAML, and LDAP/Basic. Public-client OIDC signs in in the browser, so its test does too (see {@link
 * TestLoginService#resolveFromIdToken}).
 *
 * <p>An authenticated admin starts a test; the identity provider's callback on the shared {@code
 * /callback} or SAML ACS servlet, or a credentials submission, completes it; the same admin reads
 * the outcome back by polling. Nothing here issues credentials, starts a session or persists
 * anything, and the live authentication system is never consulted or modified.
 */
@Slf4j
public final class TestLoginRoundTrip {
  static final int MAX_CREDENTIAL_TESTS_PER_WINDOW = 10;
  static final Duration CREDENTIAL_TEST_WINDOW = Duration.ofMinutes(10);
  private static final int MAX_TRACKED_ADMINS = 1_000;
  private static final Set<String> WEB_URL_SCHEMES = Set.of("http", "https");
  private static final TestLoginRoundTrip INSTANCE =
      new TestLoginRoundTrip(new TestLoginSessionCache());

  private final TestLoginSessionCache sessions;
  private final Cache<String, AtomicInteger> credentialTestsByAdmin =
      Caffeine.newBuilder()
          .maximumSize(MAX_TRACKED_ADMINS)
          .expireAfterWrite(CREDENTIAL_TEST_WINDOW)
          .build();

  TestLoginRoundTrip(TestLoginSessionCache sessions) {
    this.sessions = sessions;
  }

  public static TestLoginRoundTrip getInstance() {
    return INSTANCE;
  }

  /**
   * Starts a test against the candidate. A candidate the server cannot even begin a login against —
   * an unreachable or malformed discovery document, say — still yields a session whose result is
   * already a failure, so the admin sees the same staged timeline either way.
   */
  public TestLoginSession start(String adminPrincipal, SecurityConfiguration candidate) {
    TestLoginProtocol protocol = protocolOf(candidate.getAuthenticationConfiguration());
    TestLoginSession session = newSession(protocol);
    switch (protocol) {
      case OIDC -> startOidc(session, adminPrincipal, candidate);
      case LDAP, BASIC -> startCredentials(session, adminPrincipal, candidate);
      case SAML -> startSaml(session, adminPrincipal, candidate);
    }
    return session;
  }

  /**
   * Completes an LDAP/Basic test with the credentials the admin entered. The dry-run never records
   * a failed login — a mistyped test password must not lock a real account — so without a cap this
   * would be an unthrottled password oracle for every account in the directory. A test therefore
   * completes once, and attempts are capped per admin; the count is taken before verifying, so
   * racing requests cannot exceed it.
   */
  public TestLoginResult submitCredentials(
      String adminPrincipal, TestLoginCredentialsRequest request) {
    TestLoginSessionEntry entry =
        requireAwaitingCredentials(
            sessions.requireOwnedBy(request.getTestSessionId(), adminPrincipal));
    countCredentialTest(adminPrincipal);
    TestLoginResult result =
        entry.protocol() == TestLoginProtocol.LDAP
            ? TestLoginCredentialHandler.verifyLdap(
                entry.candidate(), request.getEmail(), request.getPassword())
            : TestLoginCredentialHandler.verifyBasic(
                entry.candidate(), request.getEmail(), request.getPassword());
    sessions.complete(entry.testSessionId(), result);
    return result;
  }

  private static TestLoginSessionEntry requireAwaitingCredentials(TestLoginSessionEntry entry) {
    if (entry.isCompleted() || !(entry.handshake() instanceof TestLoginHandshake.Credentials)) {
      throw new BadRequestException(
          "This test login is not waiting for credentials. Start a new test login.");
    }
    return entry;
  }

  private void countCredentialTest(String adminPrincipal) {
    int attempts =
        credentialTestsByAdmin.get(adminPrincipal, admin -> new AtomicInteger()).incrementAndGet();
    if (attempts > MAX_CREDENTIAL_TESTS_PER_WINDOW) {
      throw new WebApplicationException(
          "Too many credential test logins. Wait a few minutes and try again.",
          Response.Status.TOO_MANY_REQUESTS);
    }
  }

  /** The outcome of a test the given admin started, or a pending timeline while it is running. */
  public TestLoginResult result(String adminPrincipal, String testSessionId) {
    TestLoginSessionEntry entry = sessions.requireOwnedBy(testSessionId, adminPrincipal);
    return entry.isCompleted() ? entry.result() : pendingResult(entry.protocol());
  }

  /**
   * Completes an OIDC test from the shared {@code /callback}. A callback for an unknown, expired or
   * already-completed test changes nothing: the first genuine callback wins.
   */
  public void completeOidcCallback(
      String testSessionId, Map<String, List<String>> callbackParameters) {
    findPendingCallback(testSessionId)
        .ifPresent(
            entry -> {
              if (entry.handshake() instanceof TestLoginHandshake.Oidc handshake) {
                completeSafely(
                    entry,
                    () ->
                        TestLoginOidcHandler.complete(
                            entry.candidate(), handshake, callbackParameters));
              } else {
                LOG.warn("Ignoring an OIDC callback for a {} test login", entry.protocol());
              }
            });
  }

  /** Completes a SAML test from the ACS; as with OIDC, only the first callback counts. */
  public void completeSamlCallback(
      String testSessionId, HttpServletRequest request, HttpServletResponse response) {
    findPendingCallback(testSessionId)
        .ifPresent(
            entry -> {
              if (entry.handshake() instanceof TestLoginHandshake.Saml) {
                completeSafely(
                    entry,
                    () -> TestLoginSamlHandler.complete(entry.candidate(), request, response));
              } else {
                LOG.warn("Ignoring a SAML callback for a {} test login", entry.protocol());
              }
            });
  }

  private Optional<TestLoginSessionEntry> findPendingCallback(String testSessionId) {
    Optional<TestLoginSessionEntry> entry = sessions.findPending(testSessionId);
    if (entry.isEmpty()) {
      LOG.info("Ignoring a test login callback for an unknown or finished test");
    }
    return entry;
  }

  /**
   * The handlers already turn every protocol failure into a typed result. This guards the admin
   * against a defect instead: without it they would poll a test that never completes.
   */
  private void completeSafely(TestLoginSessionEntry entry, Supplier<TestLoginResult> handler) {
    TestLoginResult result;
    try {
      result = handler.get();
    } catch (RuntimeException e) {
      LOG.error("Unexpected failure completing a {} test login", entry.protocol(), e);
      result =
          failedAt(
              entry.protocol(),
              TestLoginStage.TOKEN_RECEIVED,
              "Unexpected error completing the sign-in: " + TestLoginService.rootMessage(e));
    }
    sessions.complete(entry.testSessionId(), result);
  }

  private void startOidc(
      TestLoginSession session, String adminPrincipal, SecurityConfiguration candidate) {
    String testSessionId = session.getTestSessionId();
    try {
      // Building the authorization request fetches the candidate's discovery document.
      TestLoginOidcHandler.Authorization authorization =
          TestLoginOidcHandler.authorize(
              candidate.getAuthenticationConfiguration().getOidcConfiguration(),
              TestLoginSessionCache.markerFor(testSessionId));
      URI authorizationUrl = requireWebUrl(authorization.authorizationUrl());
      sessions.put(
          TestLoginSessionEntry.pending(
              testSessionId,
              adminPrincipal,
              candidate,
              TestLoginProtocol.OIDC,
              authorization.handshake()));
      session.withAuthorizationUrl(authorizationUrl);
    } catch (Exception e) {
      // pac4j signals an unreachable or malformed provider with checked and unchecked exceptions
      // alike.
      recordFailedStart(session, adminPrincipal, e);
    }
  }

  private void startSaml(
      TestLoginSession session, String adminPrincipal, SecurityConfiguration candidate) {
    String testSessionId = session.getTestSessionId();
    try {
      URI authorizationUrl =
          requireWebUrl(
              TestLoginSamlHandler.authorize(
                  candidate.getAuthenticationConfiguration().getSamlConfiguration(),
                  TestLoginSessionCache.markerFor(testSessionId)));
      sessions.put(
          TestLoginSessionEntry.pending(
              testSessionId,
              adminPrincipal,
              candidate,
              TestLoginProtocol.SAML,
              new TestLoginHandshake.Saml()));
      session.withAuthorizationUrl(authorizationUrl);
    } catch (Exception e) {
      // OneLogin rejects unusable settings here: a malformed certificate, a missing SSO URL.
      recordFailedStart(session, adminPrincipal, e);
    }
  }

  /**
   * The live login redirects to the provider's sign-in address, but the test hands it to the UI,
   * which sends a same-origin popup there. Anything other than http(s) — a {@code javascript:} or
   * {@code data:} address from a hostile discovery document — would then run in this origin.
   */
  static URI requireWebUrl(String address) {
    URI uri = URI.create(address);
    String scheme = uri.getScheme();
    if (scheme == null || !WEB_URL_SCHEMES.contains(scheme.toLowerCase(Locale.ROOT))) {
      throw new IllegalArgumentException(
          "The candidate provider's sign-in address must be an http or https URL.");
    }
    return uri;
  }

  /** A login that cannot even begin still reaches the admin as a failed timeline, not a 500. */
  private void recordFailedStart(TestLoginSession session, String adminPrincipal, Exception cause) {
    LOG.debug("Test login could not start against the candidate provider", cause);
    sessions.put(
        TestLoginSessionEntry.completed(
            session.getTestSessionId(),
            adminPrincipal,
            session.getProtocol(),
            failedAt(
                session.getProtocol(),
                TestLoginStage.STARTED,
                "Could not start a sign-in against the candidate provider: "
                    + TestLoginService.rootMessage(cause))));
  }

  private void startCredentials(
      TestLoginSession session, String adminPrincipal, SecurityConfiguration candidate) {
    sessions.put(
        TestLoginSessionEntry.pending(
            session.getTestSessionId(),
            adminPrincipal,
            candidate,
            session.getProtocol(),
            new TestLoginHandshake.Credentials()));
    session.withRequiresCredentials(true);
  }

  static TestLoginProtocol protocolOf(AuthenticationConfiguration authConfig) {
    return switch (authConfig.getProvider()) {
      case SAML -> TestLoginProtocol.SAML;
      case LDAP -> TestLoginProtocol.LDAP;
      case BASIC, OPENMETADATA -> TestLoginProtocol.BASIC;
      default -> requireConfidentialOidc(authConfig);
    };
  }

  private static TestLoginProtocol requireConfidentialOidc(AuthenticationConfiguration authConfig) {
    if (authConfig.getClientType() != ClientType.CONFIDENTIAL
        || authConfig.getOidcConfiguration() == null) {
      throw new BadRequestException(
          "Public-client OIDC providers sign in in the browser, so they are tested there: "
              + "use the test-login validate-token endpoint.");
    }
    return TestLoginProtocol.OIDC;
  }

  private static TestLoginSession newSession(TestLoginProtocol protocol) {
    return new TestLoginSession()
        .withTestSessionId(TestLoginSessionCache.newSessionId())
        .withProtocol(protocol)
        .withRequiresCredentials(false)
        .withExpiresAt(System.currentTimeMillis() + TestLoginSessionCache.SESSION_TTL.toMillis());
  }

  private static TestLoginResult pendingResult(TestLoginProtocol protocol) {
    TestLoginStageRecorder recorder = TestLoginStageRecorder.forProtocol(protocol);
    recorder.pass(TestLoginStage.STARTED);
    recorder.running(
        TestLoginStageRecorder.isCredentialBased(protocol)
            ? TestLoginStage.CREDENTIALS_VERIFIED
            : TestLoginStage.REDIRECTED);
    return new TestLoginResult()
        .withStatus(TestLoginResult.Status.PENDING)
        .withProtocol(protocol)
        .withStage(recorder.furthestReached())
        .withStages(recorder.toStageResults());
  }

  private static TestLoginResult failedAt(
      TestLoginProtocol protocol, TestLoginStage stage, String message) {
    TestLoginStageRecorder recorder = TestLoginStageRecorder.forProtocol(protocol);
    recorder.fail(stage, message);
    return TestLoginService.failure(protocol, recorder);
  }
}
