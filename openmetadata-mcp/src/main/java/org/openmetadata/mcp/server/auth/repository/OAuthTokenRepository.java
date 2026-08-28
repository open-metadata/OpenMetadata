package org.openmetadata.mcp.server.auth.repository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.auth.AccessToken;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthAccessTokenRecord;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthRefreshTokenRecord;

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
      AccessToken token, String clientId, String userName, List<String> scopes) {

    String tokenHash = hashToken(token.getToken());
    String encryptedToken = fernet.encrypt(token.getToken());

    accessTokenDAO.insert(
        tokenHash,
        encryptedToken,
        clientId,
        userName,
        JsonUtils.pojoToJson(scopes),
        token.getExpiresAt());

    LOG.debug("Stored access token in database for client: {}", clientId);
  }

  /**
   * Find access token by token value. Returns null if not found or decryption fails.
   */
  public AccessToken findAccessToken(String tokenValue) {
    String tokenHash = hashToken(tokenValue);
    OAuthAccessTokenRecord record = accessTokenDAO.findByTokenHash(tokenHash);

    if (record == null) {
      return null;
    }

    try {
      String decryptedToken = fernet.decrypt(record.accessTokenEncrypted());

      AccessToken token = new AccessToken();
      token.setToken(decryptedToken);
      token.setExpiresAt(record.expiresAt());
      token.setClientId(record.clientId());
      token.setScopes(record.scopes());

      return token;
    } catch (Exception e) {
      LOG.error(
          "Failed to decrypt access token for client {}. This may indicate Fernet key rotation. "
              + "User must re-authenticate. Error: {}",
          record.clientId(),
          e.getMessage());
      return null;
    }
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
      RefreshToken token, String clientId, String userName, List<String> scopes) {

    String tokenHash = hashToken(token.getToken());
    String encryptedToken = fernet.encrypt(token.getToken());

    refreshTokenDAO.insert(
        tokenHash,
        encryptedToken,
        clientId,
        userName,
        JsonUtils.pojoToJson(scopes),
        token.getExpiresAt());

    LOG.debug("Stored refresh token in database for client: {}", clientId);
  }

  /**
   * Find refresh token by token value. Returns null if not found, revoked, or decryption fails.
   */
  public RefreshToken findRefreshToken(String tokenValue) {
    String tokenHash = hashToken(tokenValue);
    OAuthRefreshTokenRecord record = refreshTokenDAO.findByTokenHash(tokenHash);

    if (record == null || record.revoked()) {
      return null;
    }

    try {
      String decryptedToken = fernet.decrypt(record.refreshTokenEncrypted());

      RefreshToken token = new RefreshToken();
      token.setToken(decryptedToken);
      token.setExpiresAt(record.expiresAt());
      token.setClientId(record.clientId());
      token.setUserName(record.userName());
      token.setScopes(record.scopes());

      return token;
    } catch (Exception e) {
      LOG.error(
          "Failed to decrypt refresh token for user {} (client: {}). This may indicate Fernet key rotation. "
              + "User must re-authenticate. Error: {}",
          record.userName(),
          record.clientId(),
          e.getMessage());
      return null;
    }
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
   * Rotate a refresh token using atomic CAS: atomically revoke the old token (UPDATE ... WHERE
   * revoked = FALSE), then revoke any remaining tokens for cleanup, then store the new one.
   * If the CAS fails (row count = 0), the old token was already revoked by a concurrent request.
   *
   * @param oldTokenValue The old refresh token value to atomically revoke
   * @param newToken The new refresh token to store
   * @throws TokenRotationException if the old token was already consumed (concurrent refresh)
   */
  public void rotateRefreshToken(
      String oldTokenValue,
      RefreshToken newToken,
      String clientId,
      String userName,
      List<String> scopes) {
    // Atomic CAS: only one concurrent request can successfully revoke this token
    String oldTokenHash = hashToken(oldTokenValue);
    int rowsAffected = refreshTokenDAO.revokeAtomic(oldTokenHash);

    if (rowsAffected == 0) {
      throw new TokenRotationException(
          "Refresh token already consumed — possible concurrent refresh or replay attack");
    }

    // Revoke any other lingering tokens for this user+client (belt-and-suspenders cleanup)
    refreshTokenDAO.revokeAllForUser(clientId, userName);

    // Store the new token
    String tokenHash = hashToken(newToken.getToken());
    String encryptedToken = fernet.encrypt(newToken.getToken());
    refreshTokenDAO.insert(
        tokenHash,
        encryptedToken,
        clientId,
        userName,
        JsonUtils.pojoToJson(scopes),
        newToken.getExpiresAt());

    LOG.debug("Rotated refresh token for user: {}, client: {}", userName, clientId);
  }

  public static class TokenRotationException extends RuntimeException {
    public TokenRotationException(String message) {
      super(message);
    }
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
   * Note: Token expiry times are stored in milliseconds (System.currentTimeMillis())
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
