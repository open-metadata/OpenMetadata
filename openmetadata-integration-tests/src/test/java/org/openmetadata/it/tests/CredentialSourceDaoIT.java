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
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.currentConnectionType;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
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
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;
import org.openmetadata.service.security.credentials.TokenDigest;

/**
 * Component test of the credential source's SQL against the real tables: the fingerprint moves on
 * every credential write and stays still on unrelated ones, and the cheap and full reads agree.
 */
@ExtendWith(TestNamespaceExtension.class)
class CredentialSourceDaoIT {

  private final Jdbi jdbi = Entity.getJdbi();

  @Test
  void patInsertAndDeleteMoveTheFingerprint(TestNamespace ns) {
    User owner = createRegularUser(ns, "patfp");
    Object before = fingerprint(owner);

    PersonalAccessToken pat = createPat(owner, ns.prefix("pat"));
    Object withPat = fingerprint(owner);
    assertNotEquals(before, withPat);
    assertEquals(
        Set.of(TokenDigest.of(pat.getJwtToken())),
        CredentialSourceTestSupport.digests(jdbi, owner.getName()));

    revokePat(owner, pat);
    assertNotEquals(withPat, fingerprint(owner));
    assertEquals(Set.of(), CredentialSourceTestSupport.digests(jdbi, owner.getName()));
  }

  @Test
  void softDeleteAndRestoreMoveTheFingerprint(TestNamespace ns) {
    User owner = createRegularUser(ns, "softfp");
    Object live = fingerprint(owner);

    SdkClients.adminClient().users().delete(owner.getId().toString());
    Object deleted = fingerprint(owner);
    assertNotEquals(live, deleted);
    assertEquals(0, CredentialSourceTestSupport.digests(jdbi, owner.getName()).size());

    SdkClients.adminClient().users().restore(owner.getId().toString());
    assertNotEquals(deleted, fingerprint(owner));
  }

  @Test
  void hardDeleteMakesTheUserAbsent(TestNamespace ns) {
    User owner = createRegularUser(ns, "hardfp");
    createPat(owner, ns.prefix("pat"));

    SdkClients.adminClient()
        .users()
        .delete(owner.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    assertEquals(CredentialSourceTestSupport.absentFingerprint(), fingerprint(owner));
    assertEquals(0, CredentialSourceTestSupport.digests(jdbi, owner.getName()).size());
  }

  @Test
  void botRotationThroughTheApiMovesTheFingerprint(TestNamespace ns) {
    User bot = createBotUser(ns, "rotfp");
    SdkClients.adminClient().users().generateToken(bot.getId(), JWTTokenExpiry.Seven);
    Object first = fingerprint(bot);

    SdkClients.adminClient().users().generateToken(bot.getId(), JWTTokenExpiry.Thirty);

    assertNotEquals(first, fingerprint(bot));
  }

  @Test
  void externalSecretsShapedRotationMovesItThroughUpdatedAtAlone(TestNamespace ns) {
    User bot = createBotUser(ns, "extfp");
    SdkClients.adminClient().users().generateToken(bot.getId(), JWTTokenExpiry.Seven);
    Object before = fingerprint(bot);

    execute(bumpUpdatedAtSql(), bot.getName());

    assertNotEquals(before, fingerprint(bot));
  }

  @Test
  void directSqlEditOfTheMechanismMovesTheFingerprint(TestNamespace ns) {
    User bot = createBotUser(ns, "sqlfp");
    SdkClients.adminClient().users().generateToken(bot.getId(), JWTTokenExpiry.Seven);
    Object before = fingerprint(bot);

    execute(editMechanismSql(), bot.getName());

    assertNotEquals(before, fingerprint(bot));
  }

  @Test
  void directDeleteFromUserTokensMovesTheFingerprint(TestNamespace ns) {
    User owner = createRegularUser(ns, "rowfp");
    createPat(owner, ns.prefix("pat"));
    Object before = fingerprint(owner);

    jdbi.useHandle(
        handle ->
            handle
                .createUpdate("DELETE FROM user_tokens WHERE userId = :id")
                .bind("id", owner.getId().toString())
                .execute());

    assertNotEquals(before, fingerprint(owner));
  }

  @Test
  void lastActivityTimeUpdateDoesNotMoveTheFingerprint(TestNamespace ns) {
    User owner = createRegularUser(ns, "actfp");
    Object before = fingerprint(owner);

    ((UserRepository) Entity.getEntityRepository(Entity.USER))
        .updateUserLastActivityTime(owner.getName(), System.currentTimeMillis());

    assertEquals(before, fingerprint(owner));
  }

  @Test
  void cheapAndFullFingerprintsAgreeForTheSameRows(TestNamespace ns) {
    User owner = createRegularUser(ns, "samefp");
    createPat(owner, ns.prefix("pat1"));
    createPat(owner, ns.prefix("pat2"));
    User bot = createBotUser(ns, "samebot");
    SdkClients.adminClient().users().generateToken(bot.getId(), JWTTokenExpiry.Seven);

    for (User user : new User[] {owner, bot}) {
      assertEquals(
          fingerprint(user), CredentialSourceTestSupport.fullFingerprint(jdbi, user.getName()));
    }
  }

  @Test
  void botAndPatDigestsComeFromTheRows(TestNamespace ns) {
    User bot = createBotUser(ns, "digestbot");
    String botJwt =
        SdkClients.adminClient()
            .users()
            .generateToken(bot.getId(), JWTTokenExpiry.Seven)
            .getJWTToken();
    User owner = createRegularUser(ns, "digestpat");
    String patJwt = createPat(owner, ns.prefix("pat")).getJwtToken();

    assertEquals(
        Set.of(TokenDigest.of(botJwt)), CredentialSourceTestSupport.digests(jdbi, bot.getName()));
    assertEquals(
        Set.of(TokenDigest.of(patJwt)), CredentialSourceTestSupport.digests(jdbi, owner.getName()));
  }

  @Test
  void aCallersUncommittedWriteIsInvisibleToTheRead(TestNamespace ns) {
    User owner = createRegularUser(ns, "txfp");
    Object before = fingerprint(owner);

    Object seenInsideTransaction =
        jdbi.inTransaction(
            handle -> {
              handle.createUpdate(bumpUpdatedAtSql()).bind("name", owner.getName()).execute();
              return fingerprint(owner);
            });

    assertEquals(before, seenInsideTransaction);
  }

  @Test
  void dotsAndMixedCaseResolveToTheRowGetByNameFinds(TestNamespace ns) {
    String name = "Dotted.Mixed" + ns.shortPrefix();
    User user =
        SdkClients.adminClient()
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name.toLowerCase(Locale.ROOT) + "@test.com"));
    assertEquals(user.getId(), SdkClients.adminClient().users().getByName(name).getId());

