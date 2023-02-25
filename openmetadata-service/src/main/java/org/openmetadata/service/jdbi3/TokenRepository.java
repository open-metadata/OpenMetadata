package org.openmetadata.service.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class TokenRepository {
  private final CollectionDAO dao;

  public TokenRepository(CollectionDAO dao) {
    this.dao = dao;
  }

  public TokenInterface findByToken(String token) {
    return dao.getTokenDAO().findByToken(token);
  }

  public List<TokenInterface> findByUserIdAndType(String userId, String type) {
    return dao.getTokenDAO().getAllUserTokenWithType(userId, type);
  }

  public void insertToken(TokenInterface tokenInterface) throws JsonProcessingException {
    dao.getTokenDAO().insert(JsonUtils.pojoToJson(tokenInterface));
  }

  public void updateToken(TokenInterface tokenInterface) throws JsonProcessingException {
    dao.getTokenDAO().update(tokenInterface.getToken().toString(), JsonUtils.pojoToJson(tokenInterface));
  }

  public void deleteToken(String token) {
    try {
      dao.getTokenDAO().delete(token);
    } catch (Exception ex) {
      LOG.info("Token not present for the user");
    }
  }

  public void deleteTokenByUserAndType(String userId, String type) {
    try {
      dao.getTokenDAO().deleteTokenByUserAndType(userId, type);
    } catch (Exception ex) {
      LOG.info("Token not present for the user");
    }
  }
}
