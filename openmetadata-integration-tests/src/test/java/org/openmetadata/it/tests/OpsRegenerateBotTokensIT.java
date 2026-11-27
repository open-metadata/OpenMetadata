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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.it.bootstrap.ForkedOperations;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;

/**
 * {@code OpenMetadataOperations regenerate-bot-tokens} writes new bot tokens straight to the
 * database from its own JVM. It has no verifier and sends no hint to any server, so the suite's
 * server learns of the change from the database alone: the new token is accepted on its first use.
 * A plain run replaces every bot token; with {@code --skip-current}, a token the configured key
 * still signs is left alone.
 *
 * <p>The command regenerates every bot's token, not only this test's bot, so the class runs in the
 * multi-node lane, which runs one class at a time.
 */
@Tag("multi-node")
@ExtendWith(TestNamespaceExtension.class)
class OpsRegenerateBotTokensIT {
  @Test
  void tokensOfARetiredKeyAreReplacedByOnesThatWorkOnFirstUse(TestNamespace ns) {
    User bot = botWithRetiredKeyToken(ns, "opsbot");
    User otherBot = botWithRetiredKeyToken(ns, "opsbot2");
    String oldToken = storedToken(bot);
    String otherOldToken = storedToken(otherBot);
    double oldVersion = storedVersion(bot);
    String systemBotToken = storedToken(Entity.INGESTION_BOT_NAME);
    assertEquals(401, CredentialFixtures.status(LOGGED_IN_USER, oldToken), "retired key rejected");
    assertEquals(
        200,
        CredentialFixtures.status(LOGGED_IN_USER, systemBotToken),
        "the system bot's token is current before the run");

    int exitCode = ForkedOperations.run("regenerate-bot-tokens", "--expiry", "Seven");

    assertEquals(0, exitCode, "the ops command succeeded, see target/forked-ops-*.log");
    String newToken = storedToken(bot);
    String otherNewToken = storedToken(otherBot);
    assertTrue(storedVersion(bot) > oldVersion, "the regeneration moved the user version");
    assertNotEquals(oldToken, newToken, "the command stored a new token");
    assertNotEquals(otherOldToken, otherNewToken, "one run replaced every stale bot token");
    assertEquals(
        200, CredentialFixtures.status(LOGGED_IN_USER, newToken), "first use of new token");
    assertEquals(
        200,
        CredentialFixtures.status(LOGGED_IN_USER, otherNewToken),
        "first use of the other bot's new token");
    String newSystemBotToken = storedToken(Entity.INGESTION_BOT_NAME);
    assertNotEquals(systemBotToken, newSystemBotToken, "a plain run also replaced a current token");
    assertEquals(
        200,
        CredentialFixtures.status(LOGGED_IN_USER, newSystemBotToken),
        "first use of the system bot's new token");
    String eventJson = changeEventAtVersion(bot, storedVersion(bot));
    JsonNode event = JsonUtils.readTree(eventJson);
    assertEquals("entityUpdated", event.path("eventType").asText(), "audited update");
    assertEquals(
        Entity.ADMIN_USER_NAME, event.path("userName").asText(), "the operator is the actor");
    assertTrue(
        event.path("entity").path("authenticationMechanism").isMissingNode(),
        "the event carries no authentication mechanism");
    assertFalse(
        eventJson.contains(newToken) || eventJson.contains(rawStoredToken(bot.getName())),
        "neither the token nor its stored form is in the event");
  }

  @Test
  void aRunWithSkipCurrentReplacesOnlyStaleTokens(TestNamespace ns) {
    User bot = botWithRetiredKeyToken(ns, "idempotentbot");
    assertEquals(
        0, ForkedOperations.run("regenerate-bot-tokens"), "first run, see forked-ops logs");
    String afterFirstRun = storedToken(bot);
    double versionAfterFirstRun = storedVersion(bot);
    User staleBot = botWithRetiredKeyToken(ns, "stalebot");
    String staleToken = storedToken(staleBot);

    assertEquals(
        0,
        ForkedOperations.run("regenerate-bot-tokens", "--skip-current"),
        "second run, see forked-ops logs");

    assertEquals(afterFirstRun, storedToken(bot), "the current token was not replaced");
    assertEquals(versionAfterFirstRun, storedVersion(bot), 1e-9, "the bot was not rewritten");
    String replacedStaleToken = storedToken(staleBot);
    assertNotEquals(staleToken, replacedStaleToken, "the stale token was replaced");
    assertEquals(
        200,
        CredentialFixtures.status(LOGGED_IN_USER, replacedStaleToken),
        "first use of the stale bot's new token");
  }

