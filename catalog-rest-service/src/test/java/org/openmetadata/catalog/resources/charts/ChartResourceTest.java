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

package org.openmetadata.catalog.resources.charts;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateChart;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.api.services.CreateDashboardService.DashboardServiceType;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartEntityInterface;
import org.openmetadata.catalog.jdbi3.DashboardServiceRepository.DashboardServiceEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.charts.ChartResource.ChartList;
import org.openmetadata.catalog.resources.services.DashboardServiceResourceTest;
import org.openmetadata.catalog.type.ChartType;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

public class ChartResourceTest extends EntityResourceTest<Chart> {
  public static EntityReference SUPERSET_REFERENCE;
  public static EntityReference LOOKER_REFERENCE;

  public ChartResourceTest() {
    super(Entity.CHART, Chart.class, ChartList.class, "charts", ChartResource.FIELDS, true, true, true);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);

    CreateDashboardService createService =
        new CreateDashboardService()
            .withName("superset")
            .withServiceType(DashboardServiceType.Superset)
            .withDashboardUrl(new URI("http://localhost:0"));
    DashboardService service = new DashboardServiceResourceTest().createEntity(createService, adminAuthHeaders());
    SUPERSET_REFERENCE = new DashboardServiceEntityInterface(service).getEntityReference();

    createService
        .withName("looker")
        .withServiceType(DashboardServiceType.Looker)
        .withDashboardUrl(new URI("http://localhost:0"));
    service = new DashboardServiceResourceTest().createEntity(createService, adminAuthHeaders());
    LOOKER_REFERENCE = new DashboardServiceEntityInterface(service).getEntityReference();
  }

  @Test
  public void post_validCharts_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateChart create =
        create(test)
            .withService(
                new EntityReference().withId(SUPERSET_REFERENCE.getId()).withType(SUPERSET_REFERENCE.getType()));
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getEntityName(test, 1)).withDescription("description");
    Chart chart = createAndCheckEntity(create, adminAuthHeaders());
    String expectedFQN = SUPERSET_REFERENCE.getName() + "." + chart.getName();
    assertEquals(expectedFQN, chart.getFullyQualifiedName());
  }

  @Test
  public void post_chartWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_chartWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1).withDisplayName("chart1"), adminAuthHeaders());
  }

  @Test
  public void post_chart_as_non_admin_401(TestInfo test) {
    CreateChart create = create(test);
    assertResponse(
        () -> createEntity(create, authHeaders("test@open-metadata.org")),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_chartWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    assertResponse(
        () -> createEntity(create(test).withService(null), adminAuthHeaders()),
        BAD_REQUEST,
        "[service must not be null]");
  }

  @Test
  public void post_chartWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {SUPERSET_REFERENCE, LOOKER_REFERENCE};

    // Create chart for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(create(test).withService(service), adminAuthHeaders());

      // List charts by filtering on service name and ensure right charts in the response
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("service", service.getName());
            }
          };
      ResultList<Chart> list = listEntities(queryParams, adminAuthHeaders());
      for (Chart chart : list.getData()) {
        assertEquals(service.getName(), chart.getService().getName());
      }
    }
  }

  @Test
  public void delete_emptyChart_200_ok(TestInfo test) throws HttpResponseException {
    Chart chart = createEntity(create(test), adminAuthHeaders());
    deleteEntity(chart.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyChart_4xx() {
    // TODO
  }

  /** Validate returned fields GET .../charts/{id}?fields="..." or GET .../charts/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Chart chart, boolean byName) throws HttpResponseException {
    // .../charts?fields=owner
    String fields = "owner";
    chart =
        byName
            ? getEntityByName(chart.getFullyQualifiedName(), fields, adminAuthHeaders())
            : getEntity(chart.getId(), fields, adminAuthHeaders());
    assertListNotNull(chart.getOwner(), chart.getService(), chart.getServiceType());
  }

  private CreateChart create(TestInfo test) {
    return create(getEntityName(test));
  }

  public CreateChart create(TestInfo test, int index) {
    return create(getEntityName(test, index));
  }

  public CreateChart create(String entityName) {
    return new CreateChart().withName(entityName).withService(SUPERSET_REFERENCE).withChartType(ChartType.Area);
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withDisplayName(displayName).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Chart chart, Object request, Map<String, String> authHeaders) {
    CreateChart createRequest = (CreateChart) request;
    validateCommonEntityFields(
        getEntityInterface(chart),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertNotNull(chart.getServiceType());
    assertService(createRequest.getService(), chart.getService());
  }

  @Override
  public void validateUpdatedEntity(Chart updatedEntity, Object request, Map<String, String> authHeaders) {
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  @Override
  public void compareEntities(Chart expected, Chart patched, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(patched),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());
    assertService(expected.getService(), patched.getService());
  }

  @Override
  public EntityInterface<Chart> getEntityInterface(Chart chart) {
    return new ChartEntityInterface(chart);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
