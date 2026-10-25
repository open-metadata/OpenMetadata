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

import static org.openmetadata.it.tests.MetricMigrationSqlFixture.currentConnectionType;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Principals, tokens, plain HTTP calls and direct SQL shared by the {@code Credential*IT} classes.
 * Requests go over HTTP with a raw client, so a test sees the exact status and headers a caller of
 * the API sees.
 */
public final class CredentialFixtures {
  /** Authenticated, answers from the database, so it shows a request really ran. */
  public static final String LOGGED_IN_USER = "/api/v1/users/loggedInUser";

  /** Authenticated and answered from memory: the handler reads nothing from the database. */
  public static final String PIPELINE_CONFIG = "/api/v1/system/config/pipeline-service-client";

  private static final long LOGIN_TOKEN_TTL_SECONDS = 3600;
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private CredentialFixtures() {}

  public static User createUser(TestNamespace ns, String base) {
    String localPart = base + ns.shortPrefix();
    return SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(localPart).withEmail(localPart + "@open-metadata.org"));
  }

  /** The bot's stored name must equal the email local part, which is how JwtFilter finds it. */
  public static User createBot(TestNamespace ns, String base) {
    String localPart = base + ns.shortPrefix();
    AuthenticationMechanism mechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(localPart)
                .withEmail(localPart + "@test.com")
                .withIsBot(true)
                .withAuthenticationMechanism(mechanism));
  }

  public static String botToken(User bot) {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/users/generateToken/" + bot.getId(),
                "{\"JWTTokenExpiry\":\"Seven\"}");
    return JsonUtils.readValue(response, JWTAuthMechanism.class).getJWTToken();
  }

  public static void revokeBotToken(User bot) {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/users/revokeToken", "{\"id\":\"" + bot.getId() + "\"}");
  }

  public static PersonalAccessToken createPat(User owner, String tokenName) {
    String response =
        clientFor(owner)
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/users/security/token",
                "{\"tokenName\":\"" + tokenName + "\",\"JWTTokenExpiry\":\"OneHour\"}");
    return JsonUtils.readValue(response, PersonalAccessToken.class);
  }

  public static void revokePat(User owner, PersonalAccessToken pat) {
    clientFor(owner)
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/users/security/token/revoke",
            "{\"tokenIds\":[\"" + pat.getToken() + "\"]}");
  }

  /** A token OpenMetadata signs for a session: not a bot or PAT token, so it has no stored check. */
  public static String loginToken(User user) {
    return JwtAuthProvider.tokenFor(
        user.getEmail(), user.getEmail(), new String[] {}, LOGIN_TOKEN_TTL_SECONDS);
  }

  public static HttpResponse<String> get(String path, String bearerToken) {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(TestSuiteBootstrap.getBaseUrl() + path))
            .header("Authorization", "Bearer " + bearerToken)
            .timeout(Duration.ofSeconds(20))
            .GET()
            .build();
    try {
      return HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (IOException failure) {
      throw new UncheckedIOException(failure);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while calling " + path, interrupted);
    }
  }

  public static int status(String path, String bearerToken) {
    return get(path, bearerToken).statusCode();
  }

  public static void execute(String sql, String name) {
    Entity.getJdbi().useHandle(handle -> handle.createUpdate(sql).bind("name", name).execute());
  }

  public static void deletePatRows(User owner) {
    Entity.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "DELETE FROM user_tokens WHERE userId = :id"
                            + " AND tokenType = 'PERSONAL_ACCESS_TOKEN'")
                    .bind("id", owner.getId().toString())
                    .execute());
  }

  public static String removeMechanismSql() {
    return currentConnectionType() == ConnectionType.MYSQL
        ? "UPDATE user_entity SET json = JSON_REMOVE(json, '$.authenticationMechanism')"
            + " WHERE name = :name"
        : "UPDATE user_entity SET json = json - 'authenticationMechanism' WHERE name = :name";
  }

  public static String softDeleteSql() {
    return currentConnectionType() == ConnectionType.MYSQL
        ? "UPDATE user_entity SET json = JSON_SET(json, '$.deleted', true) WHERE name = :name"
        : "UPDATE user_entity SET json = jsonb_set(json, '{deleted}', 'true') WHERE name = :name";
  }

  private static OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }
}
