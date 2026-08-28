package org.openmetadata.service.migration.utils.v1130;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.service.resources.databases.DatasourceConfig;

class MigrationUtilTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static final String WEBHOOK_WITH_SECRET_KEY =
      """
      {
        "destinations": [
          {
            "type": "Webhook",
            "config": {
              "endpoint": "https://example.com/hook",
              "secretKey": "mysecret"
            }
          }
        ]
      }
      """;

  private static final String WEBHOOK_WITHOUT_SECRET_KEY =
      """
      {
        "destinations": [
          {
            "type": "Webhook",
            "config": {
              "endpoint": "https://example.com/hook"
            }
          }
        ]
      }
      """;

  private static final String WEBHOOK_WITH_EMPTY_SECRET_KEY =
      """
      {
        "destinations": [
          {
            "type": "Webhook",
            "config": {
              "endpoint": "https://example.com/hook",
              "secretKey": ""
            }
          }
        ]
      }
      """;

  private static final String WEBHOOK_ALREADY_MIGRATED =
      """
      {
        "destinations": [
          {
            "type": "Webhook",
            "config": {
              "endpoint": "https://example.com/hook",
              "authType": { "type": "bearer", "secretKey": "mysecret" }
            }
          }
        ]
      }
      """;

  private static final String NON_WEBHOOK_DESTINATION =
      """
      {
        "destinations": [
          {
            "type": "Slack",
            "config": {
              "secretKey": "mysecret"
            }
          }
        ]
      }
      """;

  private Map<String, Object> row(String json) {
    return Map.of("id", UUID.randomUUID().toString(), "json", json);
  }

  private Handle handleReturningRows(List<Map<String, Object>> rows) {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list()).thenReturn(rows);
    return handle;
  }

  private Handle handleWithUpdateCapture(List<Map<String, Object>> rows, Update mockUpdate) {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(any(String.class)).mapToMap().list()).thenReturn(rows);
    when(handle.createUpdate(any(String.class))).thenReturn(mockUpdate);
    return handle;
  }

  @Test
  void migrateWebhookSecretKeyToAuthTypeIsNoOpWhenNoRows() {
    Handle handle = handleReturningRows(List.of());

    assertDoesNotThrow(() -> MigrationUtil.migrateWebhookSecretKeyToAuthType(handle));

    verify(handle, never()).createUpdate(any());
  }

  @Test
  void migrateWebhookSecretKeyToAuthTypeIsNoOpWhenNoSecretKey() {
    Handle handle = handleReturningRows(List.of(row(WEBHOOK_WITHOUT_SECRET_KEY)));

    assertDoesNotThrow(() -> MigrationUtil.migrateWebhookSecretKeyToAuthType(handle));

    verify(handle, never()).createUpdate(any());
  }

  @Test
  void migrateWebhookSecretKeyToAuthTypeIsNoOpWhenEmptySecretKey() {
    Handle handle = handleReturningRows(List.of(row(WEBHOOK_WITH_EMPTY_SECRET_KEY)));

    assertDoesNotThrow(() -> MigrationUtil.migrateWebhookSecretKeyToAuthType(handle));

    verify(handle, never()).createUpdate(any());
  }

  @Test
  void migrateWebhookSecretKeyToAuthTypeIsNoOpWhenAlreadyMigrated() {
    Handle handle = handleReturningRows(List.of(row(WEBHOOK_ALREADY_MIGRATED)));

    assertDoesNotThrow(() -> MigrationUtil.migrateWebhookSecretKeyToAuthType(handle));

    verify(handle, never()).createUpdate(any());
  }

  @Test
  void migrateWebhookSecretKeyToAuthTypeIsNoOpForNonWebhookDestinations() {
    Handle handle = handleReturningRows(List.of(row(NON_WEBHOOK_DESTINATION)));

    assertDoesNotThrow(() -> MigrationUtil.migrateWebhookSecretKeyToAuthType(handle));

    verify(handle, never()).createUpdate(any());
  }

  @Test
  void migrateWebhookSecretKeyToAuthTypeMigratesMysql() throws Exception {
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    Handle handle = handleWithUpdateCapture(List.of(row(WEBHOOK_WITH_SECRET_KEY)), mockUpdate);

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockConfig = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(mockConfig);
      when(mockConfig.isMySQL()).thenReturn(true);

      assertDoesNotThrow(() -> MigrationUtil.migrateWebhookSecretKeyToAuthType(handle));

      ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
      verify(handle).createUpdate(sqlCaptor.capture());
      assertEquals(
          "UPDATE event_subscription_entity SET json = :json WHERE id = :id", sqlCaptor.getValue());

      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(mockUpdate).bind(eq("json"), jsonCaptor.capture());

      JsonNode config =
          MAPPER.readTree(jsonCaptor.getValue()).get("destinations").get(0).get("config");
      assertNull(config.get("secretKey"));
      assertNotNull(config.get("authType"));
      assertEquals("bearer", config.get("authType").get("type").asText());
      assertEquals("mysecret", config.get("authType").get("secretKey").asText());
    }
  }

  @Test
  void migrateWebhookSecretKeyToAuthTypeMigratesPostgres() throws Exception {
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    Handle handle = handleWithUpdateCapture(List.of(row(WEBHOOK_WITH_SECRET_KEY)), mockUpdate);

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockConfig = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(mockConfig);
      when(mockConfig.isMySQL()).thenReturn(false);

      assertDoesNotThrow(() -> MigrationUtil.migrateWebhookSecretKeyToAuthType(handle));

      ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
      verify(handle).createUpdate(sqlCaptor.capture());
      assertEquals(
          "UPDATE event_subscription_entity SET json = :json::jsonb WHERE id = :id",
          sqlCaptor.getValue());

      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(mockUpdate).bind(eq("json"), jsonCaptor.capture());

      JsonNode config =
          MAPPER.readTree(jsonCaptor.getValue()).get("destinations").get(0).get("config");
      assertNull(config.get("secretKey"));
      assertNotNull(config.get("authType"));
      assertEquals("bearer", config.get("authType").get("type").asText());
      assertEquals("mysecret", config.get("authType").get("secretKey").asText());
    }
  }
}