  @Test
  void aBotWhoseTokenWasRevokedStaysRevoked(TestNamespace ns) {
    User bot = botWithRetiredKeyToken(ns, "revokedbot");
    CredentialFixtures.revokeBotToken(bot);
    assertEquals("", storedToken(bot), "the revoke endpoint emptied the token");
    double versionAfterRevoke = storedVersion(bot);

    int exitCode = ForkedOperations.run("regenerate-bot-tokens");

    assertEquals(0, exitCode, "a revoked bot is skipped, not failed, see forked-ops logs");
    assertEquals("", storedToken(bot), "the revoked bot did not get a token back");
    assertEquals(versionAfterRevoke, storedVersion(bot), 1e-9, "the bot was not rewritten");
  }

  /** The token a run replaced stops working, which is what a run after a token leaked relies on. */
  @Test
  void aTokenThatARunReplacedIsRejected(TestNamespace ns) {
    User bot = registeredBot(ns, "leakedbot");
    String leakedToken = storedToken(bot);
    assertEquals(
        200, CredentialFixtures.status(LOGGED_IN_USER, leakedToken), "current before the run");

    int exitCode = ForkedOperations.run("regenerate-bot-tokens");

    assertEquals(0, exitCode, "see forked-ops logs");
    String newToken = storedToken(bot);
    assertNotEquals(leakedToken, newToken, "the run replaced the current token");
    assertEquals(
        200, CredentialFixtures.status(LOGGED_IN_USER, newToken), "first use of the new token");
    Duration bound = CredentialSourceTestSupport.serverMaxStaleness();
    Awaitility.await("the replaced token answers 401 within maxStaleness " + bound)
        .atMost(bound.plusSeconds(1).toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(25, TimeUnit.MILLISECONDS)
        .untilAsserted(
            () -> assertEquals(401, CredentialFixtures.status(LOGGED_IN_USER, leakedToken)));
  }

  @Test
  void aKeyThatDiffersFromTheServersJwksExitsWithTwoAndChangesNothing(
      TestNamespace ns, @TempDir Path keyDir) throws Exception {
    User bot = botWithRetiredKeyToken(ns, "mismatchbot");
    String before = storedToken(bot);
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    KeyPair other = generator.generateKeyPair();
    Path privateKey = Files.write(keyDir.resolve("private.der"), other.getPrivate().getEncoded());
    Path publicKey = Files.write(keyDir.resolve("public.der"), other.getPublic().getEncoded());

    int exitCode =
        ForkedOperations.run(
            config ->
                ((ObjectNode) config.path("jwtTokenConfiguration"))
                    .put("rsaprivateKeyFilePath", privateKey.toString())
                    .put("rsapublicKeyFilePath", publicKey.toString()),
            "regenerate-bot-tokens");

    assertEquals(2, exitCode, "key mismatch, see forked-ops logs");
    assertEquals(before, storedToken(bot), "no token was written");
  }

  @Test
  void aPrivateKeyFromAnotherPairStoresNoToken(TestNamespace ns, @TempDir Path keyDir)
      throws Exception {
    User bot = botWithRetiredKeyToken(ns, "keypairbot");
    String before = storedToken(bot);
    KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    Path otherPrivateKey =
        Files.write(
            keyDir.resolve("private.der"), generator.generateKeyPair().getPrivate().getEncoded());

    int exitCode =
        ForkedOperations.run(
            config ->
                ((ObjectNode) config.path("jwtTokenConfiguration"))
                    .put("rsaprivateKeyFilePath", otherPrivateKey.toString()),
            "regenerate-bot-tokens");

    assertEquals(
        1, exitCode, "the public key matches the JWKS, the bot fails, see forked-ops logs");
    assertEquals(before, storedToken(bot), "no token the servers would reject was stored");
  }

  /**
   * The server mints a current token for every new bot, so the token is replaced in the table with
   * what a key rotation leaves behind: a token signed by another key under a {@code kid} the
   * configuration no longer uses.
   */
  private static User botWithRetiredKeyToken(TestNamespace ns, String name) {
    User bot = registeredBot(ns, name);
    String retired = Fernet.getInstance().encryptIfApplies(tokenSignedByARetiredKey(bot));
    String json =
        Entity.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT json FROM user_entity WHERE name = :name")
                        .bind("name", bot.getName())
                        .mapTo(String.class)
                        .one());
    ObjectNode user = (ObjectNode) JsonUtils.readTree(json);
    ((ObjectNode) user.path("authenticationMechanism").path("config")).put("JWTToken", retired);
    // The DAO holds both the MySQL and the Postgres (jsonb) form of the write; the lanes run both
    Entity.getCollectionDAO()
        .userDAO()
        .update(bot.getId(), bot.getFullyQualifiedName(), user.toString());
    return bot;
  }

