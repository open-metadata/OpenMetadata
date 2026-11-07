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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
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

/**
 * {@code OpenMetadataOperations regenerate-bot-tokens} writes new bot tokens straight to the
 * database from its own JVM. It has no verifier and sends no hint to any server, so the suite's
 * server learns of the change from the database alone: the new token is accepted on its first use.
 * A token the configured key still signs is left alone.
 *
 * <p>The command regenerates every bot's token, not only this test's bot, so the class runs in the
 * multi-node lane, which runs one class at a time.
 */
@Tag("multi-node")
@ExtendWith(TestNamespaceExtension.class)
class OpsRegenerateBotTokensIT {
  @Test
  void aTokenOfARetiredKeyIsReplacedByOneThatWorksOnFirstUse(TestNamespace ns) {
    User bot = botWithRetiredKeyToken(ns, "opsbot");
    String oldToken = storedToken(bot);
    double oldVersion = storedVersion(bot);
    assertEquals(401, CredentialFixtures.status(LOGGED_IN_USER, oldToken), "retired key rejected");

    int exitCode = ForkedOperations.run("regenerate-bot-tokens", "--expiry", "Seven");

    assertEquals(0, exitCode, "the ops command succeeded, see target/forked-ops-*.log");
    String newToken = storedToken(bot);
    assertTrue(storedVersion(bot) > oldVersion, "the regeneration moved the user version");
    assertNotEquals(oldToken, newToken, "the command stored a new token");
    assertEquals(
        200, CredentialFixtures.status(LOGGED_IN_USER, newToken), "first use of new token");
  }

  @Test
  void aSecondRunLeavesCurrentTokensUnchanged(TestNamespace ns) {
    User bot = botWithRetiredKeyToken(ns, "idempotentbot");
    assertEquals(
        0, ForkedOperations.run("regenerate-bot-tokens"), "first run, see forked-ops logs");
    String afterFirstRun = storedToken(bot);
    double versionAfterFirstRun = storedVersion(bot);

    assertEquals(
        0, ForkedOperations.run("regenerate-bot-tokens"), "second run, see forked-ops logs");

    assertEquals(afterFirstRun, storedToken(bot), "the current token was not replaced");
    assertEquals(versionAfterFirstRun, storedVersion(bot), 1e-9, "the bot was not rewritten");
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

  /**
   * The server mints a current token for every new bot, so the token is replaced in the table with
   * one signed by the suite's key under a {@code kid} the configuration no longer uses.
   */
  private static User botWithRetiredKeyToken(TestNamespace ns, String name) {
    User bot = CredentialFixtures.createBot(ns, name);
    SdkClients.adminClient()
        .bots()
        .create(new CreateBot().withName(ns.prefix(name)).withBotUser(bot.getName()));
    String retired = Fernet.getInstance().encryptIfApplies(tokenWithRetiredKid(bot));
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

  private static String tokenWithRetiredKid(User bot) {
    JWTTokenConfiguration jwt =
        TestSuiteBootstrap.createApplicationConfigCopy().getJwtTokenConfiguration();
    try {
      RSAPrivateKey key =
          (RSAPrivateKey)
              KeyFactory.getInstance("RSA")
                  .generatePrivate(
                      new PKCS8EncodedKeySpec(
                          Files.readAllBytes(Path.of(jwt.getRsaprivateKeyFilePath()))));
      return JWT.create()
          .withKeyId("retired-key")
          .withIssuer(jwt.getJwtissuer())
          .withClaim("sub", bot.getName())
          .sign(Algorithm.RSA256(null, key));
    } catch (GeneralSecurityException | IOException failure) {
      throw new IllegalStateException(failure);
    }
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
    String json =
        Entity.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT json FROM user_entity WHERE name = :name")
                        .bind("name", bot.getName())
                        .mapTo(String.class)
                        .one());
    String stored =
        JsonUtils.readTree(json)
            .path("authenticationMechanism")
            .path("config")
            .path("JWTToken")
            .asText();
    return Fernet.getInstance().decryptIfApplies(stored);
  }
}
