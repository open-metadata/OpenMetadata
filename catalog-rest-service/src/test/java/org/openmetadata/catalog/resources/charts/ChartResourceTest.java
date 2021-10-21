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
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateChart;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.api.services.CreateDashboardService.DashboardServiceType;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.services.DashboardService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.charts.ChartResource.ChartList;
import org.openmetadata.catalog.resources.services.DashboardServiceResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.ChartType;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.ENTITY_ALREADY_EXISTS;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.checkUserFollowing;
import static org.openmetadata.catalog.util.TestUtils.userAuthHeaders;

public class ChartResourceTest extends CatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(ChartResourceTest.class);
  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static EntityReference SUPERSET_REFERENCE;
  public static EntityReference LOOKER_REFERENCE;
  public static final TagLabel USER_ADDRESS_TAG_LABEL = new TagLabel().withTagFQN("User.Address");
  public static final TagLabel TIER_1 = new TagLabel().withTagFQN("Tier.Tier1");

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException, URISyntaxException {
    USER1 = UserResourceTest.createUser(UserResourceTest.create(test), authHeaders("test@open-metadata.org"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = TeamResourceTest.createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    CreateDashboardService createService = new CreateDashboardService().withName("superset")
            .withServiceType(DashboardServiceType.Superset).withDashboardUrl(new URI("http://localhost:0"));
    DashboardService service = DashboardServiceResourceTest.createService(createService, adminAuthHeaders());
    SUPERSET_REFERENCE = EntityUtil.getEntityReference(service);

    createService.withName("looker").withServiceType(DashboardServiceType.Looker)
            .withDashboardUrl(new URI("http://localhost:0"));
    service = DashboardServiceResourceTest.createService(createService, adminAuthHeaders());
    LOOKER_REFERENCE = EntityUtil.getEntityReference(service);
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
    createAndCheckChart(create, adminAuthHeaders());

    create.withName(getChartName(test, 1)).withDescription("description");
    Chart chart = createAndCheckChart(create, adminAuthHeaders());
    String expectedFQN = SUPERSET_REFERENCE.getName() + "." + chart.getName();
    assertEquals(expectedFQN, chart.getFullyQualifiedName());
  }

  @Test
  public void post_chartWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckChart(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_chartWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckChart(create(test).withOwner(TEAM_OWNER1).withDisplayName("chart1"), adminAuthHeaders());
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
      createAndCheckChart(create(test).withService(service), adminAuthHeaders());

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
  public void put_chartUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
    // Create a chart with POST
    CreateChart request = create(test).withService(SUPERSET_REFERENCE).withOwner(USER_OWNER1);
    Chart chart = createAndCheckChart(request, adminAuthHeaders());

    // Update chart two times successfully with PUT requests
    chart = updateAndCheckChart(chart, request, OK, adminAuthHeaders(), NO_CHANGE);
    updateAndCheckChart(chart, request, OK, adminAuthHeaders(), NO_CHANGE);
  }

  @Test
  public void put_chartCreate_200(TestInfo test) throws HttpResponseException {
    // Create a new chart with PUT
    CreateChart request = create(test).withService(SUPERSET_REFERENCE).withOwner(USER_OWNER1);
    updateAndCheckChart(null, request.withName(test.getDisplayName()).withDescription(null), CREATED,
            adminAuthHeaders(), NO_CHANGE);
  }

  @Test
  public void put_chartCreate_as_owner_200(TestInfo test) throws HttpResponseException {
    // Create a new chart with PUT
    CreateChart request = create(test).withService(SUPERSET_REFERENCE).withOwner(USER_OWNER1);
    // Create chart as admin
    Chart chart = createAndCheckChart(request, adminAuthHeaders());
    // Update chart as owner - but description to null is not updated
    updateAndCheckChart(chart, request.withDescription(null), OK, authHeaders(USER1.getEmail()), NO_CHANGE);
    // Update chart as owner - but description to null is not updated
    updateAndCheckChart(chart, request.withOwner(TEAM_OWNER1), OK, authHeaders(USER1.getEmail()), MINOR_UPDATE);
  }

  @Test
  public void put_chartNullDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateChart request = create(test).withService(SUPERSET_REFERENCE).withDescription(null);
    Chart chart = createAndCheckChart(request, adminAuthHeaders());

    // Update null description with a new description
    chart = updateAndCheckChart(chart, request.withDescription("newDescription").withDisplayName("newChart")
            , OK, adminAuthHeaders(), MINOR_UPDATE);
    assertEquals("newChart", chart.getDisplayName());
  }

  @Test
  public void put_chartEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    // Create chart with empty description
    CreateChart request = create(test).withService(SUPERSET_REFERENCE).withDescription("");
    Chart chart = createAndCheckChart(request, adminAuthHeaders());

    // Update empty description with a new description
    updateAndCheckChart(chart, request.withDescription("newDescription"), OK, adminAuthHeaders(), MINOR_UPDATE);
  }

  @Test
  public void put_chartNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateChart request = create(test).withService(SUPERSET_REFERENCE).withDescription("description");
    createAndCheckChart(request, adminAuthHeaders());

    // Updating description is ignored when backend already has description
    Chart chart = updateChart(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("description", chart.getDescription());
  }

  @Test
  public void put_chartUpdateOwner_200(TestInfo test) throws HttpResponseException {
    CreateChart request = create(test).withService(SUPERSET_REFERENCE).withDescription("");
    Chart chart = createAndCheckChart(request, adminAuthHeaders());

    // Change ownership from USER_OWNER1 to TEAM_OWNER1
    chart = updateAndCheckChart(chart, request.withOwner(TEAM_OWNER1), OK, adminAuthHeaders(), MINOR_UPDATE);

    // Remove ownership
    updateAndCheckChart(chart, request.withOwner(null), OK, adminAuthHeaders(), MINOR_UPDATE);
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
    Chart chart = createAndCheckChart(create, adminAuthHeaders());
    validateGetWithDifferentFields(chart, false);
  }

  @Test
  public void get_chartByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateChart create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(SUPERSET_REFERENCE);
    Chart chart = createAndCheckChart(create, adminAuthHeaders());
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

    // Add displayName, description, owner when previously they were null
    chart = patchChartAttributesAndCheck(chart, "displayName", "description",
            TEAM_OWNER1, chartTags, adminAuthHeaders(), MINOR_UPDATE);
    chart.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    chart.setService(SUPERSET_REFERENCE); // Get rid of href and name returned in the response for service
    chartTags = List.of(USER_ADDRESS_TAG_LABEL, TIER_1);

    // Replace description, tier, owner
    chart = patchChartAttributesAndCheck(chart, "displayName1", "description1",
            USER_OWNER1, chartTags, adminAuthHeaders(), MINOR_UPDATE);
    chart.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner
    chart.setService(SUPERSET_REFERENCE); // Get rid of href and name returned in the response for service
    chartTags = List.of(TIER_1);

    // Remove description, tier, owner
    patchChartAttributesAndCheck(chart, null, null, null, chartTags,
            adminAuthHeaders(), MINOR_UPDATE);
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
  public void put_addDeleteFollower_200(TestInfo test) throws HttpResponseException {
    Chart chart = createAndCheckChart(create(test), adminAuthHeaders());

    // Add follower to the chart
    User user1 = UserResourceTest.createUser(UserResourceTest.create(test, 1), userAuthHeaders());
    addAndCheckFollower(chart, user1.getId(), CREATED, 1, userAuthHeaders());

    // Add the same user as follower and make sure no errors are thrown and return response is OK (and not CREATED)
    addAndCheckFollower(chart, user1.getId(), OK, 1, userAuthHeaders());

    // Add a new follower to the chart
    User user2 = UserResourceTest.createUser(UserResourceTest.create(test, 2), userAuthHeaders());
    addAndCheckFollower(chart, user2.getId(), CREATED, 2, userAuthHeaders());

    // Delete followers and make sure they are deleted
    deleteAndCheckFollower(chart, user1.getId(), 1, userAuthHeaders());
    deleteAndCheckFollower(chart, user2.getId(), 0, userAuthHeaders());
  }

  @Test
  public void put_addDeleteInvalidFollower_200(TestInfo test) throws HttpResponseException {
    Chart chart = createAndCheckChart(create(test), adminAuthHeaders());

    // Add non existent user as follower to the chart
    assertResponse(() -> addAndCheckFollower(chart, NON_EXISTENT_ENTITY, CREATED, 1, adminAuthHeaders()),
            NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));

    // Delete non existent user as follower to the chart
    assertResponse(() -> deleteAndCheckFollower(chart, NON_EXISTENT_ENTITY, 1, adminAuthHeaders()),
            NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));
  }


  @Test
  public void delete_nonExistentChart_404() {
    assertResponse(() -> deleteChart(NON_EXISTENT_ENTITY, adminAuthHeaders()), NOT_FOUND,
            entityNotFound(Entity.CHART, NON_EXISTENT_ENTITY));
  }

  public static Chart createAndCheckChart(CreateChart create,
                                          Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    Chart chart = createChart(create, authHeaders);
    validateChart(chart, chart.getDisplayName(), create.getDescription(), create.getOwner(),
            create.getService(), create.getTags(), updatedBy);
    assertEquals(0.1, chart.getVersion());
    return getAndValidate(chart.getId(), create, authHeaders, updatedBy);
  }

  public static Chart updateAndCheckChart(Chart before,
                                          CreateChart create,
                                          Status status,
                                          Map<String, String> authHeaders,
                                          UpdateType updateType) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    Chart updatedChart = updateChart(create, status, authHeaders);
    validateChart(updatedChart, create.getDisplayName(), create.getDescription(), create.getOwner(),
            create.getService(), create.getTags(), updatedBy);

    if (before == null) {
      assertEquals(0.1, updatedChart.getVersion()); // First version created
    } else {
      TestUtils.validateUpdate(before.getVersion(), updatedChart.getVersion(), updateType);
    }
    // GET the newly updated chart and validate
    return getAndValidate(updatedChart.getId(), create, authHeaders, updatedBy);
  }

  // Make sure in GET operations the returned chart has all the required information passed during creation
  public static Chart getAndValidate(UUID chartId, CreateChart create, Map<String, String> authHeaders,
                                     String updatedBy) throws HttpResponseException {
    // GET the newly created chart by ID and validate
    Chart chart = getChart(chartId, "service,owner", authHeaders);
    validateChart(chart, create.getDisplayName(), create.getDescription(), create.getOwner(), create.getService(),
            create.getTags(), updatedBy);

    // GET the newly created chart by name and validate
    String fqn = chart.getFullyQualifiedName();
    chart = getChartByName(fqn, "service,owner", authHeaders);
    return validateChart(chart, create.getDisplayName(), create.getDescription(), create.getOwner(),
            create.getService(), create.getTags(), updatedBy);
  }

  public static Chart updateChart(CreateChart create,
                                  Status status,
                                  Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getResource("charts"), create, Chart.class, status, authHeaders);
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
    assertNull(chart.getService());

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

  private static Chart validateChart(Chart chart, String expectedDisplayName,
                                     String expectedDescription, EntityReference expectedOwner,
                                     EntityReference expectedService, List<TagLabel> expectedTags,
                                     String expectedUpdatedBy)
          throws HttpResponseException {
    assertNotNull(chart.getId());
    assertNotNull(chart.getHref());
    assertEquals(expectedDescription, chart.getDescription());
    assertEquals(expectedDisplayName, chart.getDisplayName());
    assertEquals(expectedUpdatedBy, chart.getUpdatedBy());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(chart.getOwner());
      assertEquals(expectedOwner.getId(), chart.getOwner().getId());
      assertEquals(expectedOwner.getType(), chart.getOwner().getType());
      assertNotNull(chart.getOwner().getHref());
    } else {
      assertNull(chart.getOwner());
    }

    // Validate service
    if (expectedService != null) {
      TestUtils.validateEntityReference(chart.getService());
      assertEquals(expectedService.getId(), chart.getService().getId());
      assertEquals(expectedService.getType(), chart.getService().getType());
    }
    TestUtils.validateTags(chart.getFullyQualifiedName(), expectedTags, chart.getTags());
    return chart;
  }

  private Chart patchChartAttributesAndCheck(Chart before, String newDisplayName, String newDescription,
                                             EntityReference newOwner, List<TagLabel> tags,
                                             Map<String, String> authHeaders, UpdateType updateType)
          throws JsonProcessingException, HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    String chartJson = JsonUtils.pojoToJson(before);

    // Update the chart attributes
    before.setDescription(newDescription);
    before.setDisplayName(newDisplayName);
    before.setOwner(newOwner);
    before.setTags(tags);

    // Validate information returned in patch response has the updates
    Chart updatedChart = patchChart(chartJson, before, authHeaders);
    validateChart(updatedChart, newDisplayName, newDescription, newOwner, null, tags, updatedBy);
    TestUtils.validateUpdate(before.getVersion(), updatedChart.getVersion(), updateType);

    // GET the chart and Validate information returned
    Chart getChart = getChart(before.getId(), "service,owner,tags", authHeaders);
    validateChart(getChart, newDisplayName, newDescription, newOwner, null, tags, updatedBy);
    return updatedChart;
  }

  private Chart patchChart(UUID chartId, String originalJson, Chart updatedChart,
                           Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updateChartJson = JsonUtils.pojoToJson(updatedChart);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updateChartJson);
    return TestUtils.patch(getResource("charts/" + chartId), patch, Chart.class, authHeaders);
  }

  private Chart patchChart(String originalJson,
                           Chart updatedChart,
                           Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    return patchChart(updatedChart.getId(), originalJson, updatedChart, authHeaders);
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

  public static void addAndCheckFollower(Chart chart, UUID userId, Status status, int totalFollowerCount,
                                         Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource(String.format("charts/%s/followers", chart.getId()));
    TestUtils.put(target, userId.toString(), status, authHeaders);

    // GET .../charts/{chartId} returns newly added follower
    Chart getChart = getChart(chart.getId(), "followers", authHeaders);
    assertEquals(totalFollowerCount, getChart.getFollowers().size());
    TestUtils.validateEntityReference(getChart.getFollowers());
    boolean followerFound = false;
    for (EntityReference followers : getChart.getFollowers()) {
      if (followers.getId().equals(userId)) {
        followerFound = true;
        break;
      }
    }
    assertTrue(followerFound, "Follower added was not found in chart get response");

    // GET .../users/{userId} shows user as following table
    checkUserFollowing(userId, chart.getId(), true, authHeaders);
  }

  private void deleteAndCheckFollower(Chart chart, UUID userId, int totalFollowerCount,
                                      Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource(String.format("charts/%s/followers/%s",
            chart.getId(), userId));
    TestUtils.delete(target, authHeaders);

    Chart getChart = checkFollowerDeleted(chart.getId(), userId, authHeaders);
    assertEquals(totalFollowerCount, getChart.getFollowers().size());
  }

  public static Chart checkFollowerDeleted(UUID chartId, UUID userId, Map<String, String> authHeaders)
          throws HttpResponseException {
    Chart getChart = getChart(chartId, "followers", authHeaders);
    TestUtils.validateEntityReference(getChart.getFollowers());
    boolean followerFound = false;
    for (EntityReference followers : getChart.getFollowers()) {
      if (followers.getId().equals(userId)) {
        followerFound = true;
        break;
      }
    }
    assertFalse(followerFound, "Follower deleted is still found in table get response");

    // GET .../users/{userId} shows user as following table
    checkUserFollowing(userId, chartId, false, authHeaders);
    return getChart;
  }
}
