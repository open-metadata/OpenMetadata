package org.openmetadata.mcp.server.auth.repository;

import at.favre.lib.crypto.bcrypt.BCrypt;
import java.net.URI;
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthClientRecord;

/**
 * Repository for managing OAuth client registrations with database persistence and BCrypt secret
 * hashing.
 */
@Slf4j
public class OAuthClientRepository {
  private static final int BCRYPT_COST = 12;
  private final CollectionDAO.OAuthClientDAO dao;

  public OAuthClientRepository() {
    this.dao = Entity.getCollectionDAO().oauthClientDAO();
  }

  /**
   * Register a new OAuth client.
   */
  public void register(OAuthClientInformation clientInfo) {
    String clientSecret = clientInfo.getClientSecret();
    String hashedSecret =
        clientSecret != null
            ? BCrypt.withDefaults().hashToString(BCRYPT_COST, clientSecret.toCharArray())
            : null;

    // Convert scope from String to List<String> for database storage
    String scope = clientInfo.getScope();
    List<String> scopeList =
        scope != null && !scope.isEmpty() ? List.of(scope.split(" ")) : List.of();

    dao.insert(
        clientInfo.getClientId(),
        hashedSecret,
        clientInfo.getClientName(),
        JsonUtils.pojoToJson(
            clientInfo.getRedirectUris().stream().map(URI::toString).collect(Collectors.toList())),
        JsonUtils.pojoToJson(clientInfo.getGrantTypes()),
        clientInfo.getTokenEndpointAuthMethod(),
        JsonUtils.pojoToJson(scopeList));

    LOG.info("Registered OAuth client in database: {}", clientInfo.getClientId());
  }

  /**
   * Get OAuth client by client ID. The clientSecret field is set to the BCrypt hash
   * (not the original secret) for verification by ClientAuthenticator.
   */
  public OAuthClientInformation findByClientId(String clientId) {
    OAuthClientRecord record = dao.findByClientId(clientId);
    if (record == null) {
      return null;
    }

    OAuthClientInformation clientInfo = new OAuthClientInformation();
    clientInfo.setClientId(record.clientId());
    clientInfo.setClientSecret(record.clientSecretEncrypted());
    clientInfo.setClientName(record.clientName());
    clientInfo.setRedirectUris(
        record.redirectUris().stream().map(URI::create).collect(Collectors.toList()));
    clientInfo.setGrantTypes(record.grantTypes());
    clientInfo.setTokenEndpointAuthMethod(record.tokenEndpointAuthMethod());
    clientInfo.setScope(String.join(" ", record.scopes()));

    return clientInfo;
  }

  /**
   * Delete OAuth client.
   */
  public void delete(String clientId) {
    dao.delete(clientId);
    LOG.info("Deleted OAuth client from database: {}", clientId);
  }
}
