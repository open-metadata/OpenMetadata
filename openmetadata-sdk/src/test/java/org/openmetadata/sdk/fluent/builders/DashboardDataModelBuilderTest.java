package org.openmetadata.sdk.fluent.builders;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.dataassets.DashboardDataModelService;

/**
 * Regression coverage for the bug introduced in commit {@code bb1395fc72} (PR #23239) where {@link
 * DashboardDataModelBuilder#create()} / {@link DashboardDataModelBuilder#createOrUpdate()}
 * hand-converted the {@link CreateDashboardDataModel} request into a stripped {@link
 * DashboardDataModel} entity and posted that, dropping the required {@code service}, {@code
 * dataModelType} and {@code columns} fields so every call failed with HTTP 400 bean validation.
 * The fix posts the {@code CreateDashboardDataModel} request directly and exposes setters for the
 * required fields, mirroring {@code TableBuilder}, {@code DatabaseBuilder}, {@code UserBuilder}
 * and the pure-fluent {@code DashboardDataModels.DashboardDataModelCreator}.
 */
class DashboardDataModelBuilderTest {

  private static final String NAME = "dm_test";
  private static final String SERVICE = "superset";
  private static final DataModelType MODEL_TYPE = DataModelType.SupersetDataModel;
  private static final List<Column> COLUMNS =
      List.of(new Column().withName("id").withDataType(ColumnDataType.INT));

  private static OpenMetadataClient mockClient() {
    OpenMetadataClient client = mock(OpenMetadataClient.class);
    DashboardDataModelService service = mock(DashboardDataModelService.class);
    when(client.dashboardDataModels()).thenReturn(service);
    return client;
  }

  @Test
  void createPostsCreateDashboardDataModelRequestNotEntity() {
    OpenMetadataClient client = mockClient();
    DashboardDataModelService service = client.dashboardDataModels();

    DashboardDataModel expected = new DashboardDataModel();
    expected.setId(UUID.randomUUID());
    expected.setName(NAME);
    when(service.create(any(CreateDashboardDataModel.class))).thenReturn(expected);

    DashboardDataModel result =
        new DashboardDataModelBuilder(client)
            .name(NAME)
            .displayName("Dm Test")
            .description("A test data model")
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(COLUMNS)
            .create();

    assertSame(expected, result);

    // The Create.Create* overload must be invoked (the old buggy code called the entity-level
    // create(DashboardDataModel) overload inherited from EntityServiceBase, dropping required
    // fields). Capture and assert the request carries every required field.
    ArgumentCaptor<CreateDashboardDataModel> captor =
        ArgumentCaptor.forClass(CreateDashboardDataModel.class);
    verify(service).create(captor.capture());

    CreateDashboardDataModel posted = captor.getValue();
    assertInstanceOf(CreateDashboardDataModel.class, posted);
    assertEquals(NAME, posted.getName());
    assertEquals(SERVICE, posted.getService());
    assertEquals(MODEL_TYPE, posted.getDataModelType());
    assertEquals(COLUMNS, posted.getColumns());
    assertEquals("A test data model", posted.getDescription());
    assertEquals("Dm Test", posted.getDisplayName());

    // The entity-level overload must never be invoked.
    verify(service, never()).create(any(DashboardDataModel.class));
  }

  @Test
  void createOrUpdateUpsertsCreateDashboardDataModelRequestNotEntity() {
    OpenMetadataClient client = mockClient();
    DashboardDataModelService service = client.dashboardDataModels();

    DashboardDataModel expected = new DashboardDataModel();
    expected.setId(UUID.randomUUID());
    expected.setName(NAME);
    when(service.upsert(any(CreateDashboardDataModel.class))).thenReturn(expected);

    DashboardDataModel result =
        new DashboardDataModelBuilder(client)
            .name(NAME)
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(COLUMNS)
            .createOrUpdate();

    assertSame(expected, result);

    ArgumentCaptor<CreateDashboardDataModel> captor =
        ArgumentCaptor.forClass(CreateDashboardDataModel.class);
    verify(service).upsert(captor.capture());

    CreateDashboardDataModel posted = captor.getValue();
    assertInstanceOf(CreateDashboardDataModel.class, posted);
    assertEquals(NAME, posted.getName());
    assertEquals(SERVICE, posted.getService());
    assertEquals(MODEL_TYPE, posted.getDataModelType());
    assertEquals(COLUMNS, posted.getColumns());

    // The entity-level upsert(T) must never be invoked.
    verify(service, never()).upsert(any(DashboardDataModel.class));
  }

