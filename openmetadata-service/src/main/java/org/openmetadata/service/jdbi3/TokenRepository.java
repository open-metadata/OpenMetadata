package org.openmetadata.service.jdbi3;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.credentials.Credentials;

@Slf4j
@Repository
public class TokenRepository {
  static final String TOKEN_NOT_PRESENT_MSG = "Token not present for the user";
  private final CollectionDAO dao;

  public TokenRepository() {
    this.dao = Entity.getCollectionDAO();
  }

  public TokenInterface findByToken(String token) {
    TokenInterface result = dao.getTokenDAO().findByToken(token);
    if (result == null) {
      throw new EntityNotFoundException("Invalid Request Token. Please check your Token");
    }
    return result;
  }

  public List<TokenInterface> findByUserIdAndType(UUID userId, String type) {
    return dao.getTokenDAO().getAllUserTokenWithType(userId, type);
  }

  public void insertToken(TokenInterface tokenInterface) {
    dao.getTokenDAO().insert(JsonUtils.pojoToJson(tokenInterface));
  }

  /**
   * Replaces {@code token} with {@code replacement} in one statement. Every column of the row comes
   * from its JSON, so the row takes the replacement's token, and of several requests replacing the
   * same token only one succeeds: false when it was already replaced or deleted.
   */
  public boolean replaceToken(String token, TokenInterface replacement) {
    return dao.getTokenDAO().update(token, JsonUtils.pojoToJson(replacement)) > 0;
  }

  public void deleteToken(String token) {
    try {
      dao.getTokenDAO().delete(token);
    } catch (Exception ex) {
      LOG.info(TOKEN_NOT_PRESENT_MSG);
    }
  }

  public void deleteAllToken(List<String> tokens) {
    try {
      dao.getTokenDAO().deleteAll(tokens);
    } catch (Exception ex) {
      LOG.info(TOKEN_NOT_PRESENT_MSG);
    }
  }

  public void deleteTokenByUserAndType(UUID userId, String type) {
    try {
      dao.getTokenDAO().deleteTokenByUserAndType(userId, type);
    } catch (Exception ex) {
      LOG.info(TOKEN_NOT_PRESENT_MSG);
    }
  }

  /** Failures propagate, unlike the delete methods above: a failed write must not answer 200. */
  public void insertPersonalAccessToken(String userName, PersonalAccessToken token) {
    dao.getTokenDAO().insert(JsonUtils.pojoToJson(token));
    Credentials.changed(userName);
  }

  /** An empty list deletes nothing, so a client sending no ids never loses every token. */
  public void revokePersonalAccessTokens(String userName, UUID userId, List<UUID> tokenIds) {
    if (!tokenIds.isEmpty()) {
      List<String> ids = tokenIds.stream().map(UUID::toString).toList();
      dao.getTokenDAO()
          .deletePersonalAccessTokens(userId, TokenType.PERSONAL_ACCESS_TOKEN.value(), ids);
      Credentials.changed(userName);
    }
  }

  public void revokeAllPersonalAccessTokens(String userName, UUID userId) {
    dao.getTokenDAO().deleteTokenByUserAndType(userId, TokenType.PERSONAL_ACCESS_TOKEN.value());
    Credentials.changed(userName);
  }
}
