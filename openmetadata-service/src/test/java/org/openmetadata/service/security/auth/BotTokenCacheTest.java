package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheInvalidationPubSub;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;

/**
 * The cache is per-JVM, so a revocation only reaches other pods through the cache-invalidation
 * channel. These tests pin both halves: the revoking pod publishes, and a receiving pod evicts.
 */
class BotTokenCacheTest {

  @AfterEach
  void resetSecretsManager() {
    SecretsManagerFactory.setSecretsManager(null);
  }

  @Test
  void invalidateTokenTellsPeerPodsToDropTheirCopy() {
    CacheInvalidationPubSub pubSub = mock(CacheInvalidationPubSub.class);
    try (MockedStatic<CacheBundle> bundle = mockStatic(CacheBundle.class)) {
      bundle.when(CacheBundle::getCacheInvalidationPubSub).thenReturn(pubSub);
      BotTokenCache.invalidateToken("ingestion-bot");
    }
    verify(pubSub)
        .publish(
            CacheInvalidationPubSub.TYPE_BOT_TOKEN,
            null,
            "ingestion-bot",
            CacheInvalidationPubSub.OP_REVOKE);
  }

  @Test
  void invalidateTokenIsLocalOnlyWhenNoPubSubIsConfigured() {
    try (MockedStatic<CacheBundle> bundle = mockStatic(CacheBundle.class)) {
      bundle.when(CacheBundle::getCacheInvalidationPubSub).thenReturn(null);
      assertDoesNotThrow(() -> BotTokenCache.invalidateToken("ingestion-bot"));
    }
  }

  @Test
  void peerRevocationEvictsTheCachedTokenSoTheNextLookupReloads() {
    String botName = "bot-" + UUID.randomUUID();
    UserRepository repository = mock(UserRepository.class);
    when(repository.getByName(isNull(), eq(botName), any(), eq(NON_DELETED), eq(true)))
        .thenReturn(botWithToken(botName, "token-1"), botWithToken(botName, "token-2"));
    SecretsManagerFactory.setSecretsManager(mock(SecretsManager.class));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<CacheBundle> bundle = mockStatic(CacheBundle.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(repository);
      bundle.when(CacheBundle::getCacheInvalidationPubSub).thenReturn(null);

      assertEquals("token-1", BotTokenCache.getToken(botName));
      assertEquals(
          "token-1", BotTokenCache.getToken(botName), "second lookup is served from cache");

      BotTokenCache.invalidator().invalidate(CacheInvalidationPubSub.TYPE_BOT_TOKEN, null, botName);

      assertEquals(
          "token-2", BotTokenCache.getToken(botName), "peer revocation forces a fresh load");
    }
    verify(repository, times(2)).getByName(isNull(), eq(botName), any(), eq(NON_DELETED), eq(true));
  }

  @Test
  void invalidatorIgnoresOtherSignalTypes() {
    String botName = "bot-" + UUID.randomUUID();
    UserRepository repository = mock(UserRepository.class);
    when(repository.getByName(isNull(), eq(botName), any(), eq(NON_DELETED), eq(true)))
        .thenReturn(botWithToken(botName, "token-1"));
    SecretsManagerFactory.setSecretsManager(mock(SecretsManager.class));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<CacheBundle> bundle = mockStatic(CacheBundle.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(repository);
      bundle.when(CacheBundle::getCacheInvalidationPubSub).thenReturn(null);

      assertEquals("token-1", BotTokenCache.getToken(botName));
      BotTokenCache.invalidator().invalidate(Entity.USER, null, botName);
      BotTokenCache.invalidator()
          .invalidate(CacheInvalidationPubSub.TYPE_USER_TOKEN, null, botName);
      assertEquals("token-1", BotTokenCache.getToken(botName));
    }
    verify(repository, times(1)).getByName(isNull(), eq(botName), any(), eq(NON_DELETED), eq(true));
  }

  private static User botWithToken(String name, String token) {
    return new User()
        .withName(name)
        .withIsBot(true)
        .withAuthenticationMechanism(
            new AuthenticationMechanism()
                .withAuthType(AuthenticationMechanism.AuthType.JWT)
                .withConfig(new JWTAuthMechanism().withJWTToken(token)));
  }
}
