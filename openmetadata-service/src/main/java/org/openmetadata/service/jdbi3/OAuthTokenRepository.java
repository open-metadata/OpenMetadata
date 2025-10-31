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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.OAuthToken;
import org.openmetadata.schema.entity.OAuthToken.TokenStatus;

@Slf4j
public class OAuthTokenRepository {

  @CreateSqlObject
  public abstract OAuthTokenDAO oAuthTokenDAO();

  @RegisterRowMapper(OAuthTokenMapper.class)
  public interface OAuthTokenDAO {

    @SqlUpdate(
        "INSERT INTO oauth_token_entity (id, userId, credentialsId, accessToken, refreshToken, "
            + "tokenType, expiresAt, scopes, status, lastRefreshedAt, refreshFailureCount, "
            + "refreshFailureReason, createdAt, updatedAt, version, deleted) "
            + "VALUES (:id, :userId, :credentialsId, :accessToken, :refreshToken, :tokenType, "
            + ":expiresAt, :scopes, :status, :lastRefreshedAt, :refreshFailureCount, "
            + ":refreshFailureReason, :createdAt, :updatedAt, :version, :deleted)")
    void insert(
        @Bind("id") String id,
        @Bind("userId") String userId,
        @Bind("credentialsId") String credentialsId,
        @Bind("accessToken") String accessToken,
        @Bind("refreshToken") String refreshToken,
        @Bind("tokenType") String tokenType,
        @Bind("expiresAt") Long expiresAt,
        @Bind("scopes") String scopes,
        @Bind("status") String status,
        @Bind("lastRefreshedAt") Long lastRefreshedAt,
        @Bind("refreshFailureCount") Integer refreshFailureCount,
        @Bind("refreshFailureReason") String refreshFailureReason,
        @Bind("createdAt") Long createdAt,
        @Bind("updatedAt") Long updatedAt,
        @Bind("version") Double version,
        @Bind("deleted") Boolean deleted);

    @SqlUpdate(
        "UPDATE oauth_token_entity SET accessToken = :accessToken, refreshToken = :refreshToken, "
            + "expiresAt = :expiresAt, status = :status, lastRefreshedAt = :lastRefreshedAt, "
            + "refreshFailureCount = :refreshFailureCount, refreshFailureReason = :refreshFailureReason, "
            + "updatedAt = :updatedAt, version = :version WHERE id = :id")
    void update(
        @Bind("id") String id,
        @Bind("accessToken") String accessToken,
        @Bind("refreshToken") String refreshToken,
        @Bind("expiresAt") Long expiresAt,
        @Bind("status") String status,
        @Bind("lastRefreshedAt") Long lastRefreshedAt,
        @Bind("refreshFailureCount") Integer refreshFailureCount,
        @Bind("refreshFailureReason") String refreshFailureReason,
        @Bind("updatedAt") Long updatedAt,
        @Bind("version") Double version);

    @SqlQuery(
        "SELECT * FROM oauth_token_entity WHERE userId = :userId AND credentialsId = :credentialsId AND deleted = false")
    Optional<OAuthToken> findByUserAndCredentials(
        @Bind("userId") String userId, @Bind("credentialsId") String credentialsId);

    @SqlQuery("SELECT * FROM oauth_token_entity WHERE id = :id AND deleted = false")
    Optional<OAuthToken> findById(@Bind("id") String id);

    @SqlQuery("SELECT * FROM oauth_token_entity WHERE userId = :userId AND deleted = false")
    List<OAuthToken> findByUserId(@Bind("userId") String userId);

    @SqlQuery(
        "SELECT * FROM oauth_token_entity WHERE credentialsId = :credentialsId AND deleted = false")
    List<OAuthToken> findByCredentialsId(@Bind("credentialsId") String credentialsId);

    @SqlQuery(
        "SELECT * FROM oauth_token_entity WHERE expiresAt < :timestamp AND status = 'Active' AND deleted = false")
    List<OAuthToken> findExpiredTokens(@Bind("timestamp") Long timestamp);

    @SqlUpdate(
        "UPDATE oauth_token_entity SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    void updateStatus(
        @Bind("id") String id, @Bind("status") String status, @Bind("updatedAt") Long updatedAt);

    @SqlUpdate(
        "UPDATE oauth_token_entity SET deleted = true, updatedAt = :updatedAt WHERE id = :id")
    void softDelete(@Bind("id") String id, @Bind("updatedAt") Long updatedAt);

    @SqlUpdate(
        "UPDATE oauth_token_entity SET deleted = true, updatedAt = :updatedAt WHERE credentialsId = :credentialsId")
    void softDeleteByCredentialsId(
        @Bind("credentialsId") String credentialsId, @Bind("updatedAt") Long updatedAt);
  }

