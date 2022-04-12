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

package org.openmetadata.catalog.resources.services;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.getPrincipal;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.services.dashboard.DashboardServiceResource.DashboardServiceList;
import org.openmetadata.catalog.services.connections.dashboard.SupersetConnection;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.DashboardConnection;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;

@Slf4j
public class DashboardServiceResourceTest extends EntityResourceTest<DashboardService, CreateDashboardService> {
  public DashboardServiceResourceTest() {
    super(
        Entity.DASHBOARD_SERVICE,
        DashboardService.class,
        DashboardServiceList.class,
        "services/dashboardServices",
        "owner");
    this.supportsPatch = false;
    this.supportsAuthorizedMetadataOperations = false;
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create dashboard with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[serviceType must not be null]");

    // Create dashboard with mandatory dashboardUrl field empty
    assertResponse(
        () -> createEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[connection must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException, URISyntaxException {
    // Create dashboard service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    SupersetConnection supersetConnection =
        new SupersetConnection()
            .withSupersetURL(new URI("http://localhost:8080"))
            .withUsername("user")
            .withPassword("password");
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
    createAndCheckEntity(
        createRequest(test, 3).withConnection(new DashboardConnection().withConfig(supersetConnection)), authHeaders);
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException, URISyntaxException {
    DashboardConnection dashboardConnection =
        new DashboardConnection()
            .withConfig(
                new SupersetConnection()
                    .withSupersetURL(new URI("http://localhost:8080"))
                    .withUsername("user")
                    .withPassword("password"));
    DashboardService service =
        createAndCheckEntity(
            createRequest(test).withDescription(null).withConnection(dashboardConnection), ADMIN_AUTH_HEADERS);

    // Update dashboard description and ingestion service that are null
    DashboardConnection dashboardConnection1 =
        new DashboardConnection()
            .withConfig(
                new SupersetConnection()
                    .withSupersetURL(new URI("http://localhost:9000"))
                    .withUsername("user1")
                    .withPassword("password1"));

    CreateDashboardService update =
        createRequest(test).withDescription("description1").withConnection(dashboardConnection1);

    ChangeDescription change = getChangeDescription(service.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("description1"));
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("connection")
                .withOldValue(dashboardConnection)
                .withNewValue(dashboardConnection1));
    service = updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Override
  public CreateDashboardService createRequest(
      String name, String description, String displayName, EntityReference owner) {
    try {
      return new CreateDashboardService()
          .withName(name)
          .withServiceType(CreateDashboardService.DashboardServiceType.Superset)
          .withConnection(
              new DashboardConnection()
                  .withConfig(
                      new SupersetConnection()
                          .withSupersetURL(new URI("http://localhost:8080"))
                          .withUsername("admin")
                          .withPassword("admin")))
          .withOwner(owner)
          .withDescription(description);
    } catch (URISyntaxException e) {
      e.printStackTrace();
    }
    return null;
  }

  @Override
  public void validateCreatedEntity(
      DashboardService service, CreateDashboardService createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(service),
        createRequest.getDescription(),
        getPrincipal(authHeaders),
        createRequest.getOwner());
    assertEquals(createRequest.getName(), service.getName());
    DashboardConnection expectedConnection = createRequest.getConnection();
    DashboardConnection actualConnection = service.getConnection();
    validateConnection(expectedConnection, actualConnection, service.getServiceType());
  }

  @Override
  public void compareEntities(DashboardService expected, DashboardService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public EntityInterface<DashboardService> getEntityInterface(DashboardService entity) {
    return new DashboardServiceEntityInterface(entity);
  }

  @Override
  public EntityInterface<DashboardService> validateGetWithDifferentFields(DashboardService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwner());

    fields = "owner";
    service =
        byName
            ? getEntityByName(service.getName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return getEntityInterface(service);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (fieldName.equals("connection")) {
      DashboardConnection expectedDashboardConnection = (DashboardConnection) expected;
      DashboardConnection actualDashboardConnection = JsonUtils.readValue((String) actual, DashboardConnection.class);
      actualDashboardConnection.setConfig(
          JsonUtils.convertValue(actualDashboardConnection.getConfig(), SupersetConnection.class));
      assertEquals(expectedDashboardConnection, actualDashboardConnection);
    } else {
      super.assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      DashboardConnection expectedDashboardConnection,
      DashboardConnection actualDashboardConnection,
      CreateDashboardService.DashboardServiceType dashboardServiceType) {
    if (expectedDashboardConnection != null) {
      if (dashboardServiceType == CreateDashboardService.DashboardServiceType.Superset) {
        SupersetConnection expectedSupersetConnection = (SupersetConnection) expectedDashboardConnection.getConfig();
        SupersetConnection actualSupersetConnection;
        if (actualDashboardConnection.getConfig() instanceof SupersetConnection) {
          actualSupersetConnection = (SupersetConnection) actualDashboardConnection.getConfig();
        } else {
          actualSupersetConnection =
              JsonUtils.convertValue(actualDashboardConnection.getConfig(), SupersetConnection.class);
        }
        assertEquals(expectedSupersetConnection.getSupersetURL(), actualSupersetConnection.getSupersetURL());
        assertEquals(expectedSupersetConnection.getUsername(), actualSupersetConnection.getUsername());
        assertEquals(expectedSupersetConnection.getPassword(), actualSupersetConnection.getPassword());
        assertEquals(expectedSupersetConnection.getProvider(), actualSupersetConnection.getProvider());
      }
    }
  }
}
