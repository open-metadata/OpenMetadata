package org.openmetadata.sdk.services;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;
import org.openmetadata.sdk.network.RequestOptions;

class EntityServiceBaseTest {

  @Mock private OpenMetadataHttpClient mockHttpClient;

  @Mock private OpenMetadataClient mockClient;

  private EntityServiceBase<Table> tableService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.getHttpClient()).thenReturn(mockHttpClient);
    tableService =
        new EntityServiceBase<Table>(mockHttpClient, "/v1/tables") {
          @Override
          public Class<Table> getEntityClass() {
            return Table.class;
          }
        };
  }

  @Test
  void testGet() {
    String tableId = "table-123";
    Table table = new Table();
    table.setId(java.util.UUID.fromString("a1b2c3d4-e5f6-7890-abcd-ef1234567890"));
    table.setName("test_table");

    when(mockHttpClient.execute(
            eq(HttpMethod.GET), eq("/v1/tables/" + tableId), isNull(), eq(Table.class)))
        .thenReturn(table);

    Table result = tableService.get(tableId);

    assertNotNull(result);
    assertEquals("test_table", result.getName());
  }

  @Test
  void testGetWithFields() {
    String tableId = "table-123";
    String fields = "owner,tags";
    Table table = new Table();
    table.setId(java.util.UUID.fromString("a1b2c3d4-e5f6-7890-abcd-ef1234567890"));
    table.setName("test_table");

    ArgumentCaptor<RequestOptions> paramsCaptor = ArgumentCaptor.forClass(RequestOptions.class);

    when(mockHttpClient.execute(
            eq(HttpMethod.GET),
            eq("/v1/tables/" + tableId),
            isNull(),
            eq(Table.class),
            paramsCaptor.capture()))
        .thenReturn(table);

    Table result = tableService.get(tableId, fields);

    assertNotNull(result);
    RequestOptions capturedOptions = paramsCaptor.getValue();
    assertEquals(fields, capturedOptions.getQueryParams().get("fields"));
  }

  @Test
  void testGetByName() {
    String fqn = "database.schema.table";
    Table table = new Table();
    table.setFullyQualifiedName(fqn);

    ArgumentCaptor<RequestOptions> paramsCaptor = ArgumentCaptor.forClass(RequestOptions.class);

    when(mockHttpClient.execute(
            eq(HttpMethod.GET),
            eq("/v1/tables/name/" + fqn),
            isNull(),
            eq(Table.class),
            paramsCaptor.capture()))
        .thenReturn(table);

    Table result = tableService.getByName(fqn);

    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
  }

  @Test
  void testCreate() {
    Table table = new Table();
    table.setName("new_table");

    when(mockHttpClient.execute(eq(HttpMethod.POST), eq("/v1/tables"), eq(table), eq(Table.class)))
        .thenReturn(table);

    Table result = tableService.create(table);

    assertNotNull(result);
    assertEquals("new_table", result.getName());
  }

  @Test
  void testUpdate() {
    String tableId = "table-123";
    Table table = new Table();
    table.setId(java.util.UUID.fromString("a1b2c3d4-e5f6-7890-abcd-ef1234567890"));
    table.setName("updated_table");

    // Mock the GET request that happens in update to fetch original
    when(mockHttpClient.execute(
            eq(HttpMethod.GET), eq("/v1/tables/" + tableId), isNull(), eq(Table.class)))
        .thenReturn(table);

    // Mock the PATCH request
    when(mockHttpClient.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/tables/" + tableId),
            any(JsonNode.class),
            eq(Table.class),
            any()))
        .thenReturn(table);

    Table result = tableService.update(tableId, table);

    assertNotNull(result);
    assertEquals("updated_table", result.getName());
  }

  @Test
  void testPatch() {
    String tableId = "table-123";
    String jsonPatch = "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"New description\"}]";
    Table table = new Table();
    table.setDescription("New description");

    ArgumentCaptor<RequestOptions> paramsCaptor = ArgumentCaptor.forClass(RequestOptions.class);

    when(mockHttpClient.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/tables/" + tableId),
            eq(jsonPatch),
            eq(Table.class),
            paramsCaptor.capture()))
        .thenReturn(table);

    // The patch method should check if the params contain specific query params
    verify(mockHttpClient, never())
        .execute(
            eq(HttpMethod.PATCH),
            anyString(),
            any(),
            any(),
            argThat(
                params ->
                    params != null
                        && params.getQueryParams().containsKey("hardDelete")
                        && "true".equals(params.getQueryParams().get("hardDelete"))));
  }

  @Test
  void testCreateThenUpdate_usesSnapshotInsteadOfRefetch() {
    String tableId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    Table created = new Table();
    created.setId(java.util.UUID.fromString(tableId));
    created.setName("t");
    created.setDescription("original");

    when(mockHttpClient.execute(
            eq(HttpMethod.POST), eq("/v1/tables"), eq(created), eq(Table.class)))
        .thenReturn(created);
    when(mockHttpClient.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/tables/" + tableId),
            any(JsonNode.class),
            eq(Table.class),
            any()))
        .thenReturn(created);

    Table response = tableService.create(created);

    response.setDescription("changed");
    tableService.update(tableId, response);

    verify(mockHttpClient, never())
        .execute(eq(HttpMethod.GET), eq("/v1/tables/" + tableId), isNull(), eq(Table.class));
    verify(mockHttpClient, never())
        .execute(
            eq(HttpMethod.GET),
            eq("/v1/tables/" + tableId),
            isNull(),
            eq(Table.class),
            any(RequestOptions.class));
  }

  @Test
  void testUpdateThenUpdate_usesSnapshotFromFirstUpdateResponse() {
    String tableId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    Table response = new Table();
    response.setId(java.util.UUID.fromString(tableId));
    response.setName("t");
    response.setDescription("after-first-patch");

    when(mockHttpClient.execute(
            eq(HttpMethod.GET), eq("/v1/tables/" + tableId), isNull(), eq(Table.class)))
        .thenReturn(response);
    when(mockHttpClient.execute(
            eq(HttpMethod.GET),
            eq("/v1/tables/" + tableId),
            isNull(),
            eq(Table.class),
            any(RequestOptions.class)))
        .thenReturn(response);
    when(mockHttpClient.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/tables/" + tableId),
            any(JsonNode.class),
            eq(Table.class),
            any()))
        .thenReturn(response);

    Table firstInput = new Table();
    firstInput.setId(java.util.UUID.fromString(tableId));
    firstInput.setName("t");
    firstInput.setDescription("after-first-patch");
    Table afterFirst = tableService.update(tableId, firstInput);

    int getCallsAfterFirstUpdate =
        mockingDetails(mockHttpClient).getInvocations().stream()
            .filter(inv -> "execute".equals(inv.getMethod().getName()))
            .filter(inv -> HttpMethod.GET.equals(inv.getArgument(0)))
            .filter(inv -> ("/v1/tables/" + tableId).equals(inv.getArgument(1)))
            .toList()
            .size();

    afterFirst.setDescription("after-second-patch");
    tableService.update(tableId, afterFirst);

    int getCallsAfterSecondUpdate =
        mockingDetails(mockHttpClient).getInvocations().stream()
            .filter(inv -> "execute".equals(inv.getMethod().getName()))
            .filter(inv -> HttpMethod.GET.equals(inv.getArgument(0)))
            .filter(inv -> ("/v1/tables/" + tableId).equals(inv.getArgument(1)))
            .toList()
            .size();

    assertEquals(
        getCallsAfterFirstUpdate,
        getCallsAfterSecondUpdate,
        "second update must reuse the snapshot from the first response, not re-fetch from server");
  }

  @Test
  void testUpsertThenUpdate_usesSnapshotFromUpsertResponse() {
    String tableId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    Table upserted = new Table();
    upserted.setId(java.util.UUID.fromString(tableId));
    upserted.setName("t");
    upserted.setDescription("from-upsert");

    when(mockHttpClient.execute(
            eq(HttpMethod.PUT), eq("/v1/tables"), eq(upserted), eq(Table.class)))
        .thenReturn(upserted);
    when(mockHttpClient.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/tables/" + tableId),
            any(JsonNode.class),
            eq(Table.class),
            any()))
        .thenReturn(upserted);

    Table response = tableService.upsert(upserted);
    response.setDescription("changed");
    tableService.update(tableId, response);

    verify(mockHttpClient, never())
        .execute(eq(HttpMethod.GET), eq("/v1/tables/" + tableId), isNull(), eq(Table.class));
    verify(mockHttpClient, never())
        .execute(
            eq(HttpMethod.GET),
            eq("/v1/tables/" + tableId),
            isNull(),
            eq(Table.class),
            any(RequestOptions.class));
  }

  @Test
  void testRawPatchThenUpdate_usesSnapshotFromPatchResponse() {
    String tableId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    Table afterPatch = new Table();
    afterPatch.setId(java.util.UUID.fromString(tableId));
    afterPatch.setName("t");
    afterPatch.setDescription("from-raw-patch");

    com.fasterxml.jackson.databind.node.ObjectNode patchOp =
        new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode();
    patchOp.put("op", "replace");
    patchOp.put("path", "/description");
    patchOp.put("value", "from-raw-patch");
    com.fasterxml.jackson.databind.node.ArrayNode patchDoc =
        new com.fasterxml.jackson.databind.ObjectMapper().createArrayNode().add(patchOp);

    when(mockHttpClient.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/tables/" + tableId),
            any(JsonNode.class),
            eq(Table.class),
            any()))
        .thenReturn(afterPatch);

    tableService.patch(tableId, patchDoc);

    afterPatch.setDescription("changed-again");
    tableService.update(tableId, afterPatch);

    verify(mockHttpClient, never())
        .execute(eq(HttpMethod.GET), eq("/v1/tables/" + tableId), isNull(), eq(Table.class));
    verify(mockHttpClient, never())
        .execute(
            eq(HttpMethod.GET),
            eq("/v1/tables/" + tableId),
            isNull(),
            eq(Table.class),
            any(RequestOptions.class));
  }

  @Test
  void testList() {
    // Create JSON response string that matches what the API would return
    String jsonResponse =
        "{\"data\":["
            + "{\"id\":\"550e8400-e29b-41d4-a716-446655440001\",\"name\":\"table1\",\"fullyQualifiedName\":\"service.database.schema.table1\"},"
            + "{\"id\":\"550e8400-e29b-41d4-a716-446655440002\",\"name\":\"table2\",\"fullyQualifiedName\":\"service.database.schema.table2\"}"
            + "],\"paging\":{}}";

    ArgumentCaptor<RequestOptions> paramsCaptor = ArgumentCaptor.forClass(RequestOptions.class);

    when(mockHttpClient.executeForString(
            eq(HttpMethod.GET), eq("/v1/tables"), isNull(), paramsCaptor.capture()))
        .thenReturn(jsonResponse);

    ListResponse<Table> result = tableService.list();

    assertNotNull(result);
    assertEquals(2, result.getData().size());
  }

  @Test
  void testDelete() {
    String tableId = "table-123";
    Map<String, String> params = Map.of("recursive", "true", "hardDelete", "true");

    ArgumentCaptor<RequestOptions> deleteParamsCaptor =
        ArgumentCaptor.forClass(RequestOptions.class);
    when(mockHttpClient.execute(
            eq(HttpMethod.DELETE),
            eq("/v1/tables/" + tableId),
            isNull(),
            eq(Void.class),
            deleteParamsCaptor.capture()))
        .thenReturn(null);

    tableService.delete(tableId, params);

    verify(mockHttpClient)
        .execute(
            eq(HttpMethod.DELETE),
            eq("/v1/tables/" + tableId),
            isNull(),
            eq(Void.class),
            any(RequestOptions.class));

    RequestOptions capturedOptions = deleteParamsCaptor.getValue();
    assertEquals("true", capturedOptions.getQueryParams().get("recursive"));
    assertEquals("true", capturedOptions.getQueryParams().get("hardDelete"));
  }

  @Test
  void testDeleteSimple() {
    String tableId = "table-123";

    when(mockHttpClient.execute(
            eq(HttpMethod.DELETE), eq("/v1/tables/" + tableId), isNull(), eq(Void.class)))
        .thenReturn(null);

    tableService.delete(tableId);

    verify(mockHttpClient)
        .execute(eq(HttpMethod.DELETE), eq("/v1/tables/" + tableId), isNull(), eq(Void.class));
  }

  // Note: restore method is not part of the base EntityServiceBase class
  // This would need to be implemented in specific service subclasses if needed

  // Note: addFollower and removeFollower methods are not part of the base EntityServiceBase class
  // These would need to be implemented in specific service subclasses if needed
}
