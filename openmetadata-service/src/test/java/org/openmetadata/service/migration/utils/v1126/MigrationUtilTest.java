package org.openmetadata.service.migration.utils.v1126;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
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

  // --- migratePipelineServiceEdges: assetEdges refcount tests ---

  private EntityReference databaseServiceRef(UUID id) {
    return new EntityReference().withId(id).withType(Entity.DATABASE_SERVICE);
  }

  private EntityReference pipelineServiceRef(UUID id) {
    return new EntityReference().withId(id).withType(Entity.PIPELINE_SERVICE);
  }

  private Table tableWithService(UUID serviceId) {
    Table table = new Table();
    table.setId(UUID.randomUUID());
    table.setService(databaseServiceRef(serviceId));
    return table;
  }

  private Pipeline pipelineWithService(UUID serviceId) {
    Pipeline pipeline = new Pipeline();
    pipeline.setId(UUID.randomUUID());
    pipeline.setService(pipelineServiceRef(serviceId));
    return pipeline;
  }

  private CollectionDAO.EntityRelationshipObject lineageCandidate(
      UUID fromTableId, UUID toTableId, UUID pipelineId) {
    String json =
        "{\"pipeline\":{\"id\":\""
            + pipelineId
            + "\",\"type\":\"pipeline\"},\"createdBy\":\"admin\",\"createdAt\":1,\"updatedBy\":\"admin\",\"updatedAt\":2}";
    return CollectionDAO.EntityRelationshipObject.builder()
        .fromEntity(Entity.TABLE)
        .fromId(fromTableId.toString())
        .toEntity(Entity.TABLE)
        .toId(toTableId.toString())
        .relation(Relationship.UPSTREAM.ordinal())
        .json(json)
        .build();
  }

  @Test
  void migratePipelineServiceEdgesCountsContributingChildEdgesPerServicePair() {
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();

    // Three child edges between tables in the same service pair, all through pipelines in the same
    // pipeline service. Each contributes +1 to both the fromService -> pipelineService hop and the
    // pipelineService -> toService hop, so the backfill must store assetEdges=3 for each hop
    // (not a hard-coded 1, which would let the first delete of any one contributor remove the hop
    // while the other two children still need it).
    UUID fromTable1 = UUID.randomUUID();
    UUID toTable1 = UUID.randomUUID();
    UUID fromTable2 = UUID.randomUUID();
    UUID toTable2 = UUID.randomUUID();
    UUID fromTable3 = UUID.randomUUID();
    UUID toTable3 = UUID.randomUUID();
    UUID pipeline1Id = UUID.randomUUID();
    UUID pipeline2Id = UUID.randomUUID();
    UUID pipeline3Id = UUID.randomUUID();

    Map<UUID, UUID> tableService = new HashMap<>();
    tableService.put(fromTable1, fromServiceId);
    tableService.put(fromTable2, fromServiceId);
    tableService.put(fromTable3, fromServiceId);
    tableService.put(toTable1, toServiceId);
    tableService.put(toTable2, toServiceId);
    tableService.put(toTable3, toServiceId);

    List<CollectionDAO.EntityRelationshipObject> batch =
        List.of(
            lineageCandidate(fromTable1, toTable1, pipeline1Id),
            lineageCandidate(fromTable2, toTable2, pipeline2Id),
            lineageCandidate(fromTable3, toTable3, pipeline3Id));

    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(relationshipDAO.getRecordWithOffset(anyInt(), anyLong(), anyInt()))
        .thenReturn(batch)
        .thenReturn(List.of());
    when(relationshipDAO.getRecord(any(UUID.class), any(UUID.class), anyInt())).thenReturn(null);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);

    try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), any(UUID.class), eq(Entity.FIELD_SERVICE), eq(Include.ALL)))
          .thenAnswer(inv -> tableWithService(tableService.get(inv.getArgument(1))));
      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.PIPELINE),
                      any(UUID.class),
                      eq(Entity.FIELD_SERVICE),
                      eq(Include.ALL)))
          .thenReturn(pipelineWithService(pipelineServiceId));

      MigrationUtil.migratePipelineServiceEdges(collectionDAO);

      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(relationshipDAO, times(2))
          .insert(
              any(UUID.class),
              any(UUID.class),
              anyString(),
              anyString(),
              eq(Relationship.UPSTREAM.ordinal()),
              jsonCaptor.capture());

      // Both hops (fromService -> pipelineService and pipelineService -> toService) are fed by 3
      // contributing child edges, so each must carry assetEdges=3.
      List<String> insertedJsons = jsonCaptor.getAllValues();
      assertEquals(2, insertedJsons.size());
      for (String json : insertedJsons) {
        LineageDetails details = JsonUtils.readValue(json, LineageDetails.class);
        assertEquals(
            3,
            details.getAssetEdges(),
            "assetEdges must count the 3 contributing child edges, not a hard-coded 1");
      }
    }
  }

  @Test
  void migratePipelineServiceEdgesStoresAssetEdgesOneForASingleContributingChildEdge() {
    UUID fromTableId = UUID.randomUUID();
    UUID toTableId = UUID.randomUUID();
    UUID pipelineId = UUID.randomUUID();
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();

    List<CollectionDAO.EntityRelationshipObject> batch =
        List.of(lineageCandidate(fromTableId, toTableId, pipelineId));

    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(relationshipDAO.getRecordWithOffset(anyInt(), anyLong(), anyInt()))
        .thenReturn(batch)
        .thenReturn(List.of());
    when(relationshipDAO.getRecord(any(UUID.class), any(UUID.class), anyInt())).thenReturn(null);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);

    try (MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), eq(fromTableId), eq(Entity.FIELD_SERVICE), eq(Include.ALL)))
          .thenReturn(tableWithService(fromServiceId));
      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), eq(toTableId), eq(Entity.FIELD_SERVICE), eq(Include.ALL)))
          .thenReturn(tableWithService(toServiceId));
      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.PIPELINE),
                      eq(pipelineId),
                      eq(Entity.FIELD_SERVICE),
                      eq(Include.ALL)))
          .thenReturn(pipelineWithService(pipelineServiceId));

      MigrationUtil.migratePipelineServiceEdges(collectionDAO);

      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(relationshipDAO, times(2))
          .insert(
              any(UUID.class),
              any(UUID.class),
              anyString(),
              anyString(),
              eq(Relationship.UPSTREAM.ordinal()),
              jsonCaptor.capture());

      for (String json : jsonCaptor.getAllValues()) {
        LineageDetails details = JsonUtils.readValue(json, LineageDetails.class);
        assertEquals(1, details.getAssetEdges(), "a single child edge must produce assetEdges=1");
      }
    }
  }
}
