package org.openmetadata.service.jdbi3.oauth;

import java.util.List;
import java.util.UUID;

/** Database record classes for OAuth 2.0 persistence */
public class OAuthRecords {

  public record OAuthClientRecord(
      UUID id,
      String clientId,
      String clientSecretEncrypted,
      String clientName,
      List<String> redirectUris,
      List<String> grantTypes,
      String tokenEndpointAuthMethod,
      List<String> scopes) {}

  public record OAuthAuthorizationCodeRecord(
      String code,
      String clientId,
      String connectorName,
      String codeChallenge,
      String codeChallengeMethod,
      String redirectUri,
      List<String> scopes,
      long expiresAt,
      boolean used) {}

  public record OAuthAccessTokenRecord(
      UUID id,
      String tokenHash,
      String accessTokenEncrypted,
      String clientId,
      String connectorName,
      String userName,
      List<String> scopes,
      long expiresAt) {}

  public record OAuthRefreshTokenRecord(
      UUID id,
      String tokenHash,
      String refreshTokenEncrypted,
      String clientId,
      String connectorName,
      String userName,
      List<String> scopes,
      long expiresAt,
      boolean revoked) {}
}
