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

import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CacheProvider;

/**
 * A server still on the previous release reads {@code credential:bot:*} and {@code
 * credential:pat:*} from Redis on every request. A revoke on a new server must delete both, so the
 * old server's next request reloads from the database. A new server never writes either key, so
 * both are absent after the revoke.
 */
@Tag("multi-node")
@ExtendWith(TestNamespaceExtension.class)
@EnabledIf(value = "org.openmetadata.it.bootstrap.TestSuiteBootstrap#isRedisEnabled")
class CredentialLegacyKeyShimIT {
  private static final String PLANTED = "ready:planted-by-an-old-server";

  @Test
  void botRevokeDeletesTheLegacyKeysOfTheBot(TestNamespace ns) {
    User bot = createBot(ns);
    String botKey = legacyKey("bot", bot.getName());
    String patKey = legacyKey("pat", bot.getName());
    plant(botKey);
    plant(patKey);

    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, "/v1/users/revokeToken", "{\"id\":\"" + bot.getId() + "\"}");

    assertEquals(Optional.empty(), provider().get(botKey));
    assertEquals(Optional.empty(), provider().get(patKey));
  }

  @Test
  void patRevokeDeletesTheLegacyKeysOfTheOwner(TestNamespace ns) {
    User owner = createUser(ns);
    OpenMetadataClient ownerClient =
        SdkClients.createClient(owner.getEmail(), owner.getEmail(), new String[] {});
    PersonalAccessToken pat = createPat(ownerClient, ns.prefix("pat"));
    String botKey = legacyKey("bot", owner.getName());
    String patKey = legacyKey("pat", owner.getName());
    plant(botKey);
    plant(patKey);

    ownerClient
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/users/security/token/revoke",
            "{\"tokenIds\":[\"" + pat.getToken() + "\"]}");

    assertEquals(Optional.empty(), provider().get(botKey));
    assertEquals(Optional.empty(), provider().get(patKey));
  }

  private static CacheProvider provider() {
    return CacheBundle.getCacheProvider();
  }

  private static String legacyKey(String kind, String name) {
    return new CacheKeys(CacheBundle.getCacheConfig().redis.keyspace).credentialState(kind, name);
  }

  private static void plant(String key) {
    provider().set(key, PLANTED, Duration.ofMinutes(5));
  }

  private static User createBot(TestNamespace ns) {
    String localPart = "shimbot" + ns.shortPrefix();
    AuthenticationMechanism mechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
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

  private static User createUser(TestNamespace ns) {
    String localPart = "shimuser" + ns.shortPrefix();
    return SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(localPart).withEmail(localPart + "@open-metadata.org"));
  }

  private static PersonalAccessToken createPat(OpenMetadataClient owner, String tokenName) {
    String response =
        owner
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/users/security/token",
                "{\"tokenName\":\"" + tokenName + "\",\"JWTTokenExpiry\":\"OneHour\"}");
    return JsonUtils.readValue(response, PersonalAccessToken.class);
  }
}
