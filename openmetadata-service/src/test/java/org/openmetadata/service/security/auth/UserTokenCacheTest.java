package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheInvalidationPubSub;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;

/** Personal-access-token twin of {@link BotTokenCacheTest}. */
class UserTokenCacheTest {

  @Test
  void invalidateTokenTellsPeerPodsToDropTheirCopy() {
    CacheInvalidationPubSub pubSub = mock(CacheInvalidationPubSub.class);
    try (MockedStatic<CacheBundle> bundle = mockStatic(CacheBundle.class)) {
      bundle.when(CacheBundle::getCacheInvalidationPubSub).thenReturn(pubSub);
      UserTokenCache.invalidateToken("sam");
    }
    verify(pubSub)
        .publish(
            CacheInvalidationPubSub.TYPE_USER_TOKEN,
            null,
            "sam",
            CacheInvalidationPubSub.OP_REVOKE);
  }

  @Test
  void peerRevocationEvictsTheCachedTokensSoTheNextLookupReloads() throws Exception {
    String userName = "user-" + UUID.randomUUID();
    UUID userId = UUID.randomUUID();
    UserRepository userRepository = mock(UserRepository.class);
    when(userRepository.getByName(isNull(), eq(userName), any(), eq(NON_DELETED), eq(true)))
        .thenReturn(new User().withId(userId).withName(userName));
    TokenRepository tokenRepository = mock(TokenRepository.class);
    when(tokenRepository.findByUserIdAndType(userId, TokenType.PERSONAL_ACCESS_TOKEN.value()))
        .thenReturn(List.of(pat("pat-1")), List.of());

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<CacheBundle> bundle = mockStatic(CacheBundle.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entity.when(Entity::getTokenRepository).thenReturn(tokenRepository);
      bundle.when(CacheBundle::getCacheInvalidationPubSub).thenReturn(null);
      forceReinitialize();

      assertEquals(Set.of("pat-1"), UserTokenCache.getToken(userName));
      assertEquals(Set.of("pat-1"), UserTokenCache.getToken(userName), "served from cache");

      UserTokenCache.invalidator()
          .invalidate(CacheInvalidationPubSub.TYPE_USER_TOKEN, null, userName);

      assertTrue(
          UserTokenCache.getToken(userName).isEmpty(),
          "peer revocation forces a fresh load, which no longer lists the revoked token");
    }
    verify(tokenRepository, times(2))
        .findByUserIdAndType(userId, TokenType.PERSONAL_ACCESS_TOKEN.value());
  }

  private static PersonalAccessToken pat(String jwt) {
    return new PersonalAccessToken().withToken(UUID.randomUUID()).withJwtToken(jwt);
  }

  /**
   * {@code initialize()} is one-shot per JVM; another test may already have bound the repository.
   * Re-arm it so this test's stubbed {@code Entity.getTokenRepository()} is the one picked up.
   */
  private static void forceReinitialize() throws Exception {
    Field initialized = UserTokenCache.class.getDeclaredField("initialized");
    initialized.setAccessible(true);
    initialized.set(null, false);
    UserTokenCache.initialize();
  }
}
