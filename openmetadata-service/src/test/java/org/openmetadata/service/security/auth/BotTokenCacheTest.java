package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;

class BotTokenCacheTest {
  private static final String BOT_NAME = "ingestion-bot";
  private static final Fields FIELDS = new Fields(Set.of(UserResource.USER_PROTECTED_FIELDS));
  private static final RelationIncludes INCLUDES = RelationIncludes.fromInclude(NON_DELETED);

  @AfterEach
  void cleanup() {
    RequestEntityCache.clear();
  }

  @Test
  void tokenLoadIgnoresBotUserLeftOnThreadByEarlierRequest() {
    RequestEntityCache.putByName(
        Entity.USER, BOT_NAME, FIELDS, INCLUDES, false, botWithToken("revoked-token"), User.class);
    UserRepository userRepository = mock(UserRepository.class);
    when(userRepository.getByName(
            isNull(), eq(BOT_NAME), any(Fields.class), eq(NON_DELETED), eq(false)))
        .thenAnswer(invocation -> requestCachedOr(botWithToken("current-token")));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<SecretsManagerFactory> secrets = mockStatic(SecretsManagerFactory.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      secrets.when(SecretsManagerFactory::getSecretsManager).thenReturn(mock(SecretsManager.class));

      assertEquals("current-token", BotTokenCache.getToken(BOT_NAME));
    }
  }

  // Mirrors EntityRepository.getByName: the request cache answers before the database.
  private static User requestCachedOr(User storedUser) {
    User cached =
        RequestEntityCache.getByName(Entity.USER, BOT_NAME, FIELDS, INCLUDES, false, User.class);
    return cached != null ? cached : storedUser;
  }

  private static User botWithToken(String token) {
    return new User()
        .withName(BOT_NAME)
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.JWT)
                .withConfig(new JWTAuthMechanism().withJWTToken(token)));
  }
}
