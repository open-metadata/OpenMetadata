package org.openmetadata.service.migration.utils.v1126;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
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

  private static final String WEBHOOK_WITH_BEARER =
      """
      {
        "destinations": [
          {
            "type": "Webhook",
            "config": {
              "authType": { "type": "bearer", "secretKey": "mysecret" }
            }
          }
        ]
      }
      """;

  private static final String WEBHOOK_WITHOUT_AUTH_TYPE =
      """
      {
        "destinations": [
          {
            "type": "Webhook",
            "config": {
              "secretKey": "mysecret"
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
              "authType": { "type": "bearer", "secretKey": "mysecret" }
            }
          }
        ]
      }
      """;

  private static final String WEBHOOK_WITH_NON_BEARER_AUTH_TYPE =
      """
      {
        "destinations": [
          {
            "type": "Webhook",
            "config": {
              "authType": { "type": "oAuth2" }
            }
          }
        ]
      }
      """;

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

  private Map<String, Object> row(String json) {
    return Map.of("id", UUID.randomUUID().toString(), "json", json);
  }

  @Test
  void revertWebhookAuthTypeToSecretKeyIsNoOpWhenNoRows() {
    Handle handle = handleReturningRows(List.of());

    assertDoesNotThrow(() -> MigrationUtil.revertWebhookAuthTypeToSecretKey(handle));

    verify(handle, never()).createUpdate(any());
  }

  @Test
  void revertWebhookAuthTypeToSecretKeyIsNoOpWhenNoAuthType() {
    Handle handle = handleReturningRows(List.of(row(WEBHOOK_WITHOUT_AUTH_TYPE)));

    assertDoesNotThrow(() -> MigrationUtil.revertWebhookAuthTypeToSecretKey(handle));

    verify(handle, never()).createUpdate(any());
  }

  @Test
  void revertWebhookAuthTypeToSecretKeyIsNoOpForNonWebhookDestinations() {
    Handle handle = handleReturningRows(List.of(row(NON_WEBHOOK_DESTINATION)));

    assertDoesNotThrow(() -> MigrationUtil.revertWebhookAuthTypeToSecretKey(handle));

    verify(handle, never()).createUpdate(any());
  }

  @Test
  void revertWebhookAuthTypeToSecretKeyRevertsBearerMysql() throws Exception {
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    Handle handle = handleWithUpdateCapture(List.of(row(WEBHOOK_WITH_BEARER)), mockUpdate);

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockConfig = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(mockConfig);
      when(mockConfig.isMySQL()).thenReturn(true);

      assertDoesNotThrow(() -> MigrationUtil.revertWebhookAuthTypeToSecretKey(handle));

      ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
      verify(handle).createUpdate(sqlCaptor.capture());
      assertEquals(
          "UPDATE event_subscription_entity SET json = :json WHERE id = :id", sqlCaptor.getValue());

      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(mockUpdate).bind(eq("json"), jsonCaptor.capture());

      JsonNode config =
          MAPPER.readTree(jsonCaptor.getValue()).get("destinations").get(0).get("config");
      assertEquals("mysecret", config.get("secretKey").asText());
      assertNull(config.get("authType"));
    }
  }

  @Test
  void revertWebhookAuthTypeToSecretKeyRevertsBearerPostgres() throws Exception {
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    Handle handle = handleWithUpdateCapture(List.of(row(WEBHOOK_WITH_BEARER)), mockUpdate);

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockConfig = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(mockConfig);
      when(mockConfig.isMySQL()).thenReturn(false);

      assertDoesNotThrow(() -> MigrationUtil.revertWebhookAuthTypeToSecretKey(handle));

      ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
      verify(handle).createUpdate(sqlCaptor.capture());
      assertEquals(
          "UPDATE event_subscription_entity SET json = :json::jsonb WHERE id = :id",
          sqlCaptor.getValue());

      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(mockUpdate).bind(eq("json"), jsonCaptor.capture());

      JsonNode config =
          MAPPER.readTree(jsonCaptor.getValue()).get("destinations").get(0).get("config");
      assertEquals("mysecret", config.get("secretKey").asText());
      assertNull(config.get("authType"));
    }
  }

  @Test
  void revertWebhookAuthTypeToSecretKeyHandlesNonBearerAuthType() throws Exception {
    Update mockUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    Handle handle =
        handleWithUpdateCapture(List.of(row(WEBHOOK_WITH_NON_BEARER_AUTH_TYPE)), mockUpdate);

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig mockConfig = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(mockConfig);
      when(mockConfig.isMySQL()).thenReturn(true);

      assertDoesNotThrow(() -> MigrationUtil.revertWebhookAuthTypeToSecretKey(handle));

      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(mockUpdate).bind(eq("json"), jsonCaptor.capture());

      JsonNode config =
          MAPPER.readTree(jsonCaptor.getValue()).get("destinations").get(0).get("config");
      assertNull(config.get("authType"));
      assertNull(config.get("secretKey"));
    }
  }
}
