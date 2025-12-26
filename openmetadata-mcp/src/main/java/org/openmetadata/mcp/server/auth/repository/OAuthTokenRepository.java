package org.openmetadata.mcp.server.auth.repository;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.auth.AccessToken;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthAccessTokenRecord;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthRefreshTokenRecord;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.List;

/**
 * Repository for managing OAuth access and refresh tokens with database persistence,
 * hashing, and encryption.
 */
@Slf4j
public class OAuthTokenRepository {
  private final CollectionDAO.OAuthAccessTokenDAO accessTokenDAO;
  private final CollectionDAO.OAuthRefreshTokenDAO refreshTokenDAO;
  private final Fernet fernet;

  public OAuthTokenRepository() {
    CollectionDAO dao = Entity.getCollectionDAO();
    this.accessTokenDAO = dao.oauthAccessTokenDAO();
    this.refreshTokenDAO = dao.oauthRefreshTokenDAO();
    this.fernet = Fernet.getInstance();
  }

  /**
   * Store an access token.
   */
  public void storeAccessToken(
      AccessToken token,
      String clientId,
      String connectorName,
      String userName,
      List<String> scopes) {

    String tokenHash = hashToken(token.getToken());
    String encryptedToken = fernet.encrypt(token.getToken());

    accessTokenDAO.insert(
        tokenHash,
        encryptedToken,
        clientId,
        connectorName,
        userName,
        JsonUtils.pojoToJson(scopes),
        token.getExpiresAt()
    );

    LOG.debug("Stored access token in database for client: {}", clientId);
  }

  /**
   * Find access token by token value.
   */
  public AccessToken findAccessToken(String tokenValue) {
    String tokenHash = hashToken(tokenValue);
    OAuthAccessTokenRecord record = accessTokenDAO.findByTokenHash(tokenHash);

    if (record == null) {
      return null;
    }

    String decryptedToken = fernet.decrypt(record.accessTokenEncrypted());

    AccessToken token = new AccessToken();
    token.setToken(decryptedToken);
    token.setExpiresAt((int) record.expiresAt());
    token.setClientId(record.clientId());
    token.setScopes(record.scopes());

    return token;
  }

  /**
   * Get connector name for a given access token.
   */
  public String getConnectorNameForToken(String tokenValue) {
    String tokenHash = hashToken(tokenValue);
    OAuthAccessTokenRecord record = accessTokenDAO.findByTokenHash(tokenHash);
    return record != null ? record.connectorName() : null;
  }

  /**
   * Delete access token.
   */
  public void deleteAccessToken(String tokenValue) {
    String tokenHash = hashToken(tokenValue);
    accessTokenDAO.delete(tokenHash);
    LOG.debug("Deleted access token");
  }

  /**
   * Store a refresh token.
   */
  public void storeRefreshToken(
      RefreshToken token,
      String clientId,
      String connectorName,
      String userName,
      List<String> scopes) {

    String tokenHash = hashToken(token.getToken());
    String encryptedToken = fernet.encrypt(token.getToken());

    refreshTokenDAO.insert(
        tokenHash,
        encryptedToken,
        clientId,
        connectorName,
        userName,
        JsonUtils.pojoToJson(scopes),
        token.getExpiresAt()
    );

    LOG.debug("Stored refresh token in database for client: {}", clientId);
  }

  /**
   * Find refresh token by token value.
   */
  public RefreshToken findRefreshToken(String tokenValue) {
    String tokenHash = hashToken(tokenValue);
    OAuthRefreshTokenRecord record = refreshTokenDAO.findByTokenHash(tokenHash);

    if (record == null || record.revoked()) {
      return null;
    }

    String decryptedToken = fernet.decrypt(record.refreshTokenEncrypted());

    RefreshToken token = new RefreshToken();
    token.setToken(decryptedToken);
    token.setExpiresAt((int) record.expiresAt());
    token.setClientId(record.clientId());
    token.setScopes(record.scopes());

    return token;
  }

  /**
   * Get connector name for a given refresh token.
   */
  public String getConnectorNameForRefreshToken(String tokenValue) {
    String tokenHash = hashToken(tokenValue);
    OAuthRefreshTokenRecord record = refreshTokenDAO.findByTokenHash(tokenHash);
    return record != null ? record.connectorName() : null;
  }

  /**
   * Revoke a refresh token.
   */
  public void revokeRefreshToken(String tokenValue) {
    String tokenHash = hashToken(tokenValue);
    refreshTokenDAO.revoke(tokenHash);
    LOG.debug("Revoked refresh token");
  }

  /**
   * Delete a refresh token.
   */
  public void deleteRefreshToken(String tokenValue) {
    String tokenHash = hashToken(tokenValue);
    refreshTokenDAO.delete(tokenHash);
    LOG.debug("Deleted refresh token");
  }

  /**
   * Delete all expired tokens.
   */
  public void deleteExpiredTokens() {
    long currentTime = System.currentTimeMillis();
    accessTokenDAO.deleteExpired(currentTime);
    refreshTokenDAO.deleteExpired(currentTime);
    LOG.info("Deleted expired access and refresh tokens");
  }

  /**
   * Hash token using SHA-256 for secure lookups.
   */
  private String hashToken(String token) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new RuntimeException("SHA-256 algorithm not available", e);
    }
  }
}
