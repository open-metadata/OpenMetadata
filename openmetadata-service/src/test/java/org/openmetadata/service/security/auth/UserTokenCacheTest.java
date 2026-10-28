package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.teams.UserResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;

class UserTokenCacheTest {
  private static final String USER_NAME = "alice";
  private static final Fields FIELDS = new Fields(Set.of(UserResource.USER_PROTECTED_FIELDS));
  private static final RelationIncludes INCLUDES = RelationIncludes.fromInclude(NON_DELETED);
  private static final UUID STALE_USER_ID = UUID.randomUUID();
  private static final UUID CURRENT_USER_ID = UUID.randomUUID();

  @AfterEach
  void cleanup() {
    RequestEntityCache.clear();
  }

  @Test
  void tokenLoadIgnoresUserLeftOnThreadByEarlierRequest() {
    // The user was deleted and recreated with the same name; an earlier request on this thread
    // cached the old one.
    RequestEntityCache.putByName(
        Entity.USER, USER_NAME, FIELDS, INCLUDES, false, user(STALE_USER_ID), User.class);
    UserRepository userRepository = mock(UserRepository.class);
    when(userRepository.getByName(
            isNull(), eq(USER_NAME), any(Fields.class), eq(NON_DELETED), eq(false)))
        .thenAnswer(invocation -> requestCachedOr(user(CURRENT_USER_ID)));
    TokenRepository tokenRepository = mock(TokenRepository.class);
    String patType = TokenType.PERSONAL_ACCESS_TOKEN.value();
    when(tokenRepository.findByUserIdAndType(STALE_USER_ID, patType))
        .thenReturn(List.of(new PersonalAccessToken().withJwtToken("stale-user-token")));
    when(tokenRepository.findByUserIdAndType(CURRENT_USER_ID, patType))
        .thenReturn(List.of(new PersonalAccessToken().withJwtToken("current-user-token")));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      entity.when(Entity::getTokenRepository).thenReturn(tokenRepository);

      assertEquals(Set.of("current-user-token"), UserTokenCache.getToken(USER_NAME));
    }
  }

  // Mirrors EntityRepository.getByName: the request cache answers before the database.
  private static User requestCachedOr(User storedUser) {
    User cached =
        RequestEntityCache.getByName(Entity.USER, USER_NAME, FIELDS, INCLUDES, false, User.class);
    return cached != null ? cached : storedUser;
  }

  private static User user(UUID id) {
    return new User().withId(id).withName(USER_NAME);
  }
}
