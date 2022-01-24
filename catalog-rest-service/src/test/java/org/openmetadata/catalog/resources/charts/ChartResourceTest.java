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
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateChart;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.charts.ChartResource.ChartList;
import org.openmetadata.catalog.type.ChartType;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class ChartResourceTest extends EntityResourceTest<Chart, CreateChart> {

  public ChartResourceTest() {
    super(Entity.CHART, Chart.class, ChartList.class, "charts", ChartResource.FIELDS, true, true, true, true);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
  }

  @Test
  void post_validCharts_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateChart create = createRequest(test).withService(SUPERSET_REFERENCE);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    Chart chart = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    String expectedFQN = SUPERSET_REFERENCE.getName() + "." + chart.getName();
    assertEquals(expectedFQN, chart.getFullyQualifiedName());
  }

  @Test
  void post_chartWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withOwner(USER_OWNER1), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_chartWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withOwner(TEAM_OWNER1).withDisplayName("chart1"), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_chart_as_non_admin_401(TestInfo test) {
    CreateChart create = createRequest(test);
    assertResponse(
        () -> createEntity(create, TEST_AUTH_HEADERS),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void post_chartWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    assertResponse(
        () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[service must not be null]");
  }

  @Test
  void post_chartWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {SUPERSET_REFERENCE, LOOKER_REFERENCE};

    // Create chart for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List charts by filtering on service name and ensure right charts in the response
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("service", service.getName());
            }
          };
      ResultList<Chart> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Chart chart : list.getData()) {
        assertEquals(service.getName(), chart.getService().getName());
      }
    }
  }

  @Test
  void delete_nonEmptyChart_4xx() {
    // TODO
  }

  /** Validate returned fields GET .../charts/{id}?fields="..." or GET .../charts/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Chart chart, boolean byName) throws HttpResponseException {
    // .../charts?fields=owner
    String fields = "owner";
    chart =
        byName
            ? getEntityByName(chart.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(chart.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(chart.getOwner(), chart.getService(), chart.getServiceType());
  }

  @Override
  public CreateChart createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateChart()
        .withName(name)
        .withDescription(description)
        .withDisplayName(displayName)
        .withOwner(owner)
        .withService(SUPERSET_REFERENCE)
        .withChartType(ChartType.Area);
  }

  @Override
  public EntityReference getContainer(CreateChart createRequest) {
    return createRequest.getService();
  }

  @Override
  public void validateCreatedEntity(Chart chart, CreateChart createRequest, Map<String, String> authHeaders) {
    validateCommonEntityFields(
        getEntityInterface(chart),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertNotNull(chart.getServiceType());
    assertService(createRequest.getService(), chart.getService());
  }

  @Override
  public void validateUpdatedEntity(Chart updatedEntity, CreateChart request, Map<String, String> authHeaders) {
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
