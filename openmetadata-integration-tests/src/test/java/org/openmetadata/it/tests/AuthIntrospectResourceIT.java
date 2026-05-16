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
    // Use admin client but explicitly clear the Authorization header for this one call.
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                INTROSPECT_PATH,
                null,
                RequestOptions.builder().header("Authorization", "").build());
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
  // helpers
  // ------------------------------------------------------------------

  private static JsonNode post(OpenMetadataClient client, String path) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.POST, path, null, RequestOptions.builder().build());
    return MAPPER.readTree(response);
  }

  /** Build a fresh client whose default Authorization header is the supplied bearer token. */
  private static OpenMetadataClient clientWithRawToken(String token) {
    OpenMetadataConfig cfg =
        OpenMetadataConfig.builder()
            .serverUrl(System.getProperty("openmetadata.server.url", "http://localhost:8585/api"))
            .accessToken(token)
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
