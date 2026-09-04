package org.openmetadata.sdk.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.flipkart.zjsonpatch.JsonPatch;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.AssetRealizationRole;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;
import org.openmetadata.sdk.network.RequestOptions;

class EntityServiceBaseTest {
  private static final String GLOSSARY_TERMS_PATH = "/v1/glossaryTerms";
  private static final String REALIZED_IN = "realizedIn";
  private static final String TERM_NAME = "Customer";
  private static final UUID TERM_ID = UUID.fromString("30000000-0000-0000-0000-000000000001");
  private static final UUID ORIGINAL_ASSET_ID =
      UUID.fromString("30000000-0000-0000-0000-000000000002");
  private static final UUID UPDATED_ASSET_ID =
      UUID.fromString("30000000-0000-0000-0000-000000000003");

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
  void updateFetchesFieldsContainingNestedEntityReferences() {
    GlossaryTerm original = glossaryTerm(ORIGINAL_ASSET_ID, AssetRealizationRole.PRIMARY_STORE);
    GlossaryTerm withoutRealizations = new GlossaryTerm().withId(TERM_ID).withName(TERM_NAME);
    GlossaryTerm updated = glossaryTerm(UPDATED_ASSET_ID, AssetRealizationRole.REPLICA);
    EntityServiceBase<GlossaryTerm> glossaryTermService = glossaryTermService();
    ArgumentCaptor<RequestOptions> getOptions =
        stubGlossaryTermFetch(original, withoutRealizations);
    ArgumentCaptor<JsonNode> patch = captureGlossaryTermPatch(updated);

    glossaryTermService.update(TERM_ID, updated);

    assertTrue(requestedFields(getOptions.getValue()).contains(REALIZED_IN));
    JsonNode patchedOriginal =
        JsonPatch.apply(patch.getValue(), glossaryTermService.objectMapper.valueToTree(original));
    assertEquals(1, patchedOriginal.path(REALIZED_IN).size());
    assertEquals(
        UPDATED_ASSET_ID.toString(),
        patchedOriginal.path(REALIZED_IN).get(0).path("asset").path("id").asText());
  }

  private ArgumentCaptor<RequestOptions> stubGlossaryTermFetch(
      GlossaryTerm original, GlossaryTerm withoutRealizations) {
    ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
    when(mockHttpClient.execute(
            eq(HttpMethod.GET),
            eq(GLOSSARY_TERMS_PATH + "/" + TERM_ID),
            isNull(),
            eq(GlossaryTerm.class),
            options.capture()))
        .thenAnswer(
            invocation ->
                requestedFields(invocation.getArgument(4)).contains(REALIZED_IN)
                    ? original
                    : withoutRealizations);
    return options;
  }

  private ArgumentCaptor<JsonNode> captureGlossaryTermPatch(GlossaryTerm updated) {
    ArgumentCaptor<JsonNode> patch = ArgumentCaptor.forClass(JsonNode.class);
    when(mockHttpClient.execute(
            eq(HttpMethod.PATCH),
            eq(GLOSSARY_TERMS_PATH + "/" + TERM_ID),
            patch.capture(),
            eq(GlossaryTerm.class),
            isNull()))
        .thenReturn(updated);
    return patch;
  }

  private EntityServiceBase<GlossaryTerm> glossaryTermService() {
    return new EntityServiceBase<>(mockHttpClient, GLOSSARY_TERMS_PATH) {
      @Override
      public Class<GlossaryTerm> getEntityClass() {
        return GlossaryTerm.class;
      }
    };
  }

  private static GlossaryTerm glossaryTerm(UUID assetId, AssetRealizationRole role) {
    EntityReference asset = new EntityReference().withId(assetId).withType("table");
    AssetRealization realization = new AssetRealization().withAsset(asset).withRole(role);
    return new GlossaryTerm()
        .withId(TERM_ID)
        .withName(TERM_NAME)
        .withRealizedIn(List.of(realization));
  }

  private static Set<String> requestedFields(RequestOptions options) {
    return Set.of(options.getQueryParams().get("fields").split(","));
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
