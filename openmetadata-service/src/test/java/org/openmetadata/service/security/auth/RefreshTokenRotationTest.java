package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiFunction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.TokenRefreshRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.util.TokenUtil;

/**
 * A refresh token is used once. The rows below stand in for the user_tokens table; a token ended
 * after the refresh read it and before it was replaced, as a password change ends every refresh
 * token of its user, yields no new token.
 */
class RefreshTokenRotationTest {
  private final Map<String, TokenInterface> rows = new ConcurrentHashMap<>();
  private final UUID userId = UUID.randomUUID();
  private TokenRepository tokens;
  private boolean endedAfterRead;

  @BeforeEach
  void setUp() {
    CollectionDAO.TokenDAO tokenDAO = mock(CollectionDAO.TokenDAO.class);
    when(tokenDAO.findByToken(anyString()))
        .thenAnswer(
            read -> {
              TokenInterface row = rows.get(read.<String>getArgument(0));
              if (endedAfterRead) {
                rows.clear();
              }
              return row;
            });
    doAnswer(delete -> rows.remove(delete.<String>getArgument(0)))
        .when(tokenDAO)
        .delete(anyString());
    doAnswer(insert -> store(insert.getArgument(0))).when(tokenDAO).insert(anyString());
    doAnswer(
            update ->
                rows.remove(update.<String>getArgument(0)) == null
                    ? 0
                    : store(update.getArgument(1)))
        .when(tokenDAO)
        .update(anyString(), anyString());
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.getTokenDAO()).thenReturn(tokenDAO);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      tokens = new TokenRepository();
    }
  }

  @Test
  void aRefreshReplacesItsTokenWithANewOne() throws Exception {
    RefreshToken issued = issue();

    RefreshToken renewed =
        withTokens(new BasicAuthenticator()).validateAndReturnNewRefresh(userId, request(issued));

    assertNotEquals(issued.getToken(), renewed.getToken());
    assertEquals(Set.of(renewed.getToken().toString()), rows.keySet());
  }

  @Test
  void aTokenEndedWhileItsRefreshRunsYieldsNoNewToken() throws Exception {
    assertNoNewToken(withTokens(new BasicAuthenticator())::validateAndReturnNewRefresh);
  }

  @Test
  void anLdapTokenEndedWhileItsRefreshRunsYieldsNoNewToken() throws Exception {
    assertNoNewToken(withTokens(new LdapAuthenticator())::validateAndReturnNewRefresh);
  }

  private void assertNoNewToken(BiFunction<UUID, TokenRefreshRequest, RefreshToken> refresh) {
    RefreshToken issued = issue();
    endedAfterRead = true;

    assertThrows(AuthenticationException.class, () -> refresh.apply(userId, request(issued)));
    assertTrue(rows.isEmpty(), "no token may outlive the one that was ended");
  }

  private <T> T withTokens(T authenticator) throws Exception {
    Field field = authenticator.getClass().getDeclaredField("tokenRepository");
    field.setAccessible(true);
    field.set(authenticator, tokens);
    return authenticator;
  }

  private RefreshToken issue() {
    RefreshToken token = TokenUtil.getRefreshToken(userId, UUID.randomUUID());
    rows.put(token.getToken().toString(), token);
    return token;
  }

  private int store(String json) {
    RefreshToken token = JsonUtils.readValue(json, RefreshToken.class);
    rows.put(token.getToken().toString(), token);
    return 1;
  }

  private static TokenRefreshRequest request(RefreshToken token) {
    return new TokenRefreshRequest().withRefreshToken(token.getToken().toString());
  }
}
