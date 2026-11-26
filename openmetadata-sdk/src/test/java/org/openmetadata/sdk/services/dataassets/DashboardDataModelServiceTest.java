package org.openmetadata.sdk.services.dataassets;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Direct unit coverage for {@link DashboardDataModelService}, asserting the request-typed
 * {@code create} and {@code upsert} overloads issue POST/PUT to {@code /v1/dashboard/datamodels}
 * with the {@link CreateDashboardDataModel} body verbatim (no entity-conversion in between). The
 * {@code upsert(CreateDashboardDataModel)} overload was added alongside the
 * {@code DashboardDataModelBuilder.createOrUpdate()} fix.
 */
class DashboardDataModelServiceTest {

  private static CreateDashboardDataModel request() {
    return new CreateDashboardDataModel()
        .withName("dm")
        .withService("superset")
        .withDataModelType(DataModelType.SupersetDataModel)
        .withColumns(List.of(new Column().withName("id")));
  }

  @Test
  void createPostsCreateRequestToDataModelsEndpoint() {
    HttpClient httpClient = mock(HttpClient.class);
    CreateDashboardDataModel request = request();
    DashboardDataModel expected = new DashboardDataModel().withName("dm");

    when(httpClient.execute(
            eq(HttpMethod.POST),
            eq("/v1/dashboard/datamodels"),
            eq(request),
            eq(DashboardDataModel.class)))
        .thenReturn(expected);

    DashboardDataModel result = new DashboardDataModelService(httpClient).create(request);

    assertSame(expected, result);
    verify(httpClient)
        .execute(
            eq(HttpMethod.POST),
            eq("/v1/dashboard/datamodels"),
            eq(request),
            eq(DashboardDataModel.class));
  }

  @Test
  void upsertPutsCreateRequestToDataModelsEndpoint() {
    HttpClient httpClient = mock(HttpClient.class);
    CreateDashboardDataModel request = request();
    DashboardDataModel expected = new DashboardDataModel().withName("dm");

    when(httpClient.execute(
            eq(HttpMethod.PUT),
            eq("/v1/dashboard/datamodels"),
            eq(request),
            eq(DashboardDataModel.class)))
        .thenReturn(expected);

    DashboardDataModel result = new DashboardDataModelService(httpClient).upsert(request);

    assertSame(expected, result);
    verify(httpClient)
        .execute(
            eq(HttpMethod.PUT),
            eq("/v1/dashboard/datamodels"),
            eq(request),
            eq(DashboardDataModel.class));
  }
}
