package org.openmetadata.mcp.server.auth.repository;

import java.net.URI;
import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.auth.OAuthClientMetadata;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthClientRecord;

/**
 * Repository for managing OAuth client registrations with database persistence and secret encryption.
 */
@Slf4j
public class OAuthClientRepository {
  private final CollectionDAO.OAuthClientDAO dao;
  private final Fernet fernet;

  public OAuthClientRepository() {
    this.dao = Entity.getCollectionDAO().oauthClientDAO();
    this.fernet = Fernet.getInstance();
  }

  /**
   * Register a new OAuth client.
   */
  public void register(OAuthClientInformation clientInfo) {
    String clientSecret = clientInfo.getClientSecret();
    String encryptedSecret = clientSecret != null ? fernet.encrypt(clientSecret) : null;

    // Convert scope from String to List<String> for database storage
    String scope = clientInfo.getScope();
    List<String> scopeList =
        scope != null && !scope.isEmpty() ? List.of(scope.split(" ")) : List.of();

    dao.insert(
        clientInfo.getClientId(),
        encryptedSecret,
        clientInfo.getClientName(),
        JsonUtils.pojoToJson(
            clientInfo.getRedirectUris().stream().map(URI::toString).collect(Collectors.toList())),
        JsonUtils.pojoToJson(clientInfo.getGrantTypes()),
        clientInfo.getTokenEndpointAuthMethod(),
        JsonUtils.pojoToJson(scopeList));

    LOG.info("Registered OAuth client in database: {}", clientInfo.getClientId());
  }

  /**
   * Get OAuth client by client ID.
   */
  public OAuthClientInformation findByClientId(String clientId) {
    OAuthClientRecord record = dao.findByClientId(clientId);
    if (record == null) {
      return null;
    }

    OAuthClientMetadata metadata = new OAuthClientMetadata();
    metadata.setClientName(record.clientName());
    metadata.setRedirectUris(
        record.redirectUris().stream().map(URI::create).collect(Collectors.toList()));
    metadata.setGrantTypes(record.grantTypes());
    metadata.setTokenEndpointAuthMethod(record.tokenEndpointAuthMethod());
    // Convert scope from List<String> to space-separated String
    metadata.setScope(String.join(" ", record.scopes()));

    String decryptedSecret =
        record.clientSecretEncrypted() != null
            ? fernet.decrypt(record.clientSecretEncrypted())
            : null;

    OAuthClientInformation clientInfo = new OAuthClientInformation();
    clientInfo.setClientId(record.clientId());
    clientInfo.setClientSecret(decryptedSecret);
    clientInfo.setClientName(metadata.getClientName());
    clientInfo.setRedirectUris(metadata.getRedirectUris());
    clientInfo.setGrantTypes(metadata.getGrantTypes());
    clientInfo.setTokenEndpointAuthMethod(metadata.getTokenEndpointAuthMethod());
    clientInfo.setScope(metadata.getScope());

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
