package org.openmetadata.mcp.server.auth.repository;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthAuthorizationCodeRecord;

import java.net.URI;
import java.util.List;

/**
 * Repository for managing OAuth authorization codes with database persistence.
 */
@Slf4j
public class OAuthAuthorizationCodeRepository {
  private final CollectionDAO.OAuthAuthorizationCodeDAO dao;

  public OAuthAuthorizationCodeRepository() {
    this.dao = Entity.getCollectionDAO().oauthAuthorizationCodeDAO();
  }

  /**
   * Store an authorization code.
   */
  public void store(
      String code,
      String clientId,
      String connectorName,
      String codeChallenge,
      String codeChallengeMethod,
      URI redirectUri,
      List<String> scopes,
      long expiresAt) {

    dao.insert(
        code,
        clientId,
        connectorName,
        codeChallenge,
        codeChallengeMethod,
        redirectUri.toString(),
        JsonUtils.pojoToJson(scopes),
        expiresAt
    );

    LOG.debug("Stored authorization code in database for client: {}", clientId);
  }

  /**
   * Find authorization code by code value.
   */
  public OAuthAuthorizationCodeRecord findByCode(String code) {
    return dao.findByCode(code);
  }

  /**
   * Mark authorization code as used.
   */
  public void markAsUsed(String code) {
    dao.markAsUsed(code);
    LOG.debug("Marked authorization code as used: {}", code);
  }

  /**
   * Delete authorization code.
   */
  public void delete(String code) {
    dao.delete(code);
    LOG.debug("Deleted authorization code: {}", code);
  }

  /**
   * Delete all expired authorization codes.
   */
  public void deleteExpired() {
    long currentTime = System.currentTimeMillis();
    dao.deleteExpired(currentTime);
    LOG.info("Deleted expired authorization codes");
  }
}
