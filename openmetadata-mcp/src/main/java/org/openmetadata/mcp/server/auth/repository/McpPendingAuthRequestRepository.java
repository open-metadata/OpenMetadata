package org.openmetadata.mcp.server.auth.repository;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;

/**
 * Repository for managing pending MCP OAuth authorization requests. These records store PKCE
 * parameters and OAuth state across SSO redirects (survives cross-domain cookie loss).
 */
@Slf4j
public class McpPendingAuthRequestRepository {
  private static final int AUTH_REQUEST_TTL_SECONDS = 600; // 10 minutes
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  private final CollectionDAO.McpPendingAuthRequestDAO dao;

  public McpPendingAuthRequestRepository() {
    this.dao = Entity.getCollectionDAO().mcpPendingAuthRequestDAO();
  }

  public String createPendingRequest(
      String clientId,
      String codeChallenge,
      String codeChallengeMethod,
      String redirectUri,
      String mcpState,
      List<String> scopes,
      String pac4jState,
      String pac4jNonce,
      String pac4jCodeVerifier) {

    String authRequestId = generateAuthRequestId();
    long expiresAt = System.currentTimeMillis() + (AUTH_REQUEST_TTL_SECONDS * 1000L);

    dao.insert(
        authRequestId,
        clientId,
        codeChallenge,
        codeChallengeMethod,
        redirectUri,
        mcpState,
        JsonUtils.pojoToJson(scopes),
        pac4jState,
        pac4jNonce,
        pac4jCodeVerifier,
        expiresAt);

    LOG.debug("Created pending auth request: {} for client: {}", authRequestId, clientId);
    return authRequestId;
  }

  public McpPendingAuthRequest findByAuthRequestId(String authRequestId) {
    McpPendingAuthRequest request = dao.findByAuthRequestId(authRequestId);
    if (request != null && System.currentTimeMillis() > request.expiresAt()) {
      LOG.warn("Pending auth request expired: {}", authRequestId);
      dao.delete(authRequestId);
      return null;
    }
    return request;
  }

  public McpPendingAuthRequest findByPac4jState(String pac4jState) {
    McpPendingAuthRequest request = dao.findByPac4jState(pac4jState);
    if (request != null && System.currentTimeMillis() > request.expiresAt()) {
      LOG.warn("Pending auth request expired for pac4j state: {}", pac4jState);
      dao.delete(request.authRequestId());
      return null;
    }
    return request;
  }

  public void updatePac4jSession(
      String authRequestId, String pac4jState, String pac4jNonce, String pac4jCodeVerifier) {
    dao.updatePac4jSession(authRequestId, pac4jState, pac4jNonce, pac4jCodeVerifier);
    LOG.debug("Updated pac4j session data for pending request: {}", authRequestId);
  }

  public void delete(String authRequestId) {
    dao.delete(authRequestId);
    LOG.debug("Deleted pending auth request: {}", authRequestId);
  }

  public void deleteExpired() {
    long currentTime = System.currentTimeMillis();
    dao.deleteExpired(currentTime);
    LOG.info("Deleted expired pending auth requests");
  }

  private String generateAuthRequestId() {
    byte[] bytes = new byte[24];
    SECURE_RANDOM.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
