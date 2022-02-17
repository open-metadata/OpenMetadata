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

package org.openmetadata.catalog.resources.dashboards;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.invalidServiceEntity;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateDashboard;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.jdbi3.DashboardRepository.DashboardEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.dashboards.DashboardResource.DashboardList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class DashboardResourceTest extends EntityResourceTest<Dashboard, CreateDashboard> {
  public static EntityReference SUPERSET_INVALID_SERVICE_REFERENCE;

  public DashboardResourceTest() {
    super(
        Entity.DASHBOARD,
        Dashboard.class,
        DashboardList.class,
        "dashboards",
        DashboardResource.FIELDS,
        true,
        true,
        true,
        true,
        true);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);

    SUPERSET_INVALID_SERVICE_REFERENCE =
        new EntityReference()
            .withName("invalid_superset_service")
            .withId(SUPERSET_REFERENCE.getId())
            .withType("DashboardService1");
  }

  @Test
  void post_validDashboards_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateDashboard create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_DashboardWithCharts_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withCharts(CHART_REFERENCES), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_DashboardWithoutRequiredService_4xx(TestInfo test) {
    CreateDashboard create = createRequest(test).withService(null);
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_DashboardWithInvalidService_4xx(TestInfo test) {
    CreateDashboard create = createRequest(test).withService(SUPERSET_INVALID_SERVICE_REFERENCE);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        invalidServiceEntity(SUPERSET_INVALID_SERVICE_REFERENCE.getType(), Entity.DASHBOARD, Entity.DASHBOARD_SERVICE));
  }

  @Test
  void post_DashboardWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {SUPERSET_REFERENCE, LOOKER_REFERENCE};

    // Create Dashboard for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(
          createRequest(test).withService(new EntityReference().withId(service.getId()).withType(service.getType())),
          ADMIN_AUTH_HEADERS);
      // List Dashboards by filtering on service name and ensure right Dashboards in the response
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("service", service.getName());
            }
          };
      ResultList<Dashboard> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Dashboard db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
        String expectedFQN = service.getName() + "." + db.getName();
        assertEquals(expectedFQN, db.getFullyQualifiedName());
      }
    }
  }

  @Test
  void put_DashboardChartsUpdate_200(TestInfo test) throws IOException {
    CreateDashboard request = createRequest(test).withDescription(null).withCharts(null);
    Dashboard dashboard = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add description, and charts
    List<FieldChange> fields = new ArrayList<>();
    fields.add(new FieldChange().withName("description").withNewValue("newDescription"));
    fields.add(new FieldChange().withName("charts").withNewValue(CHART_REFERENCES));
    ChangeDescription change = getChangeDescription(dashboard.getVersion()).withFieldsAdded(fields);
    updateAndCheckEntity(
        request.withDescription("newDescription").withCharts(CHART_REFERENCES),
        OK,
        ADMIN_AUTH_HEADERS,
        MINOR_UPDATE,
        change);
  }

  @Test
  void put_AddRemoveDashboardChartsUpdate_200(TestInfo test) throws IOException {
    CreateDashboard request = createRequest(test).withDescription(null).withCharts(null);
    Dashboard dashboard = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add charts
    FieldChange charts = new FieldChange().withName("charts").withNewValue(CHART_REFERENCES);
    ChangeDescription change = getChangeDescription(dashboard.getVersion()).withFieldsAdded(singletonList(charts));
    dashboard =
        updateAndCheckEntity(request.withCharts(CHART_REFERENCES), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    validateDashboardCharts(dashboard, CHART_REFERENCES);

    // remove a chart
    charts = new FieldChange().withName("charts").withOldValue(List.of(CHART_REFERENCES.get(0)));
    CHART_REFERENCES.remove(0);
    change = getChangeDescription(dashboard.getVersion()).withFieldsDeleted(singletonList(charts));
    updateAndCheckEntity(request.withCharts(CHART_REFERENCES), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void delete_nonEmptyDashboard_4xx() {
    // TODO
  }

  /** Validate returned fields GET .../dashboards/{id}?fields="..." or GET .../dashboards/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Dashboard dashboard, boolean byName) throws HttpResponseException {
    // .../Dashboards?fields=owner
    String fields = "owner";
    dashboard =
        byName
            ? getEntityByName(dashboard.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dashboard.getId(), fields, ADMIN_AUTH_HEADERS);
    // We always return the service
    assertListNotNull(dashboard.getOwner(), dashboard.getService(), dashboard.getServiceType());
    assertListNull(dashboard.getCharts(), dashboard.getUsageSummary());

    // .../Dashboards?fields=owner,service,tables
    fields = "owner,charts,usageSummary";
    dashboard =
        byName
            ? getEntityByName(dashboard.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dashboard.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(
        dashboard.getOwner(),
        dashboard.getService(),
        dashboard.getServiceType(),
        dashboard.getCharts(),
        dashboard.getUsageSummary());
    TestUtils.validateEntityReference(dashboard.getCharts());
  }

  private static void validateDashboardCharts(Dashboard dashboard, List<EntityReference> expectedCharts) {
    if (expectedCharts != null) {
      List<UUID> expectedChartReferences =
          expectedCharts.stream().map(EntityReference::getId).collect(Collectors.toList());
      List<UUID> actualChartReferences = new ArrayList<>();
      assertNotNull(dashboard.getCharts(), "dashboard should have charts");
      dashboard
          .getCharts()
          .forEach(
              chart -> {
                TestUtils.validateEntityReference(chart);
                actualChartReferences.add(chart.getId());
              });
      assertEquals(expectedChartReferences.size(), actualChartReferences.size());
      assertTrue(actualChartReferences.containsAll(expectedChartReferences));
    }
  }

  @Override
  public CreateDashboard createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateDashboard()
        .withName(name)
        .withService(SUPERSET_REFERENCE)
        .withCharts(CHART_REFERENCES)
        .withDescription(description)
        .withDisplayName(displayName)
        .withOwner(owner);
  }

  @Override
  public EntityReference getContainer(CreateDashboard createRequest) {
    return createRequest.getService();
  }

  @Override
  public void validateCreatedEntity(Dashboard dashboard, CreateDashboard createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(dashboard),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertNotNull(dashboard.getServiceType());
    assertService(createRequest.getService(), dashboard.getService());
    validateDashboardCharts(dashboard, createRequest.getCharts());
    TestUtils.validateTags(createRequest.getTags(), dashboard.getTags());
  }

  @Override
  public void validateUpdatedEntity(Dashboard dashboard, CreateDashboard request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(dashboard, request, authHeaders);
  }

  @Override
  public void compareEntities(Dashboard expected, Dashboard updated, Map<String, String> authHeaders) {}

  @Override
  public EntityInterface<Dashboard> getEntityInterface(Dashboard entity) {
    return new DashboardEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == null && actual == null) {
      return;
    }
    if (fieldName.contains("charts")) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefs = (List<EntityReference>) expected;
      List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertEntityReferencesFieldChange(expectedRefs, actualRefs);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
