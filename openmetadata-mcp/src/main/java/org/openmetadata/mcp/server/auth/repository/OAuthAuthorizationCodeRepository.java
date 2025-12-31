package org.openmetadata.mcp.server.auth.repository;

import java.net.URI;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthAuthorizationCodeRecord;

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
      String userName,
      String codeChallenge,
      String codeChallengeMethod,
      URI redirectUri,
      List<String> scopes,
      long expiresAt) {

    dao.insert(
        code,
        clientId,
        connectorName,
        userName,
        codeChallenge,
        codeChallengeMethod,
        redirectUri.toString(),
        JsonUtils.pojoToJson(scopes),
        expiresAt);

    LOG.debug(
        "Stored authorization code in database for client: {} by user: {}", clientId, userName);
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
   * Atomically mark authorization code as used and return the updated record.
   * This prevents race conditions by using a database-level UPDATE with WHERE clause
   * that checks the code is not already used.
   *
   * @param code The authorization code to mark as used
   * @return The updated record if successful, null if code was already used or doesn't exist
   */
  public OAuthAuthorizationCodeRecord markAsUsedAtomic(String code) {
    int rowsAffected = dao.markAsUsedAtomic(code);
    if (rowsAffected == 1) {
      LOG.debug("Atomically marked authorization code as used: {}", code);
      return dao.findByCode(code);
    }
    LOG.warn(
        "Failed to atomically mark authorization code as used (already used or not found): {}",
        code);
    return null;
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
    long currentTime = java.time.Instant.now().getEpochSecond();
    dao.deleteExpired(currentTime);
    LOG.info("Deleted expired authorization codes");
  }
}