  public static class OAuthTokenMapper implements RowMapper<OAuthToken> {
    @Override
    public OAuthToken map(java.sql.ResultSet rs, StatementContext ctx)
        throws java.sql.SQLException {
      OAuthToken token = new OAuthToken();
      token.setId(UUID.fromString(rs.getString("id")));
      token.setUserId(UUID.fromString(rs.getString("userId")));
      token.setCredentialsId(UUID.fromString(rs.getString("credentialsId")));
      token.setAccessToken(rs.getString("accessToken"));
      token.setRefreshToken(rs.getString("refreshToken"));
      token.setTokenType(rs.getString("tokenType"));

      Long expiresAt = rs.getLong("expiresAt");
      if (!rs.wasNull()) {
        token.setExpiresAt(expiresAt);
      }

      String scopesJson = rs.getString("scopes");
      if (scopesJson != null) {
        token.setScopes(JsonUtils.readObjects(scopesJson, String.class));
      }

      token.setStatus(TokenStatus.fromValue(rs.getString("status")));

      Long lastRefreshedAt = rs.getLong("lastRefreshedAt");
      if (!rs.wasNull()) {
        token.setLastRefreshedAt(lastRefreshedAt);
      }

      token.setRefreshFailureCount(rs.getInt("refreshFailureCount"));
      token.setRefreshFailureReason(rs.getString("refreshFailureReason"));
      token.setCreatedAt(rs.getLong("createdAt"));
      token.setUpdatedAt(rs.getLong("updatedAt"));
      token.setVersion(rs.getDouble("version"));
      token.setDeleted(rs.getBoolean("deleted"));

      return token;
    }
  }

  @Transaction
  public OAuthToken createOrUpdate(OAuthToken token) {
    long now = Instant.now().toEpochMilli();

    if (token.getId() == null) {
      token.setId(UUID.randomUUID());
      token.setCreatedAt(now);
      token.setVersion(1.0);
    }

    token.setUpdatedAt(now);
    if (token.getStatus() == null) {
      token.setStatus(TokenStatus.Active);
    }

    Optional<OAuthToken> existing =
        findByUserAndCredentials(token.getUserId(), token.getCredentialsId());

    if (existing.isPresent()) {
      // Update existing token
      token.setId(existing.get().getId());
      token.setCreatedAt(existing.get().getCreatedAt());
      token.setVersion(existing.get().getVersion() + 0.1);
      update(token);
    } else {
      // Create new token
      insert(token);
    }

    return token;
  }

  public Optional<OAuthToken> findByUserAndCredentials(UUID userId, UUID credentialsId) {
    return oAuthTokenDAO().findByUserAndCredentials(userId.toString(), credentialsId.toString());
  }

  public Optional<OAuthToken> findById(UUID tokenId) {
    return oAuthTokenDAO().findById(tokenId.toString());
  }

  public List<OAuthToken> findByUserId(UUID userId) {
    return listOrEmpty(oAuthTokenDAO().findByUserId(userId.toString()));
  }

  public List<OAuthToken> findByCredentialsId(UUID credentialsId) {
    return listOrEmpty(oAuthTokenDAO().findByCredentialsId(credentialsId.toString()));
  }

  public List<OAuthToken> findExpiredTokens() {
    long now = Instant.now().toEpochMilli();
    return listOrEmpty(oAuthTokenDAO().findExpiredTokens(now));
  }

  @Transaction
  public void revokeToken(UUID tokenId) {
    long now = Instant.now().toEpochMilli();
    oAuthTokenDAO().updateStatus(tokenId.toString(), TokenStatus.Revoked.value(), now);
    LOG.info("Revoked OAuth token: {}", tokenId);
  }

  @Transaction
  public void markTokenExpired(UUID tokenId) {
    long now = Instant.now().toEpochMilli();
    oAuthTokenDAO().updateStatus(tokenId.toString(), TokenStatus.Expired.value(), now);
    LOG.info("Marked OAuth token as expired: {}", tokenId);
  }

  @Transaction
  public void markRefreshFailed(UUID tokenId, String reason) {
    Optional<OAuthToken> tokenOpt = findById(tokenId);
    if (tokenOpt.isPresent()) {
      OAuthToken token = tokenOpt.get();
      token.setRefreshFailureCount(
          (token.getRefreshFailureCount() != null ? token.getRefreshFailureCount() : 0) + 1);
      token.setRefreshFailureReason(reason);
      token.setStatus(TokenStatus.Refresh_Failed);
      update(token);
      LOG.warn("OAuth token refresh failed for token {}: {}", tokenId, reason);
    }
  }

  @Transaction
  public void deleteByCredentialsId(UUID credentialsId) {
    long now = Instant.now().toEpochMilli();
    oAuthTokenDAO().softDeleteByCredentialsId(credentialsId.toString(), now);
    LOG.info("Deleted all OAuth tokens for credentials: {}", credentialsId);
  }

  private void insert(OAuthToken token) {
    oAuthTokenDAO()
        .insert(
            token.getId().toString(),
            token.getUserId().toString(),
            token.getCredentialsId().toString(),
            token.getAccessToken(),
            token.getRefreshToken(),
            token.getTokenType(),
            token.getExpiresAt(),
            token.getScopes() != null ? JsonUtils.pojoToJson(token.getScopes()) : null,
            token.getStatus().value(),
            token.getLastRefreshedAt(),
            token.getRefreshFailureCount(),
            token.getRefreshFailureReason(),
            token.getCreatedAt(),
            token.getUpdatedAt(),
            token.getVersion(),
            token.getDeleted());
  }

  private void update(OAuthToken token) {
    oAuthTokenDAO()
        .update(
            token.getId().toString(),
            token.getAccessToken(),
            token.getRefreshToken(),
            token.getExpiresAt(),
            token.getStatus().value(),
            token.getLastRefreshedAt(),
            token.getRefreshFailureCount(),
            token.getRefreshFailureReason(),
            token.getUpdatedAt(),
            token.getVersion());
  }
}