  /** A bot user behind a bot entity, holding the current token the server minted for it. */
  private static User registeredBot(TestNamespace ns, String name) {
    User bot = CredentialFixtures.createBot(ns, name);
    SdkClients.adminClient()
        .bots()
        .create(new CreateBot().withName(ns.prefix(name)).withBotUser(bot.getName()));
    return bot;
  }

  private static String tokenSignedByARetiredKey(User bot) {
    JWTTokenConfiguration jwt =
        TestSuiteBootstrap.createApplicationConfigCopy().getJwtTokenConfiguration();
    try {
      KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
      generator.initialize(2048);
      RSAPrivateKey retiredKey = (RSAPrivateKey) generator.generateKeyPair().getPrivate();
      return JWT.create()
          .withKeyId("retired-key")
          .withIssuer(jwt.getJwtissuer())
          .withClaim("sub", bot.getName())
          .sign(Algorithm.RSA256(null, retiredKey));
    } catch (GeneralSecurityException failure) {
      throw new IllegalStateException(failure);
    }
  }

  private static String changeEventAtVersion(User bot, double version) {
    String sql =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL
            ? "SELECT CAST(json AS CHAR) FROM change_event WHERE json ->> '$.entityId' = :id"
            : "SELECT json::text FROM change_event WHERE json ->> 'entityId' = :id";
    List<String> events =
        Entity.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery(sql)
                        .bind("id", bot.getId().toString())
                        .mapTo(String.class)
                        .list());
    return events.stream()
        .filter(json -> isAtVersion(JsonUtils.readTree(json), version))
        .findFirst()
        .orElseThrow(() -> new AssertionError("no change event at version " + version));
  }

  private static boolean isAtVersion(JsonNode event, double version) {
    return Math.abs(event.path("currentVersion").asDouble() - version) < 1e-9;
  }

  private static double storedVersion(User bot) {
    return Entity.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM user_entity WHERE name = :name")
                    .bind("name", bot.getName())
                    .mapTo(String.class)
                    .map(json -> JsonUtils.readTree(json).path("version").asDouble())
                    .one());
  }

  /**
   * Read from the table, not through the API: the command did not go through the suite server, so
   * the server's entity cache may still hold the bot's previous document.
   */
  private static String storedToken(User bot) {
    return storedToken(bot.getName());
  }

  private static String storedToken(String userName) {
    return Fernet.getInstance().decryptIfApplies(rawStoredToken(userName));
  }

  /** The token as the table holds it: Fernet ciphertext when a Fernet key is configured. */
  private static String rawStoredToken(String userName) {
    String json =
        Entity.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT json FROM user_entity WHERE name = :name")
                        .bind("name", userName)
                        .mapTo(String.class)
                        .one());
    return JsonUtils.readTree(json)
        .path("authenticationMechanism")
        .path("config")
        .path("JWTToken")
        .asText();
  }
}
