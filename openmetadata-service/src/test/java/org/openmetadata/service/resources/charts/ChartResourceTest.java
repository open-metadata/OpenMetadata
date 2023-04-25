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

package org.openmetadata.service.resources.charts;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.charts.ChartResource.ChartList;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils.UpdateType;

@Slf4j
public class ChartResourceTest extends EntityResourceTest<Chart, CreateChart> {

  public ChartResourceTest() {
    super(Entity.CHART, Chart.class, ChartList.class, "charts", ChartResource.FIELDS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_chartWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    assertResponse(
        () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[service must not be null]");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_chartWithDifferentService_200_ok(TestInfo test) throws IOException {
    String[] differentServices = {METABASE_REFERENCE.getName(), LOOKER_REFERENCE.getName()};

    // Create chart for each service and test APIs
    for (String service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List charts by filtering on service name and ensure right charts in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service);
      ResultList<Chart> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Chart chart : list.getData()) {
        assertEquals(service, chart.getService().getName());
      }
    }
  }

  @Test
  void update_chart_200(TestInfo test) throws IOException {
    ChartType type1 = ChartType.Bar;
    ChartType type2 = ChartType.Line;

    // Create with no url, description and chart type.
    CreateChart request =
        createRequest(test)
            .withService(METABASE_REFERENCE.getName())
            .withChartUrl(null)
            .withDescription(null)
            .withChartType(null);
    Chart chart = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Set url, description and chart type.
    ChangeDescription change = getChangeDescription(chart.getVersion());
    chart.withChartType(type1).withChartUrl("url1").withDescription("desc1");
    fieldAdded(change, "description", "desc1");
    fieldAdded(change, "chartType", type1);
    fieldAdded(change, "chartUrl", "url1");

    chart =
        updateAndCheckEntity(
            request.withDescription("desc1").withChartType(type1).withChartUrl("url1"),
            OK,
            ADMIN_AUTH_HEADERS,
            UpdateType.MINOR_UPDATE,
            change);

    // Update description, chartType and chart url and verify update
    change = getChangeDescription(chart.getVersion());
    chart.withChartType(type2).withChartUrl("url2").withDescription("desc2");

    fieldUpdated(change, "description", "desc1", "desc2");
    fieldUpdated(change, "chartType", type1, type2);
    fieldUpdated(change, "chartUrl", "url1", "url2");

    updateAndCheckEntity(
        request.withDescription("desc2").withChartType(type2).withChartUrl("url2"),
        OK,
        ADMIN_AUTH_HEADERS,
        UpdateType.MINOR_UPDATE,
        change);
  }

  @Test
  void patch_chart_200(TestInfo test) throws IOException {
    ChartType type1 = ChartType.Bar;
    ChartType type2 = ChartType.Line;

    // Create with no url, description and chart type.
    CreateChart request =
        createRequest(test)
            .withService(METABASE_REFERENCE.getName())
            .withChartUrl(null)
            .withDescription(null)
            .withChartType(null);
    Chart chart = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(chart);

    // Set url, description and chart type.
    ChangeDescription change = getChangeDescription(chart.getVersion());
    chart.withChartType(type1).withChartUrl("url1").withDescription("desc1");
    fieldAdded(change, "description", "desc1");
    fieldAdded(change, "chartType", type1);
    fieldAdded(change, "chartUrl", "url1");

    chart = patchEntityAndCheck(chart, originalJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);

    // Update description, chartType and chart url and verify patch
    originalJson = JsonUtils.pojoToJson(chart);
    change = getChangeDescription(chart.getVersion());
    fieldUpdated(change, "description", "desc1", "desc2");
    fieldUpdated(change, "chartType", type1, type2);
    fieldUpdated(change, "chartUrl", "url1", "url2");

    chart.withChartType(type2).withChartUrl("url2").withDescription("desc2");
    patchEntityAndCheck(chart, originalJson, ADMIN_AUTH_HEADERS, UpdateType.MINOR_UPDATE, change);
  }

  @Override
  @Execution(ExecutionMode.CONCURRENT)
  public Chart validateGetWithDifferentFields(Chart chart, boolean byName) throws HttpResponseException {
    String fields = "";
    chart =
        byName
            ? getEntityByName(chart.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(chart.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(chart.getService(), chart.getServiceType());
    assertListNull(chart.getOwner(), chart.getFollowers(), chart.getTags());

    // .../charts?fields=owner
    fields = "owner,followers,tags";
    chart =
        byName
            ? getEntityByName(chart.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(chart.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(chart.getService(), chart.getServiceType());
    // Checks for other owner, tags, and followers is done in the base class
    return chart;
  }

  @Override
  public CreateChart createRequest(String name) {
    return new CreateChart().withName(name).withService(getContainer().getName()).withChartType(ChartType.Area);
  }

  @Override
  public EntityReference getContainer() {
    return METABASE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Chart entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(Chart chart, CreateChart createRequest, Map<String, String> authHeaders) {
    assertNotNull(chart.getServiceType());
    assertReference(createRequest.getService(), chart.getService());
    assertEquals(createRequest.getChartType(), chart.getChartType());
    assertEquals(createRequest.getChartUrl(), chart.getChartUrl());
  }

  @Override
  public void compareEntities(Chart expected, Chart patched, Map<String, String> authHeaders) {
    assertReference(expected.getService(), patched.getService());
    assertEquals(expected.getChartType(), patched.getChartType());
    assertEquals(expected.getChartUrl(), patched.getChartUrl());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.startsWith("chartType")) {
      ChartType expectedChartType = (ChartType) expected;
      ChartType actualChartType = ChartType.fromValue(actual.toString());
      assertEquals(expectedChartType, actualChartType);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
