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

package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Set;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.stubbing.OngoingStubbing;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;

/** The answers other distributions read from {@link BotTokenCache#getToken}. */
class BotTokenCacheTest {
  private static final String BOT = "ingestion-bot";
  private static final Fields FIELDS = new Fields(Set.of(UserResource.USER_PROTECTED_FIELDS));
  private static final RelationIncludes INCLUDES =
      RelationIncludes.fromInclude(Include.NON_DELETED);

  @BeforeAll
  static void useTheDatabaseSecretsManager() {
    SecretsManagerFactory.setSecretsManager(null);
    SecretsManagerFactory.createSecretsManager(new SecretsManagerConfiguration(), "openmetadata");
  }

  @AfterAll
  static void clearTheSecretsManager() {
    SecretsManagerFactory.setSecretsManager(null);
  }

  @AfterEach
  void clearTheRequestCache() {
    RequestEntityCache.clear();
  }

  @Test
  void storedTokenIsReturned() {
    User bot =
        JsonUtils.readValue(
            "{\"name\":\"ingestion-bot\",\"isBot\":true,\"authenticationMechanism\":"
                + "{\"authType\":\"JWT\",\"config\":{\"JWTToken\":\"stored-token\"}}}",
            User.class);

    assertEquals("stored-token", tokenWhen(repository -> stub(repository).thenReturn(bot)));
  }

  @Test
  void botWithoutAMechanismHasAnEmptyToken() {
    User bot = new User().withName(BOT).withIsBot(true);

    assertEquals(
        BotTokenCache.EMPTY_STRING, tokenWhen(repository -> stub(repository).thenReturn(bot)));
  }

  @Test
  void unknownBotHasAnEmptyToken() {
    assertEquals(
        BotTokenCache.EMPTY_STRING,
        tokenWhen(repository -> stub(repository).thenThrow(EntityNotFoundException.byName(BOT))));
  }

  @Test
  void unreadableBotHasNoToken() {
    assertNull(
        tokenWhen(
            repository -> stub(repository).thenThrow(new IllegalStateException("unreachable"))));
  }

  @Test
  void tokenLoadIgnoresBotUserLeftOnThreadByEarlierRequest() {
    RequestEntityCache.putByName(
        Entity.USER, BOT, FIELDS, INCLUDES, false, botWithToken("revoked-token"), User.class);

    assertEquals(
        "current-token",
        tokenWhen(
            repository ->
                stub(repository)
                    .thenAnswer(invocation -> requestCachedOr(botWithToken("current-token")))));
  }

  // Mirrors EntityRepository.getByName: the request cache answers before the database.
  private static User requestCachedOr(User storedUser) {
    User cached =
        RequestEntityCache.getByName(Entity.USER, BOT, FIELDS, INCLUDES, false, User.class);
    return cached != null ? cached : storedUser;
  }

  private static User botWithToken(String token) {
    return new User()
        .withName(BOT)
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.JWT)
                .withConfig(new JWTAuthMechanism().withJWTToken(token)));
  }

  private static String tokenWhen(Consumer<UserRepository> stubbing) {
    UserRepository repository = mock(UserRepository.class);
    stubbing.accept(repository);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(repository);
      return BotTokenCache.getToken(BOT);
    }
  }

  private static OngoingStubbing<User> stub(UserRepository repository) {
    return when(
        repository.getByName(
            eq(null), eq(BOT), any(Fields.class), eq(Include.NON_DELETED), eq(false)));
  }
}
