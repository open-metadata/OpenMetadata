/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords;

public interface OAuthDAOs {
  @CreateSqlObject
  OAuthClientDAO oauthClientDAO();

  @CreateSqlObject
  OAuthAuthorizationCodeDAO oauthAuthorizationCodeDAO();

  @CreateSqlObject
  OAuthAccessTokenDAO oauthAccessTokenDAO();

  @CreateSqlObject
  OAuthRefreshTokenDAO oauthRefreshTokenDAO();

  @CreateSqlObject
  McpPendingAuthRequestDAO mcpPendingAuthRequestDAO();

  interface OAuthClientDAO {
    @SqlQuery(
        "SELECT id, client_id, client_secret_encrypted, client_name, redirect_uris, grant_types, token_endpoint_auth_method, scopes FROM oauth_clients WHERE client_id = :clientId")
    @RegisterRowMapper(SystemTokenDAOs.OAuthClientRowMapper.class)
    OAuthRecords.OAuthClientRecord findByClientId(@Bind("clientId") String clientId);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO oauth_clients (client_id, client_secret_encrypted, client_name, redirect_uris, grant_types, token_endpoint_auth_method, scopes) VALUES (:clientId, :clientSecret, :clientName, :redirectUris ::jsonb, :grantTypes ::jsonb, :authMethod, :scopes ::jsonb)",
        connectionType = POSTGRES)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO oauth_clients (client_id, client_secret_encrypted, client_name, redirect_uris, grant_types, token_endpoint_auth_method, scopes) VALUES (:clientId, :clientSecret, :clientName, :redirectUris, :grantTypes, :authMethod, :scopes)",
        connectionType = MYSQL)
    void insert(
        @Bind("clientId") String clientId,
        @Bind("clientSecret") String clientSecret,
        @Bind("clientName") String clientName,
        @Bind("redirectUris") String redirectUris,
        @Bind("grantTypes") String grantTypes,
        @Bind("authMethod") String authMethod,
        @Bind("scopes") String scopes);

    @SqlUpdate("DELETE FROM oauth_clients WHERE client_id = :clientId")
    void delete(@Bind("clientId") String clientId);
  }

  interface OAuthAuthorizationCodeDAO {
    @SqlQuery(
        "SELECT code, client_id, user_name, code_challenge, code_challenge_method, redirect_uri, scopes, expires_at, used FROM oauth_authorization_codes WHERE code = :code")
    @RegisterRowMapper(SystemTokenDAOs.OAuthAuthorizationCodeRowMapper.class)
    OAuthRecords.OAuthAuthorizationCodeRecord findByCode(@Bind("code") String code);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO oauth_authorization_codes (code, client_id, user_name, code_challenge, code_challenge_method, redirect_uri, scopes, expires_at) VALUES (:code, :clientId, :userName, :codeChallenge, :codeChallengeMethod, :redirectUri, :scopes ::jsonb, :expiresAt)",
        connectionType = POSTGRES)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO oauth_authorization_codes (code, client_id, user_name, code_challenge, code_challenge_method, redirect_uri, scopes, expires_at) VALUES (:code, :clientId, :userName, :codeChallenge, :codeChallengeMethod, :redirectUri, :scopes, :expiresAt)",
        connectionType = MYSQL)
    void insert(
        @Bind("code") String code,
        @Bind("clientId") String clientId,
        @Bind("userName") String userName,
        @Bind("codeChallenge") String codeChallenge,
        @Bind("codeChallengeMethod") String codeChallengeMethod,
        @Bind("redirectUri") String redirectUri,
        @Bind("scopes") String scopes,
        @Bind("expiresAt") long expiresAt);

    @SqlUpdate(
        "UPDATE oauth_authorization_codes SET used = TRUE WHERE code = :code AND used = FALSE")
    int markAsUsedAtomic(@Bind("code") String code);

    @SqlUpdate("DELETE FROM oauth_authorization_codes WHERE code = :code")
    void delete(@Bind("code") String code);

    @SqlUpdate("DELETE FROM oauth_authorization_codes WHERE expires_at < :currentTime")
    void deleteExpired(@Bind("currentTime") long currentTime);
  }

  interface OAuthAccessTokenDAO {
    @SqlQuery(
        "SELECT id, token_hash, access_token_encrypted, client_id, user_name, scopes, expires_at FROM oauth_access_tokens WHERE token_hash = :tokenHash")
    @RegisterRowMapper(SystemTokenDAOs.OAuthAccessTokenRowMapper.class)
    OAuthRecords.OAuthAccessTokenRecord findByTokenHash(@Bind("tokenHash") String tokenHash);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO oauth_access_tokens (token_hash, access_token_encrypted, client_id, user_name, scopes, expires_at) VALUES (:tokenHash, :accessTokenEncrypted, :clientId, :userName, :scopes ::jsonb, :expiresAt)",
        connectionType = POSTGRES)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO oauth_access_tokens (token_hash, access_token_encrypted, client_id, user_name, scopes, expires_at) VALUES (:tokenHash, :accessTokenEncrypted, :clientId, :userName, :scopes, :expiresAt)",
        connectionType = MYSQL)
    void insert(
        @Bind("tokenHash") String tokenHash,
        @Bind("accessTokenEncrypted") String accessTokenEncrypted,
        @Bind("clientId") String clientId,
        @Bind("userName") String userName,
        @Bind("scopes") String scopes,
        @Bind("expiresAt") long expiresAt);

    @SqlUpdate("DELETE FROM oauth_access_tokens WHERE token_hash = :tokenHash")
    void delete(@Bind("tokenHash") String tokenHash);

    @SqlUpdate("DELETE FROM oauth_access_tokens WHERE expires_at < :currentTime")
    void deleteExpired(@Bind("currentTime") long currentTime);
  }

  interface OAuthRefreshTokenDAO {
    @SqlQuery(
        "SELECT id, token_hash, refresh_token_encrypted, client_id, user_name, scopes, expires_at, revoked FROM oauth_refresh_tokens WHERE token_hash = :tokenHash")
    @RegisterRowMapper(SystemTokenDAOs.OAuthRefreshTokenRowMapper.class)
    OAuthRecords.OAuthRefreshTokenRecord findByTokenHash(@Bind("tokenHash") String tokenHash);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO oauth_refresh_tokens (token_hash, refresh_token_encrypted, client_id, user_name, scopes, expires_at) VALUES (:tokenHash, :refreshTokenEncrypted, :clientId, :userName, :scopes ::jsonb, :expiresAt)",
        connectionType = POSTGRES)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO oauth_refresh_tokens (token_hash, refresh_token_encrypted, client_id, user_name, scopes, expires_at) VALUES (:tokenHash, :refreshTokenEncrypted, :clientId, :userName, :scopes, :expiresAt)",
        connectionType = MYSQL)
    void insert(
        @Bind("tokenHash") String tokenHash,
        @Bind("refreshTokenEncrypted") String refreshTokenEncrypted,
        @Bind("clientId") String clientId,
        @Bind("userName") String userName,
        @Bind("scopes") String scopes,
        @Bind("expiresAt") long expiresAt);

    @SqlUpdate("UPDATE oauth_refresh_tokens SET revoked = TRUE WHERE token_hash = :tokenHash")
    void revoke(@Bind("tokenHash") String tokenHash);

    @SqlUpdate(
        "UPDATE oauth_refresh_tokens SET revoked = TRUE WHERE token_hash = :tokenHash AND revoked = FALSE")
    int revokeAtomic(@Bind("tokenHash") String tokenHash);

    @SqlUpdate("DELETE FROM oauth_refresh_tokens WHERE token_hash = :tokenHash")
    void delete(@Bind("tokenHash") String tokenHash);

    @SqlUpdate("DELETE FROM oauth_refresh_tokens WHERE expires_at < :currentTime")
    void deleteExpired(@Bind("currentTime") long currentTime);

    @SqlUpdate(
        "UPDATE oauth_refresh_tokens SET revoked = TRUE WHERE client_id = :clientId AND user_name = :userName AND revoked = FALSE")
    void revokeAllForUser(@Bind("clientId") String clientId, @Bind("userName") String userName);
  }

  interface McpPendingAuthRequestDAO {
    @SqlQuery(
        "SELECT auth_request_id, client_id, code_challenge, code_challenge_method, redirect_uri, mcp_state, scopes, pac4j_state, pac4j_nonce, pac4j_code_verifier, expires_at FROM mcp_pending_auth_requests WHERE auth_request_id = :authRequestId")
    @RegisterRowMapper(McpPendingAuthRequestRowMapper.class)
    OAuthRecords.McpPendingAuthRequest findByAuthRequestId(
        @Bind("authRequestId") String authRequestId);

    @SqlQuery(
        "SELECT auth_request_id, client_id, code_challenge, code_challenge_method, redirect_uri, mcp_state, scopes, pac4j_state, pac4j_nonce, pac4j_code_verifier, expires_at FROM mcp_pending_auth_requests WHERE pac4j_state = :pac4jState")
    @RegisterRowMapper(McpPendingAuthRequestRowMapper.class)
    OAuthRecords.McpPendingAuthRequest findByPac4jState(@Bind("pac4jState") String pac4jState);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO mcp_pending_auth_requests (auth_request_id, client_id, code_challenge, code_challenge_method, redirect_uri, mcp_state, scopes, pac4j_state, pac4j_nonce, pac4j_code_verifier, expires_at) VALUES (:authRequestId, :clientId, :codeChallenge, :codeChallengeMethod, :redirectUri, :mcpState, :scopes ::jsonb, :pac4jState, :pac4jNonce, :pac4jCodeVerifier, :expiresAt)",
        connectionType = POSTGRES)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO mcp_pending_auth_requests (auth_request_id, client_id, code_challenge, code_challenge_method, redirect_uri, mcp_state, scopes, pac4j_state, pac4j_nonce, pac4j_code_verifier, expires_at) VALUES (:authRequestId, :clientId, :codeChallenge, :codeChallengeMethod, :redirectUri, :mcpState, :scopes, :pac4jState, :pac4jNonce, :pac4jCodeVerifier, :expiresAt)",
        connectionType = MYSQL)
    void insert(
        @Bind("authRequestId") String authRequestId,
        @Bind("clientId") String clientId,
        @Bind("codeChallenge") String codeChallenge,
        @Bind("codeChallengeMethod") String codeChallengeMethod,
        @Bind("redirectUri") String redirectUri,
        @Bind("mcpState") String mcpState,
        @Bind("scopes") String scopes,
        @Bind("pac4jState") String pac4jState,
        @Bind("pac4jNonce") String pac4jNonce,
        @Bind("pac4jCodeVerifier") String pac4jCodeVerifier,
        @Bind("expiresAt") long expiresAt);

    @SqlUpdate(
        "UPDATE mcp_pending_auth_requests SET pac4j_state = :pac4jState, pac4j_nonce = :pac4jNonce, pac4j_code_verifier = :pac4jCodeVerifier WHERE auth_request_id = :authRequestId")
    void updatePac4jSession(
        @Bind("authRequestId") String authRequestId,
        @Bind("pac4jState") String pac4jState,
        @Bind("pac4jNonce") String pac4jNonce,
        @Bind("pac4jCodeVerifier") String pac4jCodeVerifier);

    @SqlUpdate("DELETE FROM mcp_pending_auth_requests WHERE auth_request_id = :authRequestId")
    void delete(@Bind("authRequestId") String authRequestId);

    @SqlUpdate("DELETE FROM mcp_pending_auth_requests WHERE expires_at < :currentTime")
    void deleteExpired(@Bind("currentTime") long currentTime);
  }

  class McpPendingAuthRequestRowMapper implements RowMapper<OAuthRecords.McpPendingAuthRequest> {
    @Override
    public OAuthRecords.McpPendingAuthRequest map(ResultSet rs, StatementContext ctx)
        throws SQLException {
      String scopesJson = rs.getString("scopes");
      List<String> scopes =
          scopesJson != null
              ? org.openmetadata.schema.utils.JsonUtils.readValue(
                  scopesJson, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {})
              : List.of();
      return new OAuthRecords.McpPendingAuthRequest(
          rs.getString("auth_request_id"),
          rs.getString("client_id"),
          rs.getString("code_challenge"),
          rs.getString("code_challenge_method"),
          rs.getString("redirect_uri"),
          rs.getString("mcp_state"),
          scopes,
          rs.getString("pac4j_state"),
          rs.getString("pac4j_nonce"),
          rs.getString("pac4j_code_verifier"),
          rs.getLong("expires_at"));
    }
  }
}
