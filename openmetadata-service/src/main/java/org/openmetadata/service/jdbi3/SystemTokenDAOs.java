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
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.StatementException;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.configuration.profiler.ProfilerConfiguration;
import org.openmetadata.schema.api.lineage.LineageSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.auth.EmailVerificationToken;
import org.openmetadata.schema.auth.PasswordResetToken;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.auth.collate.SupportToken;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.OpenLineageSettings;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.security.scim.ScimConfiguration;
import org.openmetadata.schema.service.configuration.teamsApp.TeamsAppConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords;
import org.openmetadata.service.security.session.UserSession;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface SystemTokenDAOs {
  @CreateSqlObject
  SystemDAO systemDAO();

  @CreateSqlObject
  TokenDAO getTokenDAO();

  @CreateSqlObject
  UserSessionDAO getUserSessionDAO();

  interface SystemDAO {
    @ConnectionAwareSqlQuery(
        value =
            "SELECT (SELECT COUNT(fqnHash) FROM table_entity <cond>) as tableCount, "
                + "(SELECT COUNT(fqnHash) FROM topic_entity <cond>) as topicCount, "
                + "(SELECT COUNT(fqnHash) FROM dashboard_entity <cond>) as dashboardCount, "
                + "(SELECT COUNT(fqnHash) FROM pipeline_entity <cond>) as pipelineCount, "
                + "(SELECT COUNT(fqnHash) FROM ml_model_entity <cond>) as mlmodelCount, "
                + "(SELECT COUNT(fqnHash) FROM storage_container_entity <cond>) as storageContainerCount, "
                + "(SELECT COUNT(fqnHash) FROM search_index_entity <cond>) as searchIndexCount, "
                + "(SELECT COUNT(nameHash) FROM glossary_entity <cond>) as glossaryCount, "
                + "(SELECT COUNT(fqnHash) FROM glossary_term_entity <cond>) as glossaryTermCount, "
                + "(SELECT (SELECT COUNT(nameHash) FROM metadata_service_entity <cond>) + "
                + "(SELECT COUNT(nameHash) FROM dbservice_entity <cond>)+"
                + "(SELECT COUNT(nameHash) FROM messaging_service_entity <cond>)+ "
                + "(SELECT COUNT(nameHash) FROM dashboard_service_entity <cond>)+ "
                + "(SELECT COUNT(nameHash) FROM pipeline_service_entity <cond>)+ "
                + "(SELECT COUNT(nameHash) FROM mlmodel_service_entity <cond>)+ "
                + "(SELECT COUNT(nameHash) FROM search_service_entity <cond>)+ "
                + "(SELECT COUNT(nameHash) FROM storage_service_entity <cond>)) as servicesCount, "
                + "(SELECT COUNT(nameHash) FROM user_entity <cond> AND (JSON_EXTRACT(json, '$.isBot') IS NULL OR JSON_EXTRACT(json, '$.isBot') = FALSE)) as userCount, "
                + "(SELECT COUNT(nameHash) FROM team_entity <cond>) as teamCount, "
                + "(SELECT COUNT(fqnHash) FROM test_suite <cond>) as testSuiteCount",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT (SELECT COUNT(*) FROM table_entity <cond>) as tableCount, "
                + "(SELECT COUNT(*) FROM topic_entity <cond>) as topicCount, "
                + "(SELECT COUNT(*) FROM dashboard_entity <cond>) as dashboardCount, "
                + "(SELECT COUNT(*) FROM pipeline_entity <cond>) as pipelineCount, "
                + "(SELECT COUNT(*) FROM ml_model_entity <cond>) as mlmodelCount, "
                + "(SELECT COUNT(*) FROM storage_container_entity <cond>) as storageContainerCount, "
                + "(SELECT COUNT(*) FROM search_index_entity <cond>) as searchIndexCount, "
                + "(SELECT COUNT(*) FROM glossary_entity <cond>) as glossaryCount, "
                + "(SELECT COUNT(*) FROM glossary_term_entity <cond>) as glossaryTermCount, "
                + "(SELECT (SELECT COUNT(*) FROM metadata_service_entity <cond>) + "
                + "(SELECT COUNT(*) FROM dbservice_entity <cond>)+"
                + "(SELECT COUNT(*) FROM messaging_service_entity <cond>)+ "
                + "(SELECT COUNT(*) FROM dashboard_service_entity <cond>)+ "
                + "(SELECT COUNT(*) FROM pipeline_service_entity <cond>)+ "
                + "(SELECT COUNT(*) FROM mlmodel_service_entity <cond>)+ "
                + "(SELECT COUNT(*) FROM search_service_entity <cond>)+ "
                + "(SELECT COUNT(*) FROM storage_service_entity <cond>)) as servicesCount, "
                + "(SELECT COUNT(*) FROM user_entity <cond> AND (json#>'{isBot}' IS NULL OR ((json#>'{isBot}')::boolean) = FALSE)) as userCount, "
                + "(SELECT COUNT(*) FROM team_entity <cond>) as teamCount, "
                + "(SELECT COUNT(*) FROM test_suite <cond>) as testSuiteCount",
        connectionType = POSTGRES)
    @RegisterRowMapper(SharedRowMappers.EntitiesCountRowMapper.class)
    EntitiesCount getAggregatedEntitiesCount(@Define("cond") String cond) throws StatementException;

    @ConnectionAwareSqlQuery(
        value =
            "SELECT (SELECT COUNT(nameHash) FROM dbservice_entity <cond>) as databaseServiceCount, "
                + "(SELECT COUNT(nameHash) FROM messaging_service_entity <cond>) as messagingServiceCount, "
                + "(SELECT COUNT(nameHash) FROM dashboard_service_entity <cond>) as dashboardServiceCount, "
                + "(SELECT COUNT(nameHash) FROM pipeline_service_entity <cond>) as pipelineServiceCount, "
                + "(SELECT COUNT(nameHash) FROM mlmodel_service_entity <cond>) as mlModelServiceCount, "
                + "(SELECT COUNT(nameHash) FROM storage_service_entity <cond>) as storageServiceCount, "
                + "(SELECT COUNT(nameHash) FROM search_service_entity <cond>) as searchServiceCount",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT (SELECT COUNT(*) FROM dbservice_entity <cond>) as databaseServiceCount, "
                + "(SELECT COUNT(*) FROM messaging_service_entity <cond>) as messagingServiceCount, "
                + "(SELECT COUNT(*) FROM dashboard_service_entity <cond>) as dashboardServiceCount, "
                + "(SELECT COUNT(*) FROM pipeline_service_entity <cond>) as pipelineServiceCount, "
                + "(SELECT COUNT(*) FROM mlmodel_service_entity <cond>) as mlModelServiceCount, "
                + "(SELECT COUNT(*) FROM storage_service_entity <cond>) as storageServiceCount, "
                + "(SELECT COUNT(*) FROM search_service_entity <cond>) as searchServiceCount",
        connectionType = POSTGRES)
    @RegisterRowMapper(SharedRowMappers.ServicesCountRowMapper.class)
    ServicesCount getAggregatedServicesCount(@Define("cond") String cond) throws StatementException;

    @SqlQuery("SELECT configType,json FROM openmetadata_settings")
    @RegisterRowMapper(SettingsRowMapper.class)
    List<Settings> getAllConfig() throws StatementException;

    @SqlQuery("SELECT configType, json FROM openmetadata_settings WHERE configType = :configType")
    @RegisterRowMapper(SettingsRowMapper.class)
    Settings getConfigWithKey(@Bind("configType") String configType) throws StatementException;

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT into openmetadata_settings (configType, json)"
                + "VALUES (:configType, :json) ON DUPLICATE KEY UPDATE json = :json",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT into openmetadata_settings (configType, json)"
                + "VALUES (:configType, :json :: jsonb) ON CONFLICT (configType) DO UPDATE SET json = EXCLUDED.json",
        connectionType = POSTGRES)
    void insertSettings(@Bind("configType") String configType, @Bind("json") String json);

    @SqlUpdate(value = "DELETE from openmetadata_settings WHERE configType = :configType")
    void delete(@Bind("configType") String configType);

    @SqlQuery("SELECT 42")
    Integer testConnection() throws StatementException;

    @ConnectionAwareSqlQuery(
        value =
            "SELECT JSON_EXTRACT(json, '$.fullyQualifiedName') FROM <table> WHERE id NOT IN ( SELECT toId FROM entity_relationship WHERE fromEntity = :fromEntity AND toEntity = :toEntity)",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json ->> 'fullyQualifiedName' FROM <table> WHERE id NOT IN ( SELECT toId FROM entity_relationship WHERE fromEntity = :fromEntity AND toEntity = :toEntity)",
        connectionType = POSTGRES)
    List<String> getBrokenRelationFromParentToChild(
        @Define("table") String tableName,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity);

    @SqlUpdate(
        value =
            "DELETE FROM <table> WHERE id NOT IN (SELECT toId FROM entity_relationship WHERE fromEntity = :fromEntity AND toEntity = :toEntity)")
    int deleteBrokenRelationFromParentToChild(
        @Define("table") String tableName,
        @Bind("fromEntity") String fromEntity,
        @Bind("toEntity") String toEntity);
  }

  class SettingsRowMapper implements RowMapper<Settings> {
    @Override
    public Settings map(ResultSet rs, StatementContext ctx) throws SQLException {
      return getSettings(SettingsType.fromValue(rs.getString("configType")), rs.getString("json"));
    }

    public static Settings getSettings(SettingsType configType, String json) {
      Settings settings = new Settings();
      settings.setConfigType(configType);
      Object value =
          switch (configType) {
            case EMAIL_CONFIGURATION -> JsonUtils.readValue(json, SmtpSettings.class);
            case OPEN_METADATA_BASE_URL_CONFIGURATION -> JsonUtils.readValue(
                json, OpenMetadataBaseUrlConfiguration.class);
            case CUSTOM_UI_THEME_PREFERENCE -> JsonUtils.readValue(json, UiThemePreference.class);
            case LOGIN_CONFIGURATION -> JsonUtils.readValue(json, LoginConfiguration.class);
            case SLACK_APP_CONFIGURATION, SLACK_INSTALLER, SLACK_BOT, SLACK_STATE -> JsonUtils
                .readValue(json, String.class);
            case PROFILER_CONFIGURATION -> JsonUtils.readValue(json, ProfilerConfiguration.class);
            case SEARCH_SETTINGS -> JsonUtils.readValue(json, SearchSettings.class);
            case ASSET_CERTIFICATION_SETTINGS -> JsonUtils.readValue(
                json, AssetCertificationSettings.class);
            case WORKFLOW_SETTINGS -> JsonUtils.readValue(json, WorkflowSettings.class);
            case LINEAGE_SETTINGS -> JsonUtils.readValue(json, LineageSettings.class);
            case AUTHENTICATION_CONFIGURATION -> JsonUtils.readValue(
                json, AuthenticationConfiguration.class);
            case AUTHORIZER_CONFIGURATION -> JsonUtils.readValue(
                json, AuthorizerConfiguration.class);
            case ENTITY_RULES_SETTINGS -> JsonUtils.readValue(json, EntityRulesSettings.class);
            case SCIM_CONFIGURATION -> JsonUtils.readValue(json, ScimConfiguration.class);
            case OPEN_LINEAGE_SETTINGS -> JsonUtils.readValue(json, OpenLineageSettings.class);
            case TEAMS_APP_CONFIGURATION -> JsonUtils.readValue(json, TeamsAppConfiguration.class);
            case MCP_CONFIGURATION -> JsonUtils.readValue(json, MCPConfiguration.class);
            case GLOSSARY_TERM_RELATION_SETTINGS -> JsonUtils.readValue(
                json, GlossaryTermRelationSettings.class);
            default -> throw new IllegalArgumentException("Invalid Settings Type " + configType);
          };
      settings.setConfigValue(value);
      return settings;
    }
  }

  class TokenRowMapper implements RowMapper<TokenInterface> {
    @Override
    public TokenInterface map(ResultSet rs, StatementContext ctx) throws SQLException {
      return getToken(TokenType.fromValue(rs.getString("tokenType")), rs.getString("json"));
    }

    public static TokenInterface getToken(TokenType type, String json) {
      return switch (type) {
        case EMAIL_VERIFICATION -> JsonUtils.readValue(json, EmailVerificationToken.class);
        case PASSWORD_RESET -> JsonUtils.readValue(json, PasswordResetToken.class);
        case REFRESH_TOKEN -> JsonUtils.readValue(json, RefreshToken.class);
        case PERSONAL_ACCESS_TOKEN -> JsonUtils.readValue(json, PersonalAccessToken.class);
        case SUPPORT_TOKEN -> JsonUtils.readValue(json, SupportToken.class);
      };
    }
  }

  class UserSessionRowMapper implements RowMapper<UserSession> {
    @Override
    public UserSession map(ResultSet rs, StatementContext ctx) throws SQLException {
      return JsonUtils.readValue(rs.getString("json"), UserSession.class);
    }
  }

  // OAuth 2.0 Row Mappers
  class OAuthClientRowMapper implements RowMapper<OAuthRecords.OAuthClientRecord> {
    @Override
    public OAuthRecords.OAuthClientRecord map(ResultSet rs, StatementContext ctx)
        throws SQLException {
      return new OAuthRecords.OAuthClientRecord(
          UUID.fromString(rs.getString("id")),
          rs.getString("client_id"),
          rs.getString("client_secret_encrypted"),
          rs.getString("client_name"),
          JsonUtils.readObjects(rs.getString("redirect_uris"), String.class),
          JsonUtils.readObjects(rs.getString("grant_types"), String.class),
          rs.getString("token_endpoint_auth_method"),
          JsonUtils.readObjects(rs.getString("scopes"), String.class));
    }
  }

  class OAuthAuthorizationCodeRowMapper
      implements RowMapper<OAuthRecords.OAuthAuthorizationCodeRecord> {
    @Override
    public OAuthRecords.OAuthAuthorizationCodeRecord map(ResultSet rs, StatementContext ctx)
        throws SQLException {
      return new OAuthRecords.OAuthAuthorizationCodeRecord(
          rs.getString("code"),
          rs.getString("client_id"),
          rs.getString("user_name"),
          rs.getString("code_challenge"),
          rs.getString("code_challenge_method"),
          rs.getString("redirect_uri"),
          JsonUtils.readObjects(rs.getString("scopes"), String.class),
          rs.getLong("expires_at"),
          rs.getBoolean("used"));
    }
  }

  class OAuthAccessTokenRowMapper implements RowMapper<OAuthRecords.OAuthAccessTokenRecord> {
    @Override
    public OAuthRecords.OAuthAccessTokenRecord map(ResultSet rs, StatementContext ctx)
        throws SQLException {
      return new OAuthRecords.OAuthAccessTokenRecord(
          UUID.fromString(rs.getString("id")),
          rs.getString("token_hash"),
          rs.getString("access_token_encrypted"),
          rs.getString("client_id"),
          rs.getString("user_name"),
          JsonUtils.readObjects(rs.getString("scopes"), String.class),
          rs.getLong("expires_at"));
    }
  }

  class OAuthRefreshTokenRowMapper implements RowMapper<OAuthRecords.OAuthRefreshTokenRecord> {
    @Override
    public OAuthRecords.OAuthRefreshTokenRecord map(ResultSet rs, StatementContext ctx)
        throws SQLException {
      return new OAuthRecords.OAuthRefreshTokenRecord(
          UUID.fromString(rs.getString("id")),
          rs.getString("token_hash"),
          rs.getString("refresh_token_encrypted"),
          rs.getString("client_id"),
          rs.getString("user_name"),
          JsonUtils.readObjects(rs.getString("scopes"), String.class),
          rs.getLong("expires_at"),
          rs.getBoolean("revoked"));
    }
  }

  interface TokenDAO {
    @SqlQuery("SELECT tokenType, json FROM user_tokens WHERE token = :token")
    @RegisterRowMapper(TokenRowMapper.class)
    TokenInterface findByToken(@Bind("token") String token) throws StatementException;

    @SqlQuery(
        "SELECT tokenType, json FROM user_tokens WHERE userId = :userId AND tokenType = :tokenType ")
    @RegisterRowMapper(TokenRowMapper.class)
    List<TokenInterface> getAllUserTokenWithType(
        @BindUUID("userId") UUID userId, @Bind("tokenType") String tokenType)
        throws StatementException;

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO user_tokens (json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO user_tokens (json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value = "UPDATE user_tokens SET json = :json WHERE token = :token",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "UPDATE user_tokens SET json = (:json :: jsonb) WHERE token = :token",
        connectionType = POSTGRES)
    void update(@Bind("token") String token, @Bind("json") String json);

    @SqlUpdate(value = "DELETE from user_tokens WHERE token = :token")
    void delete(@Bind("token") String token);

    @SqlUpdate(value = "DELETE from user_tokens WHERE token IN (<tokenIds>)")
    void deleteAll(@BindList("tokenIds") List<String> tokens);

    @SqlUpdate(value = "DELETE from user_tokens WHERE userid = :userid AND tokenType = :tokenType")
    void deleteTokenByUserAndType(
        @BindUUID("userid") UUID userid, @Bind("tokenType") String tokenType);
  }

  interface UserSessionDAO {
    @SqlQuery("SELECT json FROM user_session WHERE id = :id")
    @RegisterRowMapper(UserSessionRowMapper.class)
    UserSession findById(@Bind("id") String id) throws StatementException;

    @SqlQuery(
        "SELECT json FROM user_session WHERE userId = :userId AND status = :status "
            + "ORDER BY COALESCE(lastAccessedAt, 0) ASC LIMIT :limit")
    @RegisterRowMapper(UserSessionRowMapper.class)
    List<UserSession> findByUserIdAndStatus(
        @Bind("userId") String userId, @Bind("status") String status, @Bind("limit") int limit)
        throws StatementException;

    @SqlQuery(
        "SELECT json FROM user_session "
            + "WHERE status IN (<statuses>) AND expiresAt <= :now "
            + "ORDER BY updatedAt ASC LIMIT :limit")
    @RegisterRowMapper(UserSessionRowMapper.class)
    List<UserSession> findSessionsExpiredByAbsoluteTimeout(
        @BindList("statuses") List<String> statuses,
        @Bind("now") long now,
        @Bind("limit") int limit)
        throws StatementException;

    @SqlQuery(
        "SELECT json FROM user_session "
            + "WHERE status IN (<statuses>) AND idleExpiresAt <= :now "
            + "ORDER BY updatedAt ASC LIMIT :limit")
    @RegisterRowMapper(UserSessionRowMapper.class)
    List<UserSession> findSessionsExpiredByIdleTimeout(
        @BindList("statuses") List<String> statuses,
        @Bind("now") long now,
        @Bind("limit") int limit)
        throws StatementException;

    @SqlQuery(
        "SELECT json FROM user_session WHERE status IN (<statuses>) AND updatedAt <= :cutoff "
            + "ORDER BY updatedAt ASC LIMIT :limit")
    @RegisterRowMapper(UserSessionRowMapper.class)
    List<UserSession> findSessionsToPrune(
        @BindList("statuses") List<String> statuses,
        @Bind("cutoff") long cutoff,
        @Bind("limit") int limit)
        throws StatementException;

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO user_session (json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO user_session (json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE user_session SET json = :json WHERE id = :id AND version = :expectedVersion",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE user_session SET json = (:json :: jsonb) WHERE id = :id AND version = :expectedVersion",
        connectionType = POSTGRES)
    int updateIfVersion(
        @Bind("id") String id,
        @Bind("expectedVersion") long expectedVersion,
        @Bind("json") String json);

    @SqlUpdate("DELETE FROM user_session WHERE id = :id")
    void delete(@Bind("id") String id);

    @SqlUpdate("DELETE FROM user_session WHERE id IN (<ids>)")
    int deleteByIds(@BindList("ids") List<String> ids);
  }
}
