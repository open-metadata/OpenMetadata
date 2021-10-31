/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.charts;

import com.fasterxml.jackson.core.JsonProcessingException;
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
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChartType;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.client.WebTarget;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.ENTITY_ALREADY_EXISTS;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class ChartResourceTest extends EntityResourceTest<Chart> {
  private static final Logger LOG = LoggerFactory.getLogger(ChartResourceTest.class);
  public static EntityReference SUPERSET_REFERENCE;
  public static EntityReference LOOKER_REFERENCE;
  public static final TagLabel USER_ADDRESS_TAG_LABEL = new TagLabel().withTagFQN("User.Address");
  public static final TagLabel TIER_1 = new TagLabel().withTagFQN("Tier.Tier1");

  public ChartResourceTest() {
    super(Chart.class, "charts", ChartResource.FIELDS, true);
  }

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException, URISyntaxException {
    EntityResourceTest.setup(test);

    CreateDashboardService createService = new CreateDashboardService().withName("superset")
            .withServiceType(DashboardServiceType.Superset).withDashboardUrl(new URI("http://localhost:0"));
    DashboardService service = DashboardServiceResourceTest.createService(createService, adminAuthHeaders());
    SUPERSET_REFERENCE = new DashboardServiceEntityInterface(service).getEntityReference();

    createService.withName("looker").withServiceType(DashboardServiceType.Looker)
            .withDashboardUrl(new URI("http://localhost:0"));
    service = DashboardServiceResourceTest.createService(createService, adminAuthHeaders());
    LOOKER_REFERENCE = new DashboardServiceEntityInterface(service).getEntityReference();
  }

  @Test
  public void post_chartWithLongName_400_badRequest(TestInfo test) {
    // Create chart with mandatory name field empty
    CreateChart create = create(test).withName(LONG_ENTITY_NAME);
    assertResponse(() -> createChart(create, adminAuthHeaders()),
            BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_chartAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateChart create = create(test);
    createChart(create, adminAuthHeaders());
    assertResponse(() -> createChart(create, adminAuthHeaders()), CONFLICT, ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validCharts_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    CreateChart create = create(test).withService(new EntityReference().
            withId(SUPERSET_REFERENCE.getId()).withType(SUPERSET_REFERENCE.getType()));
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getChartName(test, 1)).withDescription("description");
    Chart chart = createAndCheckEntity(create, adminAuthHeaders());
    String expectedFQN = SUPERSET_REFERENCE.getName() + "." + chart.getName();
    assertEquals(expectedFQN, chart.getFullyQualifiedName());
  }

  @Test
  public void post_chartWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_chartWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1).withDisplayName("chart1"), adminAuthHeaders());
  }

  @Test
  public void post_chart_as_non_admin_401(TestInfo test) {
    CreateChart create = create(test);
    assertResponse(() -> createChart(create, authHeaders("test@open-metadata.org")),
            FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_chartWithoutRequiredFields_4xx(TestInfo test) {
    assertResponse(() -> createChart(create(test).withName(null), adminAuthHeaders()), BAD_REQUEST,
            "[name must not be null]");
    assertResponse(() -> createChart(create(test).withName(LONG_ENTITY_NAME), adminAuthHeaders()), BAD_REQUEST,
            "[name size must be between 1 and 64]");
    // Service is required field
    assertResponse(() -> createChart(create(test).withService(null), adminAuthHeaders()), BAD_REQUEST,
            "[service must not be null]");
  }

  @Test
  public void post_chartWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreateChart create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createChart(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_chartWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(NON_EXISTENT_ENTITY).withType("user");
    CreateChart create = create(test).withOwner(owner);
    assertResponse(() -> createChart(create, adminAuthHeaders()), NOT_FOUND,
            entityNotFound("User", NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_chartWithDifferentService_200_ok(TestInfo test) throws HttpResponseException {
    EntityReference[] differentServices = {SUPERSET_REFERENCE, LOOKER_REFERENCE};

    // Create chart for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(create(test).withService(service), adminAuthHeaders());

      // List charts by filtering on service name and ensure right charts are returned in the response
      ChartList list = listCharts("service", service.getName(), adminAuthHeaders());
      for (Chart chart : list.getData()) {
        assertEquals(service.getName(), chart.getService().getName());
      }
    }
  }

  @Test
  public void get_chartListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    assertResponse(() -> listCharts(null, null, -1, null, null, adminAuthHeaders()),
            BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    assertResponse(() ->listCharts(null, null, 0, null, null, adminAuthHeaders()),
            BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    assertResponse(() -> listCharts(null, null, 1000001, null, null, adminAuthHeaders()),
            BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_chartListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    assertResponse(() -> listCharts(null, null, 1, "", "", adminAuthHeaders()),
            BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  public void get_chartListWithValidLimitOffset_4xx(TestInfo test) throws HttpResponseException {
    // Create a large number of charts
    int maxCharts = 40;
    for (int i = 0; i < maxCharts; i++) {
      createChart(create(test, i), adminAuthHeaders());
    }

    // List all charts
    ChartList allCharts = listCharts(null, null, 1000000, null,
            null, adminAuthHeaders());
    int totalRecords = allCharts.getData().size();
    printCharts(allCharts);

    // List limit number charts at a time at various offsets and ensure right results are returned
    for (int limit = 1; limit < maxCharts; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllCharts = 0;
      ChartList forwardPage;
      ChartList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listCharts(null, null, limit, null, after, adminAuthHeaders());
        printCharts(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allCharts.getData(), forwardPage, limit, indexInAllCharts);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listCharts(null, null, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allCharts.getData(), backwardPage, limit, (indexInAllCharts - limit));
        }

        indexInAllCharts += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllCharts = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listCharts(null, null, limit, before, null, adminAuthHeaders());
        printCharts(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allCharts.getData(), forwardPage, limit, indexInAllCharts);
        pageCount++;
        indexInAllCharts -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printCharts(ChartList list) {
    list.getData().forEach(chart -> LOG.info("Chart {}", chart.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  public void get_nonExistentChart_404_notFound() {
    assertResponse(() -> getChart(NON_EXISTENT_ENTITY, adminAuthHeaders()), NOT_FOUND,
            entityNotFound(Entity.CHART, NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_chartWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateChart create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SUPERSET_REFERENCE);
    Chart chart = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(chart, false);
  }

  @Test
  public void get_chartByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateChart create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SUPERSET_REFERENCE);
    Chart chart = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(chart, true);
  }

  @Test
  public void patch_chartAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create chart without description, owner
    Chart chart = createChart(create(test), adminAuthHeaders());
    assertNull(chart.getDescription());
    assertNull(chart.getOwner());
    assertNotNull(chart.getService());
    List<TagLabel> chartTags = List.of(USER_ADDRESS_TAG_LABEL);

    chart = getChart(chart.getId(), "service,owner,tags", adminAuthHeaders());
    chart.getService().setHref(null); // href is readonly and not patchable

    //
    // Add displayName, description, owner when previously they were null
    //
    String origJson = JsonUtils.pojoToJson(chart);
    chart.withDescription("description").withDisplayName("displayName").withOwner(TEAM_OWNER1).withTags(chartTags);
    ChangeDescription change = getChangeDescription(chart.getVersion())
            .withFieldsAdded(Arrays.asList("description", "displayName", "owner", "tags"));
    chart = patchEntityAndCheck(chart, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
    chart.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    chart.setService(SUPERSET_REFERENCE); // Get rid of href and name returned in the response for service
    chartTags = List.of(USER_ADDRESS_TAG_LABEL, TIER_1);

    //
    // Replace description, tier, owner
    //
    origJson = JsonUtils.pojoToJson(chart);
    chart.withDescription("description1").withDisplayName("displayName1").withOwner(USER_OWNER1).withTags(chartTags);
    change = getChangeDescription(chart.getVersion())
            .withFieldsUpdated(Arrays.asList("description", "displayName", "owner", "tags"));
    chart = patchEntityAndCheck(chart, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
    chart.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner
    chart.setService(SUPERSET_REFERENCE); // Get rid of href and name returned in the response for service

    // Remove description, tier, owner
    origJson = JsonUtils.pojoToJson(chart);
    chart.withDescription(null).withDisplayName(null).withOwner(null).withTags(null);
    change = getChangeDescription(chart.getVersion())
            .withFieldsDeleted(Arrays.asList("description", "displayName", "owner", "tags"));
    patchEntityAndCheck(chart, origJson, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void delete_emptyChart_200_ok(TestInfo test) throws HttpResponseException {
    Chart chart = createChart(create(test), adminAuthHeaders());
    deleteChart(chart.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyChart_4xx() {
    // TODO
  }

  @Test
  public void delete_nonExistentChart_404() {
    assertResponse(() -> deleteChart(NON_EXISTENT_ENTITY, adminAuthHeaders()), NOT_FOUND,
            entityNotFound(Entity.CHART, NON_EXISTENT_ENTITY));
  }

  public static Chart createChart(CreateChart create,
                                  Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("charts"), create, Chart.class, authHeaders);
  }

  /**
   * Validate returned fields GET .../charts/{id}?fields="..." or GET .../charts/name/{fqn}?fields="..."
   */
  private void validateGetWithDifferentFields(Chart chart, boolean byName) throws HttpResponseException {
    // .../charts?fields=owner
    String fields = "owner";
    chart = byName ? getChartByName(chart.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getChart(chart.getId(), fields, adminAuthHeaders());
    assertNotNull(chart.getOwner());
    assertNotNull(chart.getService()); // We always return the service

    // .../charts?fields=owner,service
    fields = "owner,service";
    chart = byName ? getChartByName(chart.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getChart(chart.getId(), fields, adminAuthHeaders());
    assertNotNull(chart.getOwner());
    assertNotNull(chart.getService());

    // .../charts?fields=owner,service
    fields = "owner,service";
    chart = byName ? getChartByName(chart.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getChart(chart.getId(), fields, adminAuthHeaders());
    assertNotNull(chart.getOwner());
    assertNotNull(chart.getService());
  }

  public static void getChart(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getChart(id, null, authHeaders);
  }

  public static Chart getChart(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("charts/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Chart.class, authHeaders);
  }

  public static Chart getChartByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("charts/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Chart.class, authHeaders);
  }

  public static ChartList listCharts(String fields, String serviceParam, Map<String, String> authHeaders)
          throws HttpResponseException {
    return listCharts(fields, serviceParam, null, null, null, authHeaders);
  }

  public static ChartList listCharts(String fields, String serviceParam, Integer limitParam,
                                     String before, String after, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("charts");
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = serviceParam != null ? target.queryParam("service", serviceParam) : target;
    target = limitParam != null ? target.queryParam("limit", limitParam) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, ChartList.class, authHeaders);
  }

  private void deleteChart(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("charts/" + id), authHeaders);

    // Ensure deleted chart does not exist
    assertResponse(() -> getChart(id, authHeaders), NOT_FOUND, entityNotFound(Entity.CHART, id));
  }

  public static String getChartName(TestInfo test) {
    return String.format("chart_%s", test.getDisplayName());
  }

  public static String getChartName(TestInfo test, int index) {
    return String.format("chart%d_%s", index, test.getDisplayName());
  }

  public static CreateChart create(TestInfo test) {
    return new CreateChart().withName(getChartName(test)).withService(SUPERSET_REFERENCE).withChartType(ChartType.Area);
  }

  public static CreateChart create(TestInfo test, int index) {
    return new CreateChart().withName(getChartName(test, index)).withService(SUPERSET_REFERENCE)
            .withChartType(ChartType.Area);
  }

  @Override
  public Object createRequest(TestInfo test, String description, String displayName, EntityReference owner) {
    return create(test).withDescription(description).withDisplayName(displayName).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Chart chart, Object request, Map<String, String> authHeaders) {
    CreateChart createRequest = (CreateChart) request;
    validateCommonEntityFields(getEntityInterface(chart), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());
    assertService(createRequest.getService(), chart.getService());
  }

  @Override
  public void validateUpdatedEntity(Chart updatedEntity, Object request, Map<String, String> authHeaders) {
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  @Override
  public void validatePatchedEntity(Chart expected, Chart patched, Map<String, String> authHeaders) {
    validateCommonEntityFields(getEntityInterface(patched), expected.getDescription(),
            TestUtils.getPrincipal(authHeaders), expected.getOwner());
    assertService(expected.getService(), patched.getService());
  }

  @Override
  public EntityInterface<Chart> getEntityInterface(Chart chart) {
    return new ChartEntityInterface(chart);
  }
}
