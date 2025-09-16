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

package org.openmetadata.service.resources.services;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.services.connections.dashboard.LookerConnection;
import org.openmetadata.schema.services.connections.dashboard.MetabaseConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.charts.ChartResourceTest;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.services.dashboard.DashboardServiceResource;
import org.openmetadata.service.resources.services.dashboard.DashboardServiceResource.DashboardServiceList;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class DashboardServiceResourceTest
    extends ServiceResourceTest<DashboardService, CreateDashboardService> {
  public DashboardServiceResourceTest() {
    super(
        Entity.DASHBOARD_SERVICE,
        DashboardService.class,
        DashboardServiceList.class,
        "services/dashboardServices",
        DashboardServiceResource.FIELDS);
    this.supportsPatch = false;
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create dashboard with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param serviceType must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException, URISyntaxException {
    // Create dashboard service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    MetabaseConnection metabaseConnection =
        new MetabaseConnection()
            .withHostPort(new URI("http://localhost:8080"))
            .withUsername("user")
            .withPassword("password");
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
    createAndCheckEntity(
        createRequest(test, 3)
            .withConnection(new DashboardConnection().withConfig(metabaseConnection)),
        authHeaders);

    // We can create the service without connection
    createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException, URISyntaxException {
    String password = "test12";
    DashboardConnection dashboardConnection =
        new DashboardConnection()
            .withConfig(
                new MetabaseConnection()
                    .withHostPort(new URI("http://localhost:8080"))
                    .withUsername("user")
                    .withPassword(password));
    DashboardService service =
        createAndCheckEntity(
            createRequest(test).withDescription(null).withConnection(dashboardConnection),
            ADMIN_AUTH_HEADERS);

    // Update dashboard description and ingestion service that are null
    DashboardConnection dashboardConnection1 =
        new DashboardConnection()
            .withConfig(
                new MetabaseConnection()
                    .withHostPort(new URI("http://localhost:9000"))
                    .withUsername("user1")
                    .withPassword(password));

    CreateDashboardService update =
        createRequest(test)
            .withDescription("description1")
            .withConnection(dashboardConnection1)
            .withName(service.getName());

    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldAdded(change, "description", "description1");
    fieldUpdated(change, "connection", dashboardConnection, dashboardConnection1);
    DashboardService updatedService =
        updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    validateConnection(
        update.getConnection(),
        updatedService.getConnection(),
        updatedService.getServiceType(),
        ADMIN_AUTH_HEADERS);
    change = getChangeDescription(updatedService, MINOR_UPDATE);
    updatedService = getEntity(service.getId(), TEST_AUTH_HEADERS);
    assertNotNull(updatedService.getConnection());
    assertNotNull(
        JsonUtils.readValue(
                JsonUtils.pojoToJson(updatedService.getConnection().getConfig()),
                MetabaseConnection.class)
            .getHostPort());
    assertNotNull(
        JsonUtils.readValue(
                JsonUtils.pojoToJson(updatedService.getConnection().getConfig()),
                MetabaseConnection.class)
            .getUsername());
    MetabaseConnection metabaseConnection =
        new MetabaseConnection()
            .withHostPort(new URI("http://localhost:8080"))
            .withUsername("user")
            .withPassword(password);
    DashboardConnection dashboardConnection2 =
        new DashboardConnection().withConfig(metabaseConnection);
    update =
        createRequest(test)
            .withDescription("description1")
            .withConnection(dashboardConnection2)
            .withName(service.getName());

    fieldUpdated(change, "connection", dashboardConnection1, dashboardConnection2);
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    updatedService = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    validateConnection(
        dashboardConnection2,
        updatedService.getConnection(),
        updatedService.getServiceType(),
        ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_testConnectionResult_200(TestInfo test) throws IOException {
    DashboardService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // By default, we have no result logged in
    assertNull(service.getTestConnectionResult());
    DashboardService updatedService =
        putTestConnectionResult(service.getId(), TEST_CONNECTION_RESULT, ADMIN_AUTH_HEADERS);
    // Validate that the data got properly stored
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL,
        updatedService.getTestConnectionResult().getStatus());
    assertEquals(updatedService.getConnection(), service.getConnection());
    // Check that the stored data is also correct
    DashboardService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
    assertEquals(stored.getConnection(), service.getConnection());
  }

  public DashboardService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, DashboardService.class, OK, authHeaders);
  }

  @Override
  public CreateDashboardService createRequest(String name) {
    return new CreateDashboardService()
        .withName(name)
        .withServiceType(DashboardServiceType.Metabase)
        .withConnection(
            new DashboardConnection()
                .withConfig(
                    new MetabaseConnection()
                        .withHostPort(CommonUtil.getUri("http://localhost:8080"))
                        .withUsername("admin")
                        .withPassword("admin")));
  }

  @Override
  public void validateCreatedEntity(
      DashboardService service,
      CreateDashboardService createRequest,
      Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    DashboardConnection expectedConnection = createRequest.getConnection();
    DashboardConnection actualConnection = service.getConnection();
    validateConnection(expectedConnection, actualConnection, service.getServiceType(), authHeaders);
  }

  @Override
  public void compareEntities(
      DashboardService expected, DashboardService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public DashboardService validateGetWithDifferentFields(DashboardService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwners());

    fields = "owners,tags,followers";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owners, tags, and followers is done in the base class
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("connection")) {
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      DashboardConnection expectedDashboardConnection,
      DashboardConnection actualDashboardConnection,
      DashboardServiceType dashboardServiceType,
      Map<String, String> authHeaders) {
    if (expectedDashboardConnection != null && actualDashboardConnection != null) {
      if (dashboardServiceType == DashboardServiceType.Metabase) {
        MetabaseConnection expectedmetabaseConnection =
            (MetabaseConnection) expectedDashboardConnection.getConfig();
        MetabaseConnection actualMetabaseConnection;
        if (actualDashboardConnection.getConfig() instanceof MetabaseConnection) {
          actualMetabaseConnection = (MetabaseConnection) actualDashboardConnection.getConfig();
        } else {
          actualMetabaseConnection =
              JsonUtils.convertValue(
                  actualDashboardConnection.getConfig(), MetabaseConnection.class);
        }
        assertEquals(
            expectedmetabaseConnection.getHostPort(), actualMetabaseConnection.getHostPort());
        assertEquals(
            expectedmetabaseConnection.getUsername(), actualMetabaseConnection.getUsername());
        if (INGESTION_BOT_AUTH_HEADERS.equals(authHeaders)) {
          assertEquals(
              expectedmetabaseConnection.getPassword(), actualMetabaseConnection.getPassword());
        } else {
          assertEquals(PasswordEntityMasker.PASSWORD_MASK, actualMetabaseConnection.getPassword());
        }
      }
    }
  }

  public void setupDashboardServices(TestInfo test)
      throws HttpResponseException, URISyntaxException {
    DashboardServiceResourceTest dashboardServiceResourceTest = new DashboardServiceResourceTest();
    DashboardResourceTest dashboardResourceTest = new DashboardResourceTest();
    CreateDashboardService createDashboardService =
        dashboardServiceResourceTest
            .createRequest("superset", "", "", null)
            .withServiceType(DashboardServiceType.Metabase);
    DashboardConnection dashboardConnection =
        new DashboardConnection()
            .withConfig(
                new MetabaseConnection()
                    .withHostPort(new URI("http://localhost:8080"))
                    .withPassword("test")
                    .withUsername("admin"));
    createDashboardService
        .withConnection(dashboardConnection)
        .withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    DashboardService dashboardService =
        new DashboardServiceResourceTest().createEntity(createDashboardService, ADMIN_AUTH_HEADERS);
    METABASE_REFERENCE = dashboardService.getEntityReference();

    CreateDashboardService lookerDashboardService =
        dashboardServiceResourceTest
            .createRequest("looker", "", "", null)
            .withServiceType(DashboardServiceType.Looker);
    DashboardConnection lookerConnection =
        new DashboardConnection()
            .withConfig(
                new LookerConnection()
                    .withHostPort(new URI("http://localhost:8080"))
                    .withClientId("test")
                    .withClientSecret("test"));
    lookerDashboardService.withConnection(lookerConnection);
    dashboardService =
        new DashboardServiceResourceTest().createEntity(lookerDashboardService, ADMIN_AUTH_HEADERS);
    LOOKER_REFERENCE = dashboardService.getEntityReference();
    CHART_REFERENCES = new ArrayList<>();
    ChartResourceTest chartResourceTest = new ChartResourceTest();
    for (int i = 0; i < 3; i++) {
      CreateChart createChart =
          chartResourceTest.createRequest(test, i).withService(METABASE_REFERENCE.getName());
      Chart chart = chartResourceTest.createEntity(createChart, ADMIN_AUTH_HEADERS);
      CHART_REFERENCES.add(chart.getFullyQualifiedName());
    }
    DASHBOARD_REFERENCES = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreateDashboard createDashboard1 =
          dashboardResourceTest
              .createRequest("dashboard" + i, "", "", null)
              .withService(METABASE_REFERENCE.getName());
      createDashboard1.withDomains(List.of(DOMAIN.getFullyQualifiedName()));
      Dashboard dashboard1 =
          new DashboardResourceTest().createEntity(createDashboard1, ADMIN_AUTH_HEADERS);
      DASHBOARD_REFERENCES.add(dashboard1.getFullyQualifiedName());
    }
  }
}