  @Test
  void createPostsTheExactRequestReturnedByBuild() {
    OpenMetadataClient client = mockClient();
    DashboardDataModelService service = client.dashboardDataModels();
    when(service.create(any(CreateDashboardDataModel.class))).thenReturn(new DashboardDataModel());

    DashboardDataModelBuilder builder =
        new DashboardDataModelBuilder(client)
            .name(NAME)
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(COLUMNS);

    CreateDashboardDataModel built = builder.build();
    builder.create();

    ArgumentCaptor<CreateDashboardDataModel> captor =
        ArgumentCaptor.forClass(CreateDashboardDataModel.class);
    verify(service).create(captor.capture());
    assertSame(built, captor.getValue());
  }

  @Test
  void requiredSettersPropagateToBuildRequest() {
    CreateDashboardDataModel request =
        new DashboardDataModelBuilder(null)
            .name(NAME)
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(COLUMNS)
            .build();

    assertEquals(NAME, request.getName());
    assertEquals(SERVICE, request.getService());
    assertEquals(MODEL_TYPE, request.getDataModelType());
    assertEquals(COLUMNS, request.getColumns());
  }

  @Test
  void columnsVarargsPropagateToBuildRequest() {
    Column first = new Column().withName("id").withDataType(ColumnDataType.INT);
    Column second = new Column().withName("name").withDataType(ColumnDataType.VARCHAR);

    CreateDashboardDataModel request =
        new DashboardDataModelBuilder(null)
            .name(NAME)
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(first, second)
            .build();

    assertEquals(List.of(first, second), request.getColumns());
  }

  @Test
  void buildRequiresName() {
    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class, () -> new DashboardDataModelBuilder(null).build());
    assertEquals("DashboardDataModel name is required", ex.getMessage());
  }

  @Test
  void buildRequiresService() {
    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class,
            () ->
                new DashboardDataModelBuilder(null)
                    .name(NAME)
                    .dataModelType(MODEL_TYPE)
                    .columns(COLUMNS)
                    .build());
    assertEquals("DashboardDataModel service is required", ex.getMessage());
  }

  @Test
  void buildRequiresDataModelType() {
    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class,
            () ->
                new DashboardDataModelBuilder(null)
                    .name(NAME)
                    .service(SERVICE)
                    .columns(COLUMNS)
                    .build());
    assertEquals("DashboardDataModel dataModelType is required", ex.getMessage());
  }

  @Test
  void buildRequiresColumns() {
    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class,
            () ->
                new DashboardDataModelBuilder(null)
                    .name(NAME)
                    .service(SERVICE)
                    .dataModelType(MODEL_TYPE)
                    .build());
    assertEquals("DashboardDataModel columns is required", ex.getMessage());
  }

  @Test
  void createValidatesRequiredFieldsBeforeCallingTheService() {
    // With a real (mocked) client, build() must reject a missing required field before the
    // service is invoked, so the builder surfaces a clear error rather than a doomed HTTP call.
    OpenMetadataClient client = mockClient();
    DashboardDataModelService service = client.dashboardDataModels();

    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class,
            () -> new DashboardDataModelBuilder(client).name(NAME).create());
    assertEquals("DashboardDataModel service is required", ex.getMessage());
    verifyNoInteractions(service);
  }

  @Test
  void emptyColumnsListIsAcceptedAsRequiredField() {
    // The schema marks columns as required (present); an empty list must satisfy build().
    CreateDashboardDataModel request =
        new DashboardDataModelBuilder(null)
            .name(NAME)
            .service(SERVICE)
            .dataModelType(MODEL_TYPE)
            .columns(List.of())
            .build();
    assertNotNull(request.getColumns());
    assertNull(request.getExtension());
  }
}
