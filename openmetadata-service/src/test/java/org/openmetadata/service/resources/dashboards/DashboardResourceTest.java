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

package org.openmetadata.service.resources.dashboards;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.FIELD_DELETED;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertEntityReferenceNames;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfUtils;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.charts.ChartResourceTest;
import org.openmetadata.service.resources.dashboards.DashboardResource.DashboardList;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RdfTestUtils;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class DashboardResourceTest extends EntityResourceTest<Dashboard, CreateDashboard> {
  public static final String SUPERSET_INVALID_SERVICE = "invalid_superset_service";
  private final ChartResourceTest chartResourceTest = new ChartResourceTest();

  public DashboardResourceTest() {
    super(
        Entity.DASHBOARD,
        Dashboard.class,
        DashboardList.class,
        "dashboards",
        DashboardResource.FIELDS);
    supportsSearchIndex = true;
    supportsBulkAPI = true;
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
  }

  @Test
  void post_DashboardWithCharts_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withCharts(CHART_REFERENCES), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_DashboardWithoutRequiredService_4xx(TestInfo test) {
    CreateDashboard create = createRequest(test).withService(null);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_DashboardWithInvalidService_4xx(TestInfo test) {
    CreateDashboard create = createRequest(test).withService(SUPERSET_INVALID_SERVICE);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.DASHBOARD_SERVICE, SUPERSET_INVALID_SERVICE));
  }

  @Test
  void post_DashboardWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {METABASE_REFERENCE, LOOKER_REFERENCE};

    // Create Dashboard for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(
          createRequest(test).withService(service.getFullyQualifiedName()), ADMIN_AUTH_HEADERS);
      // List Dashboards by filtering on service name and ensure right Dashboards in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service.getName());

      ResultList<Dashboard> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Dashboard db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
        String expectedFQN = FullyQualifiedName.add(service.getFullyQualifiedName(), db.getName());
        assertEquals(expectedFQN, db.getFullyQualifiedName());
      }
    }
  }

  @Test
  void put_DashboardChartsUpdate_200(TestInfo test) throws IOException {
    CreateDashboard request = createRequest(test).withDescription(null).withCharts(null);
    Dashboard dashboard = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add description, and charts
    ChangeDescription change = getChangeDescription(dashboard, MINOR_UPDATE);
    fieldAdded(change, "description", "newDescription");
    fieldAdded(change, "charts", CHART_REFERENCES);
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
    ChangeDescription change = getChangeDescription(dashboard, MINOR_UPDATE);
    fieldAdded(change, "charts", CHART_REFERENCES);
    dashboard =
        updateAndCheckEntity(
            request.withCharts(CHART_REFERENCES), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEntityReferenceNames(CHART_REFERENCES, dashboard.getCharts());

    // remove a chart
    change = getChangeDescription(dashboard, MINOR_UPDATE);
    fieldDeleted(change, "charts", List.of(CHART_REFERENCES.get(0)));
    CHART_REFERENCES.remove(0);
    updateAndCheckEntity(
        request.withCharts(CHART_REFERENCES), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for a Dashboard service, carry it forward from the dashboard
    DashboardServiceResourceTest serviceTest = new DashboardServiceResourceTest();
    CreateDashboardService createService =
        serviceTest.createRequest(test).withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    DashboardService service = serviceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a dashboard without domain and ensure it inherits domain from the parent
    CreateDashboard create =
        createRequest("dashboard").withService(service.getFullyQualifiedName());
    assertSingleDomainInheritance(create, DOMAIN.getEntityReference());
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create a dashboard service with owner data consumer
    DashboardServiceResourceTest serviceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashboardService =
        serviceTest
            .createRequest(getEntityName(test))
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    DashboardService service = serviceTest.createEntity(createDashboardService, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of the service can create dashboard under it
    createEntity(
        createRequest("dashboard").withService(service.getFullyQualifiedName()),
        authHeaders(DATA_CONSUMER.getName()));
  }

  @Test
  void test_deleteDashboard_chartBelongsToSingleDashboard_chartIsDeleted_thenRestored(TestInfo test)
      throws IOException {
    // Create charts first using ChartResourceTest
    List<String> chartFqns = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreateChart createChart =
          chartResourceTest.createRequest(test, i).withService(METABASE_REFERENCE.getName());
      Chart chart = chartResourceTest.createEntity(createChart, ADMIN_AUTH_HEADERS);
      chartFqns.add(chart.getFullyQualifiedName());
    }

    // Create a dashboard with these charts
    CreateDashboard create =
        createRequest(test)
            .withService(METABASE_REFERENCE.getFullyQualifiedName())
            .withCharts(chartFqns);
    Dashboard dashboard = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Verify the dashboard has charts
    assertNotNull(dashboard.getCharts());
    assertFalse(dashboard.getCharts().isEmpty());

    // Store all chart IDs for verification after dashboard deletion
    List<EntityReference> charts = dashboard.getCharts();

    // For each chart, verify it belongs only to this dashboard
    for (EntityReference chartRef : charts) {
      // Get the chart entity with dashboards field included
      Chart chart = chartResourceTest.getEntity(chartRef.getId(), "dashboards", ADMIN_AUTH_HEADERS);

      // Check chart has exactly one dashboard
      assertEquals(
          1,
          chart.getDashboards().size(),
          "Chart should belong to exactly one dashboard before deletion test");

      // Verify it's the dashboard we created
      assertEquals(
          dashboard.getId(),
          chart.getDashboards().getFirst().getId(),
          "Chart should belong to our test dashboard");
    }

    // Delete the dashboard
    dashboard = deleteAndCheckEntity(dashboard, ADMIN_AUTH_HEADERS);

    // Now verify that the charts are actually soft deleted and not hard deleted
    List<Chart> deletedCharts = new ArrayList<>();
    for (EntityReference chartRef : charts) {
      // Get the chart with include=deleted
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", Include.DELETED.value());

      Chart deletedChart =
          chartResourceTest.getEntity(chartRef.getId(), queryParams, "", ADMIN_AUTH_HEADERS);

      // Verify the chart is marked as deleted
      assertTrue(deletedChart.getDeleted(), "Chart should be marked as deleted");
      assertEquals(
          chartRef.getId(), deletedChart.getId(), "Found chart should match the original chart ID");
      deletedCharts.add(deletedChart);
    }

    // Restore the dashboard
    ChangeDescription change = getChangeDescription(dashboard, MINOR_UPDATE);
    fieldUpdated(change, FIELD_DELETED, true, false);
    restoreAndCheckEntity(dashboard, ADMIN_AUTH_HEADERS, change);

    // Verify charts are also restored when their parent dashboard is restored
    for (Chart deletedChart : deletedCharts) {
      // Verify chart is accessible again
      Chart restoredChart =
          chartResourceTest.getEntity(deletedChart.getId(), "dashboards", ADMIN_AUTH_HEADERS);
      assertFalse(
          restoredChart.getDeleted(),
          "Chart should not be marked as deleted after dashboard restoration");

      // Verify chart is associated with the restored dashboard
      assertEquals(
          1,
          restoredChart.getDashboards().size(),
          "Chart should have exactly one dashboard after restoration");
      assertEquals(
          dashboard.getId(),
          restoredChart.getDashboards().getFirst().getId(),
          "Chart should be associated with the restored dashboard");
    }
  }

  @Test
  void test_chartWithMultipleDashboards_deleteAndRestoreOneDashboard(TestInfo test)
      throws IOException {
    // Create charts first using ChartResourceTest
    List<String> chartFqns = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      CreateChart createChart =
          chartResourceTest.createRequest(test, i).withService(METABASE_REFERENCE.getName());
      Chart chart = chartResourceTest.createEntity(createChart, ADMIN_AUTH_HEADERS);
      chartFqns.add(chart.getFullyQualifiedName());
    }

    // Create first dashboard with all charts
    CreateDashboard create1 =
        createRequest(getEntityName(test) + "-first")
            .withService(METABASE_REFERENCE.getFullyQualifiedName())
            .withCharts(chartFqns);
    Dashboard dashboard1 = createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);

    // Create second dashboard with the same charts
    CreateDashboard create2 =
        createRequest(getEntityName(test) + "-second")
            .withService(METABASE_REFERENCE.getFullyQualifiedName())
            .withCharts(chartFqns);
    final Dashboard dashboard2 = createAndCheckEntity(create2, ADMIN_AUTH_HEADERS);

    // Store all chart IDs for verification after dashboard deletion
    List<EntityReference> charts = dashboard1.getCharts();

    // Delete the first dashboard
    final Dashboard deletedDashboard1 = deleteAndCheckEntity(dashboard1, ADMIN_AUTH_HEADERS);

    // Verify charts are still accessible (not deleted)
    for (EntityReference chartRef : charts) {
      // Get the chart entity with dashboards field included
      Chart chart = chartResourceTest.getEntity(chartRef.getId(), "dashboards", ADMIN_AUTH_HEADERS);

      // Check chart still exists
      assertNotNull(chart);

      // Verify the chart itself isn't deleted
      assertFalse(chart.getDeleted(), "Chart should not be marked as deleted");

      // Count non-deleted dashboards
      long nonDeletedDashboards =
          chart.getDashboards().stream().filter(d -> !Boolean.TRUE.equals(d.getDeleted())).count();
      assertEquals(
          1,
          nonDeletedDashboards,
          "Chart should belong to exactly one non-deleted dashboard after first dashboard deletion");

      // Verify one of the dashboards is the non-deleted second dashboard
      boolean hasSecondDashboard =
          chart.getDashboards().stream()
              .anyMatch(
                  d ->
                      d.getId().equals(dashboard2.getId()) && !Boolean.TRUE.equals(d.getDeleted()));
      assertTrue(hasSecondDashboard, "Chart should still belong to second test dashboard");
    }

    // Restore the first dashboard
    ChangeDescription change = getChangeDescription(deletedDashboard1, MINOR_UPDATE);
    fieldUpdated(change, FIELD_DELETED, true, false);
    restoreAndCheckEntity(deletedDashboard1, ADMIN_AUTH_HEADERS, change);

    // Verify charts now have associations with both dashboards
    for (EntityReference chartRef : charts) {
      // Get the chart entity with dashboards field included
      Chart chart = chartResourceTest.getEntity(chartRef.getId(), "dashboards", ADMIN_AUTH_HEADERS);

      // Verify chart is still not deleted
      assertFalse(chart.getDeleted(), "Chart should not be marked as deleted");

      // Count non-deleted dashboards - should be 2 now
      long nonDeletedDashboards =
          chart.getDashboards().stream().filter(d -> !Boolean.TRUE.equals(d.getDeleted())).count();
      assertEquals(
          2,
          nonDeletedDashboards,
          "Chart should belong to two non-deleted dashboards after first dashboard restoration");

      // Verify both dashboards are associated with the chart
      boolean hasFirstDashboard =
          chart.getDashboards().stream()
              .anyMatch(
                  d ->
                      d.getId().equals(deletedDashboard1.getId())
                          && !Boolean.TRUE.equals(d.getDeleted()));
      boolean hasSecondDashboard =
          chart.getDashboards().stream()
              .anyMatch(
                  d ->
                      d.getId().equals(dashboard2.getId()) && !Boolean.TRUE.equals(d.getDeleted()));
      assertTrue(
          hasFirstDashboard,
          "Chart should be associated with the first dashboard after restoration");
      assertTrue(hasSecondDashboard, "Chart should still be associated with the second dashboard");
    }

    // Now delete both dashboards
    deleteEntity(deletedDashboard1.getId(), true, false, ADMIN_AUTH_HEADERS);
    deleteEntity(dashboard2.getId(), true, false, ADMIN_AUTH_HEADERS);

    // Verify charts are now soft deleted
    for (EntityReference chartRef : charts) {
      // Verify chart cannot be retrieved normally
      assertResponse(
          () -> chartResourceTest.getEntity(chartRef.getId(), "", ADMIN_AUTH_HEADERS),
          NOT_FOUND,
          entityNotFound(Entity.CHART, chartRef.getId()));

      // Verify chart can be retrieved with include=deleted parameter
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", Include.DELETED.value());

      Chart deletedChart =
          chartResourceTest.getEntity(chartRef.getId(), queryParams, "", ADMIN_AUTH_HEADERS);

      // Verify the chart is marked as deleted
      assertTrue(
          deletedChart.getDeleted(),
          "Chart should be marked as deleted after all dashboards are deleted");
      assertEquals(
          chartRef.getId(), deletedChart.getId(), "Found chart should match the original chart ID");
    }
  }

  @Override
  public Dashboard validateGetWithDifferentFields(Dashboard dashboard, boolean byName)
      throws HttpResponseException {
    String fields = "";
    dashboard =
        byName
            ? getEntityByName(dashboard.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dashboard.getId(), fields, ADMIN_AUTH_HEADERS);
    // We always return the service
    assertListNotNull(dashboard.getService(), dashboard.getServiceType());
    assertListNull(
        dashboard.getOwners(),
        dashboard.getCharts(),
        dashboard.getFollowers(),
        dashboard.getUsageSummary());
    assertTrue(dashboard.getTags().isEmpty());

    fields = "owners,charts,followers,tags,usageSummary";
    dashboard =
        byName
            ? getEntityByName(dashboard.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dashboard.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(dashboard.getService(), dashboard.getServiceType());
    assertListNotNull(dashboard.getUsageSummary());
    TestUtils.validateEntityReferences(dashboard.getCharts(), true);
    // Checks for other owner, tags, and followers is done in the base class
    return dashboard;
  }

  @Override
  public CreateDashboard createRequest(String name) {
    return new CreateDashboard()
        .withName(name)
        .withService(getContainer().getName())
        .withCharts(CHART_REFERENCES);
  }

  @Override
  public EntityReference getContainer() {
    return METABASE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Dashboard entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(
      Dashboard dashboard, CreateDashboard createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertNotNull(dashboard.getServiceType());
    assertReference(createRequest.getService(), dashboard.getService());
    assertEntityReferenceNames(createRequest.getCharts(), dashboard.getCharts());
    TestUtils.validateTags(createRequest.getTags(), dashboard.getTags());
  }

  @Override
  public void compareEntities(
      Dashboard expected, Dashboard updated, Map<String, String> authHeaders) {}

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == null && actual == null) {
      return;
    }
    if (fieldName.contains("charts")) {
      assertEntityNamesFieldChange(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Test
  void testDashboardRdfRelationships(TestInfo test) throws IOException {
    if (!RdfTestUtils.isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create charts for the dashboard
    Chart chart1 =
        chartResourceTest.createEntity(
            chartResourceTest
                .createRequest(test.getDisplayName() + "_chart1")
                .withService(getContainer().getName()),
            ADMIN_AUTH_HEADERS);
    Chart chart2 =
        chartResourceTest.createEntity(
            chartResourceTest
                .createRequest(test.getDisplayName() + "_chart2")
                .withService(getContainer().getName()),
            ADMIN_AUTH_HEADERS);

    // Create dashboard with owner, tags and charts
    CreateDashboard createDashboard =
        createRequest(test)
            .withService(getContainer().getName())
            .withOwners(List.of(USER1_REF))
            .withTags(List.of(TIER1_TAG_LABEL))
            .withCharts(List.of(chart1.getFullyQualifiedName(), chart2.getFullyQualifiedName()));

    Dashboard dashboard = createEntity(createDashboard, ADMIN_AUTH_HEADERS);

    // Verify dashboard exists in RDF
    RdfTestUtils.verifyEntityInRdf(dashboard, RdfUtils.getRdfType("dashboard"));

    // Verify hierarchical relationship (service CONTAINS dashboard)
    RdfTestUtils.verifyContainsRelationshipInRdf(getContainer(), dashboard.getEntityReference());

    // Verify owner relationship
    RdfTestUtils.verifyOwnerInRdf(dashboard.getFullyQualifiedName(), USER1_REF);

    // Verify dashboard tags
    RdfTestUtils.verifyTagsInRdf(dashboard.getFullyQualifiedName(), dashboard.getTags());

    // Verify HAS relationships with charts
    for (Chart chart : List.of(chart1, chart2)) {
      RdfTestUtils.verifyRelationshipInRdf(
          dashboard.getEntityReference(),
          chart.getEntityReference(),
          org.openmetadata.schema.type.Relationship.HAS);
    }
  }

  @Test
  void testDashboardRdfSoftDeleteAndRestore(TestInfo test) throws IOException {
    if (!RdfTestUtils.isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create dashboard
    CreateDashboard createDashboard =
        createRequest(test).withService(getContainer().getName()).withOwners(List.of(USER1_REF));
    Dashboard dashboard = createEntity(createDashboard, ADMIN_AUTH_HEADERS);

    // Verify dashboard exists
    RdfTestUtils.verifyEntityInRdf(dashboard, RdfUtils.getRdfType("dashboard"));
    RdfTestUtils.verifyContainsRelationshipInRdf(getContainer(), dashboard.getEntityReference());
    RdfTestUtils.verifyOwnerInRdf(dashboard.getFullyQualifiedName(), USER1_REF);

    // Soft delete the dashboard
    deleteEntity(dashboard.getId(), ADMIN_AUTH_HEADERS);

    // Verify dashboard still exists in RDF after soft delete
    RdfTestUtils.verifyEntityInRdf(dashboard, RdfUtils.getRdfType("dashboard"));
    RdfTestUtils.verifyContainsRelationshipInRdf(getContainer(), dashboard.getEntityReference());
    RdfTestUtils.verifyOwnerInRdf(dashboard.getFullyQualifiedName(), USER1_REF);

    // Restore the dashboard
    Dashboard restored =
        restoreEntity(new RestoreEntity().withId(dashboard.getId()), OK, ADMIN_AUTH_HEADERS);

    // Verify dashboard still exists after restore
    RdfTestUtils.verifyEntityInRdf(restored, RdfUtils.getRdfType("dashboard"));
    RdfTestUtils.verifyContainsRelationshipInRdf(getContainer(), restored.getEntityReference());
    RdfTestUtils.verifyOwnerInRdf(restored.getFullyQualifiedName(), USER1_REF);
  }

  @Test
  void testDashboardRdfHardDelete(TestInfo test) throws IOException {
    if (!RdfTestUtils.isRdfEnabled()) {
      LOG.info("RDF not enabled, skipping test");
      return;
    }

    // Create dashboard
    CreateDashboard createDashboard = createRequest(test).withService(getContainer().getName());
    Dashboard dashboard = createEntity(createDashboard, ADMIN_AUTH_HEADERS);

    // Verify dashboard exists
    RdfTestUtils.verifyEntityInRdf(dashboard, RdfUtils.getRdfType("dashboard"));
    RdfTestUtils.verifyContainsRelationshipInRdf(getContainer(), dashboard.getEntityReference());

    // Hard delete the dashboard
    deleteEntity(dashboard.getId(), true, true, ADMIN_AUTH_HEADERS);

    // Verify dashboard no longer exists in RDF after hard delete
    RdfTestUtils.verifyEntityNotInRdf(dashboard.getFullyQualifiedName());
  }

  @Test
  void test_getDashboardByName_withMissingGlossaryTerm_shouldReturnDashboard(TestInfo test)
      throws IOException {
    // Create a dashboard with charts
    CreateDashboard createDashboard =
        createRequest(test)
            .withName("DashboardWithMissingTag")
            .withCharts(CHART_REFERENCES)
            .withService(getContainer().getName());
    Dashboard createdDashboard = createEntity(createDashboard, ADMIN_AUTH_HEADERS);

    // Manually insert a tag_usage record with a non-existent glossary term
    // This simulates the scenario where a glossary term was deleted but the tag reference remains
    String dashboardFqn = createdDashboard.getFullyQualifiedName();
    String nonExistentGlossaryTermFqn = "NonExistentGlossary.NonExistentTerm";

    // Insert invalid tag usage directly into database
    try {
      Entity.getCollectionDAO()
          .tagUsageDAO()
          .applyTag(
              org.openmetadata.schema.type.TagLabel.TagSource.GLOSSARY.ordinal(),
              nonExistentGlossaryTermFqn,
              nonExistentGlossaryTermFqn,
              dashboardFqn,
              org.openmetadata.schema.type.TagLabel.LabelType.MANUAL.ordinal(),
              org.openmetadata.schema.type.TagLabel.State.CONFIRMED.ordinal(),
              null);
    } catch (Exception e) {
      LOG.warn("Failed to insert invalid tag usage for test setup: {}", e.getMessage());
    }

    // Attempt to retrieve dashboard by name with tags field
    // This should NOT throw an exception even though the glossary term doesn't exist
    Dashboard retrievedDashboard =
        getEntityByName(
            createdDashboard.getFullyQualifiedName(), "tags,charts", ADMIN_AUTH_HEADERS);

    // Verify dashboard was retrieved successfully
    assertNotNull(retrievedDashboard, "Dashboard should be retrieved successfully");
    assertEquals(
        createdDashboard.getId(),
        retrievedDashboard.getId(),
        "Retrieved dashboard ID should match created dashboard");
    assertEquals(
        createdDashboard.getName(),
        retrievedDashboard.getName(),
        "Retrieved dashboard name should match");

    // Verify charts are still present
    assertListNotNull(retrievedDashboard.getCharts());
    assertEquals(
        CHART_REFERENCES.size(),
        retrievedDashboard.getCharts().size(),
        "All charts should be present");

    // Tags field should be present (might be empty or contain only valid tags)
    // The missing glossary term should have been gracefully skipped
    assertNotNull(retrievedDashboard.getTags(), "Tags field should not be null");

    LOG.info(
        "Successfully retrieved dashboard with missing glossary term reference without error. Retrieved tags: {}",
        retrievedDashboard.getTags());

    // Clean up
    deleteEntity(createdDashboard.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testBulk_PreservesUserEditsOnUpdate(TestInfo test) throws IOException {
    // Critical test: Verify that bulk updates preserve user-made changes
    // and only update the fields sent in the bulk request (incremental updates)

    // Step 1: Bot creates initial dashboard (using regular create, not bulk)
    CreateDashboard botCreate =
        createRequest(test.getDisplayName())
            .withDescription("Bot initial description")
            .withTags(List.of(USER_ADDRESS_TAG_LABEL));

    Dashboard entity = createEntity(botCreate, INGESTION_BOT_AUTH_HEADERS);
    assertEquals("Bot initial description", entity.getDescription());
    assertEquals(1, entity.getTags().size());

    // Step 2: User edits description and adds tag
    String originalJson = JsonUtils.pojoToJson(entity);
    String userDescription = "User-edited description - should be preserved";
    entity.setDescription(userDescription);
    entity.setTags(List.of(USER_ADDRESS_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    Dashboard userEditedEntity =
        patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals(userDescription, userEditedEntity.getDescription());
    assertEquals(2, userEditedEntity.getTags().size());

    // Step 3: Bot sends bulk update with new tag and different description
    // Bot's description should be IGNORED (bot protection)
    // Bot's tag should be MERGED (added to existing)
    CreateDashboard botUpdate =
        createRequest(test.getDisplayName())
            .withDescription("Bot trying to overwrite - should be ignored")
            .withTags(List.of(PII_SENSITIVE_TAG_LABEL));

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult updateResult =
        TestUtils.put(
            bulkTarget,
            List.of(botUpdate),
            BulkOperationResult.class,
            OK,
            INGESTION_BOT_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, updateResult.getStatus());
    assertEquals(1, updateResult.getNumberOfRowsPassed());

    // Step 4: Verify user edits were preserved
    Dashboard verifyEntity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);

    // Description should still be user's (bot protection)
    assertEquals(
        userDescription,
        verifyEntity.getDescription(),
        "Bot should NOT be able to overwrite user-edited description");

    // Tags should be merged (original 2 + new 1 from bot)
    assertEquals(3, verifyEntity.getTags().size(), "Tags should be merged, not replaced");

    List<String> tagFqns =
        verifyEntity.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toList());
    assertTrue(tagFqns.contains(USER_ADDRESS_TAG_LABEL.getTagFQN()));
    assertTrue(tagFqns.contains(PERSONAL_DATA_TAG_LABEL.getTagFQN()));
    assertTrue(tagFqns.contains(PII_SENSITIVE_TAG_LABEL.getTagFQN()));

    // Cleanup
    deleteEntity(entity.getId(), false, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testBulk_TagMergeBehavior(TestInfo test) throws IOException {
    // Test that bulk updates MERGE tags (add new, keep existing)
    // NOT replace tags completely

    // Step 1: Create dashboard with initial tags
    CreateDashboard createRequest =
        createRequest(test.getDisplayName())
            .withTags(List.of(USER_ADDRESS_TAG_LABEL, PERSONAL_DATA_TAG_LABEL));

    Dashboard entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);
    assertEquals(2, entity.getTags().size());

    // Step 2: Send bulk update with additional tag (not replacing existing)
    CreateDashboard updateRequest =
        createRequest(test.getDisplayName()).withTags(List.of(PII_SENSITIVE_TAG_LABEL));

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult result =
        TestUtils.put(
            bulkTarget, List.of(updateRequest), BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Step 3: Verify tags were merged (original 2 + new 1 = 3 total)
    Dashboard updatedEntity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);

    assertEquals(
        3, updatedEntity.getTags().size(), "Tags should be merged: 2 original + 1 new = 3 total");

    List<String> tagFqns =
        updatedEntity.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toList());

    assertTrue(
        tagFqns.contains(USER_ADDRESS_TAG_LABEL.getTagFQN()),
        "Original tag USER_ADDRESS should still exist");
    assertTrue(
        tagFqns.contains(PERSONAL_DATA_TAG_LABEL.getTagFQN()),
        "Original tag PERSONAL_DATA should still exist");
    assertTrue(
        tagFqns.contains(PII_SENSITIVE_TAG_LABEL.getTagFQN()),
        "New tag PII_SENSITIVE should be added");

    // Cleanup
    deleteEntity(entity.getId(), false, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testBulk_AdminCanOverrideDescription(TestInfo test) throws IOException {
    // Test that while bots cannot overwrite user descriptions,
    // admins CAN update descriptions via bulk

    // Step 1: User creates dashboard
    CreateDashboard createRequest =
        createRequest(test.getDisplayName()).withDescription("User-created description");

    Dashboard entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);
    assertEquals("User-created description", entity.getDescription());

    // Step 2: Admin updates description via bulk
    String adminDescription = "Admin-updated description via bulk";
    CreateDashboard adminUpdate =
        createRequest(test.getDisplayName()).withDescription(adminDescription);

    WebTarget bulkTarget = getCollection().path("/bulk");
    BulkOperationResult result =
        TestUtils.put(
            bulkTarget, List.of(adminUpdate), BulkOperationResult.class, OK, ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Step 3: Verify admin's description was applied
    Dashboard updatedEntity = getEntity(entity.getId(), "", ADMIN_AUTH_HEADERS);
    assertEquals(
        adminDescription,
        updatedEntity.getDescription(),
        "Admin should be able to update description via bulk");

    // Cleanup
    deleteEntity(entity.getId(), false, true, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testDashboardWithOrphanedGlossaryTermReference_shouldNotFail(TestInfo test)
      throws IOException {

    CreateDashboard createDashboard = createRequest(test).withService(getContainer().getName());
    Dashboard dashboard = createEntity(createDashboard, ADMIN_AUTH_HEADERS);

    GlossaryTermResourceTest glossaryTermTest =
        new org.openmetadata.service.resources.glossary.GlossaryTermResourceTest();
    GlossaryTerm glossaryTerm =
        glossaryTermTest.createEntity(glossaryTermTest.createRequest(test), ADMIN_AUTH_HEADERS);

    // Simulate orphaned glossary term tag: Insert into tag_usage table
    // source=1 means glossary term, source=0 means classification tag
    String tagFQN = glossaryTerm.getFullyQualifiedName();
    String tagFQNHash = org.openmetadata.service.util.FullyQualifiedName.buildHash(tagFQN);
    String targetFQNHash =
        org.openmetadata.service.util.FullyQualifiedName.buildHash(
            dashboard.getFullyQualifiedName());

    Entity.getCollectionDAO()
        .tagUsageDAO()
        .applyTag(
            1, // source: 1 for glossary term
            tagFQN,
            tagFQNHash,
            targetFQNHash,
            0, // labelType: 0 for MANUAL
            0, // state: 0 for CONFIRMED
            null); // reason

    // Delete the glossary term directly from the database
    // but leave the tag_usage entry intact (simulating what happens when deletion cleanup fails)
    Entity.getCollectionDAO().glossaryTermDAO().delete(glossaryTerm.getId());

    // Now try to get the dashboard with tags field (which triggers tag resolution from tag_usage)
    // This should NOT fail with 404, but should filter out the orphaned glossary term reference
    Dashboard retrievedDashboard = getEntity(dashboard.getId(), "tags", ADMIN_AUTH_HEADERS);

    // Verify the dashboard is retrieved successfully
    assertNotNull(retrievedDashboard);
    assertEquals(dashboard.getId(), retrievedDashboard.getId());
    assertEquals(dashboard.getFullyQualifiedName(), retrievedDashboard.getFullyQualifiedName());

    LOG.info(
        "Successfully retrieved dashboard {} even with orphaned glossary term in tag_usage",
        dashboard.getFullyQualifiedName());
  }
}
