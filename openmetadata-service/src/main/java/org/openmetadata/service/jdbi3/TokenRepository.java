package org.openmetadata.service.jdbi3;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

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
}