    Object exact = CredentialSourceTestSupport.fingerprint(jdbi, name);
    Object upper = CredentialSourceTestSupport.fingerprint(jdbi, name.toUpperCase(Locale.ROOT));

    assertNotEquals(CredentialSourceTestSupport.absentFingerprint(), exact);
    assertEquals(exact, upper);
  }

  @Test
  void fingerprintStatementUsesTheNameHashAndUserTypeIndexes(TestNamespace ns) throws Exception {
    User owner = createRegularUser(ns, "planfp");
    createPat(owner, ns.prefix("pat"));

    String plan = CredentialSourceTestSupport.explainFingerprintStatement(jdbi, owner.getName());

    if (currentConnectionType() == ConnectionType.MYSQL) {
      assertTrue(plan.contains("t:idx_user_tokens_user_type"), plan);
      assertFalse(plan.contains("u:null"), plan);
    } else {
      assertTrue(plan.contains("idx_user_tokens_user_type"), plan);
      assertTrue(plan.toLowerCase(Locale.ROOT).contains("namehash"), plan);
    }
  }

  private Object fingerprint(User user) {
    return CredentialSourceTestSupport.fingerprint(jdbi, user.getName());
  }

  private void execute(String sql, String name) {
    jdbi.useHandle(handle -> handle.createUpdate(sql).bind("name", name).execute());
  }

  private static String bumpUpdatedAtSql() {
    return currentConnectionType() == ConnectionType.MYSQL
        ? "UPDATE user_entity SET json = JSON_SET(json, '$.updatedAt', "
            + "JSON_EXTRACT(json, '$.updatedAt') + 1) WHERE name = :name"
        : "UPDATE user_entity SET json = jsonb_set(json, '{updatedAt}', "
            + "to_jsonb((json->>'updatedAt')::bigint + 1)) WHERE name = :name";
  }

  private static String editMechanismSql() {
    return currentConnectionType() == ConnectionType.MYSQL
        ? "UPDATE user_entity SET json = JSON_SET(json, "
            + "'$.authenticationMechanism.config.JWTTokenExpiry', 'Thirty') WHERE name = :name"
        : "UPDATE user_entity SET json = jsonb_set(json, "
            + "'{authenticationMechanism,config,JWTTokenExpiry}', '\"Thirty\"') WHERE name = :name";
  }

  private static User createRegularUser(TestNamespace ns, String base) {
    String localPart = base + ns.shortPrefix();
    return SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(localPart).withEmail(localPart + "@open-metadata.org"));
  }

  /** The bot's stored name must equal the email local part, which is how JwtFilter finds it. */
  private static User createBotUser(TestNamespace ns, String base) {
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

  private static OpenMetadataClient clientFor(User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private static PersonalAccessToken createPat(User owner, String tokenName) {
    String response =
        clientFor(owner)
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/users/security/token",
                "{\"tokenName\":\"" + tokenName + "\",\"JWTTokenExpiry\":\"OneHour\"}");
    return JsonUtils.readValue(response, PersonalAccessToken.class);
  }

  private static void revokePat(User owner, PersonalAccessToken pat) {
    clientFor(owner)
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/users/security/token/revoke",
            "{\"tokenIds\":[\"" + pat.getToken() + "\"]}");
  }
}
