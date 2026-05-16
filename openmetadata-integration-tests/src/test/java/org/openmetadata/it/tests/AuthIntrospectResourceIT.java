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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for {@code POST /v1/system/auth/introspect}.
 *
 * <p>The introspect endpoint is the contract the external log-server uses to validate that an
 * incoming bearer token is still the current token for its bot subject — without ever pulling the
 * stored secret across the wire. It must:
 *
 * <ul>
 *   <li>Return {@code active=true} for a valid, non-revoked bot token signed by OM's keypair.
 *   <li>Return {@code active=true} for a valid non-bot user token (no revocation check applies).
 *   <li>Return HTTP 200 with {@code active=false} (NOT a 401) for malformed/expired/missing
 *       tokens, so the caller can cache negative outcomes deterministically.
 *   <li>Surface the canonical {@code sub} and {@code isBot} fields so the caller doesn't have to
 *       re-decode the token.
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AuthIntrospectResourceIT {

  private static final String INTROSPECT_PATH = "/v1/system/auth/introspect";
  private static final String CALLER_SECRET_HEADER = "X-OM-Introspect-Auth";

  /** System property mirroring OM's {@code OM_INTROSPECT_CALLER_SECRET}; populated by CI. */
  private static final String CALLER_SECRET_PROP = "openmetadata.introspect.callerSecret";

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void test_introspect_validBotToken_returnsActive(TestNamespace ns) throws Exception {
    BotFixture fixture = createBotWithToken(ns, "valid");

    OpenMetadataClient botClient = clientWithRawToken(fixture.token);
    JsonNode body = post(botClient, INTROSPECT_PATH);

    assertTrue(body.path("active").asBoolean(), "valid bot token must be reported active");
    assertTrue(body.path("isBot").asBoolean(), "isBot claim must be surfaced as true");
    assertEquals(fixture.botUserName, body.path("sub").asText(), "sub must echo the bot subject");
  }

  @Test
  void test_introspect_validUserToken_returnsActive() throws Exception {
    // SdkClients.testUserClient() is a non-bot user with a JWT issued by the same keypair.
    JsonNode body = post(SdkClients.testUserClient(), INTROSPECT_PATH);
    assertTrue(body.path("active").asBoolean(), "valid user token must be reported active");
    assertFalse(body.path("isBot").asBoolean(), "isBot must be false for a user token");
    assertNotNull(body.path("sub").asText(), "sub must be present");
  }

  @Test
  void test_introspect_malformedToken_returnsInactive() throws Exception {
    OpenMetadataClient client = clientWithRawToken("not.a.real.token");
    JsonNode body = post(client, INTROSPECT_PATH);
    assertEquals(false, body.path("active").asBoolean(), "malformed token must be inactive");
  }

  @Test
  void test_introspect_garbageBearerToken_returnsInactive() throws Exception {
    OpenMetadataClient client = clientWithRawToken("garbage");
    JsonNode body = post(client, INTROSPECT_PATH);
    assertEquals(false, body.path("active").asBoolean(), "garbage token must be inactive");
  }

  @Test
  void test_introspect_missingAuthHeader_returnsInactive() throws Exception {
    // The SDK adds Authorization from its configured accessToken; trying to clear it with a
    // per-request empty header is silently ignored, so the request goes out fully authenticated
    // and the assertion fails. Use a fresh client built without an accessToken so the SDK
    // omits Authorization entirely — the wire request matches what we want to test.
    String response =
        clientWithoutToken()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, INTROSPECT_PATH, null, RequestOptions.builder().build());
    JsonNode body = MAPPER.readTree(response);
    assertEquals(false, body.path("active").asBoolean(), "missing token must be inactive");
  }

  @Test
  void test_introspect_responseIsConstantStatus200_evenOnInvalidInput() throws Exception {
    // The contract: never 401 from this endpoint — caller distinguishes auth failure via JSON,
    // not via HTTP status. This frees callers to cache "inactive" decisions without confusing
    // them with transport errors.
    String response =
        clientWithRawToken("Bearer.but.not.really")
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, INTROSPECT_PATH, null, RequestOptions.builder().build());
    assertNotNull(response, "must get a body, not a thrown exception");
    JsonNode body = MAPPER.readTree(response);
    assertTrue(body.has("active"), "response must always contain active field");
  }

  // ------------------------------------------------------------------
  // Hardening: caller-secret authentication and full validation chain
  // ------------------------------------------------------------------

  /**
   * Only runs when {@code -Dopenmetadata.introspect.callerSecret=<value>} is set, matching the
   * server's {@code OM_INTROSPECT_CALLER_SECRET}. CI should set this; local dev usually doesn't.
   * If unset, the endpoint is in "unauthenticated mode" (back-compat) and these tests skip.
   */
  @Test
  @EnabledIfSystemProperty(named = CALLER_SECRET_PROP, matches = ".+")
  void test_introspect_missingCallerSecret_returns401(TestNamespace ns) throws Exception {
    BotFixture fixture = createBotWithToken(ns, "secret_missing");
    OpenMetadataClient botClient = clientWithRawToken(fixture.token);

    int status = postRawStatus(botClient, INTROSPECT_PATH, null);
    assertEquals(
        401,
        status,
        "without X-OM-Introspect-Auth header the endpoint must reject the caller (not the token)");
  }

  @Test
  @EnabledIfSystemProperty(named = CALLER_SECRET_PROP, matches = ".+")
  void test_introspect_wrongCallerSecret_returns401(TestNamespace ns) throws Exception {
    BotFixture fixture = createBotWithToken(ns, "secret_wrong");
    OpenMetadataClient botClient = clientWithRawToken(fixture.token);

    int status = postRawStatus(botClient, INTROSPECT_PATH, "definitely-not-the-secret");
    assertEquals(
        401, status, "wrong caller secret must be rejected with 401, not a 200 active=false");
  }

  @Test
  @EnabledIfSystemProperty(named = CALLER_SECRET_PROP, matches = ".+")
  void test_introspect_correctCallerSecret_returnsActive(TestNamespace ns) throws Exception {
    BotFixture fixture = createBotWithToken(ns, "secret_ok");
    OpenMetadataClient botClient = clientWithRawToken(fixture.token);

    JsonNode body =
        postWithCallerSecret(botClient, INTROSPECT_PATH, System.getProperty(CALLER_SECRET_PROP));
    assertTrue(body.path("active").asBoolean(), "valid token + correct caller secret → active");
  }

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------

  private static RequestOptions.Builder withCallerSecret(RequestOptions.Builder b) {
    String secret = System.getProperty(CALLER_SECRET_PROP);
    if (secret != null && !secret.isEmpty()) {
      b.header(CALLER_SECRET_HEADER, secret);
    }
    return b;
  }

  private static JsonNode post(OpenMetadataClient client, String path) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, path, null, withCallerSecret(RequestOptions.builder()).build());
    return MAPPER.readTree(response);
  }

  private static JsonNode postWithCallerSecret(
      OpenMetadataClient client, String path, String secret) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                path,
                null,
                RequestOptions.builder().header(CALLER_SECRET_HEADER, secret).build());
    return MAPPER.readTree(response);
  }

  /**
   * Returns HTTP status for a POST that does not set the caller-secret header (or sets a wrong
   * value). The SDK throws on non-2xx; we treat a thrown exception as evidence of 401 and
   * pattern-match the message rather than wiring a raw OkHttp client just for this.
   */
  private static int postRawStatus(OpenMetadataClient client, String path, String wrongSecret)
      throws Exception {
    RequestOptions.Builder b = RequestOptions.builder();
    if (wrongSecret != null) {
      b.header(CALLER_SECRET_HEADER, wrongSecret);
    }
    try {
      client.getHttpClient().executeForString(HttpMethod.POST, path, null, b.build());
      return 200;
    } catch (RuntimeException e) {
      String msg = e.getMessage() == null ? "" : e.getMessage();
      if (msg.contains("401") || msg.toLowerCase().contains("unauthor")) {
        return 401;
      }
      throw e;
    }
  }

  /**
   * The IT harness publishes the API base URL via {@code IT_BASE_URL} (system property AND env
   * var). We MUST honour the same convention {@link SdkClients} uses so the test runs everywhere
   * the rest of the suite runs (local maven, GH Actions, multi-shard CI). Hardcoding localhost
   * works only on a developer laptop.
   */
  private static String resolveBaseUrl() {
    String fromProp = System.getProperty("IT_BASE_URL");
    if (fromProp != null && !fromProp.isEmpty()) {
      return fromProp;
    }
    String fromEnv = System.getenv("IT_BASE_URL");
    if (fromEnv != null && !fromEnv.isEmpty()) {
      return fromEnv;
    }
    return "http://localhost:8585";
  }

  /**
   * Build a fresh client whose default Authorization header is the supplied bearer token.
   *
   * <p>For the "no Authorization at all" case, use {@link #clientWithoutToken()} — this method
   * always sets one (the SDK enforces that when {@code accessToken} is configured).
   */
  private static OpenMetadataClient clientWithRawToken(String token) {
    OpenMetadataConfig cfg =
        OpenMetadataConfig.builder()
            .serverUrl(resolveBaseUrl())
            .accessToken(token)
            .readTimeout(60_000)
            .writeTimeout(60_000)
            .build();
    return new OpenMetadataClient(cfg);
  }

  /**
   * Build a client without any accessToken so the SDK omits the {@code Authorization} header
   * altogether. Necessary because the SDK silently ignores per-request attempts to clear that
   * header when an accessToken was configured at construction time.
   */
  private static OpenMetadataClient clientWithoutToken() {
    OpenMetadataConfig cfg =
        OpenMetadataConfig.builder()
            .serverUrl(resolveBaseUrl())
            .readTimeout(60_000)
            .writeTimeout(60_000)
            .build();
    return new OpenMetadataClient(cfg);
  }

  private record BotFixture(String botUserName, String token) {}

  private static BotFixture createBotWithToken(TestNamespace ns, String suffix) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String userName = ns.prefix("introspect_bot_" + suffix + "_" + uniqueId);
    String email = "introspect" + suffix + uniqueId + "@test.com";

    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism);

    User botUser = SdkClients.adminClient().users().create(userRequest);

    CreateBot botRequest =
        new CreateBot()
            .withName(ns.prefix("introspect_bot_owner_" + suffix + "_" + uniqueId))
            .withDescription("Bot for AuthIntrospectResourceIT")
            .withBotUser(botUser.getName());
    Bot bot = SdkClients.adminClient().bots().create(botRequest);
    assertNotNull(bot, "bot fixture creation");

    JWTAuthMechanism issued =
        SdkClients.adminClient().users().generateToken(botUser.getId(), JWTTokenExpiry.Unlimited);
    assertNotNull(issued.getJWTToken(), "bot token must be issued");

    return new BotFixture(botUser.getName(), issued.getJWTToken());
  }
}
