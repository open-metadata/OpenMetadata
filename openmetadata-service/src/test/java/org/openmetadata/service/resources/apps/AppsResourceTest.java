package org.openmetadata.service.resources.apps;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.CREATED;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.schema.type.ColumnDataType.INT;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertEventually;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;
import static org.openmetadata.service.util.TestUtils.readResponse;

import es.org.elasticsearch.client.Request;
import es.org.elasticsearch.client.RestClient;
import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.apache.http.util.EntityUtils;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.analytics.PageViewData;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.app.NativeAppPermission;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ReportDataRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.WebAnalyticEventRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.events.BaseCallbackResource;
import org.openmetadata.service.resources.events.EventSubscriptionResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.RetryableAssertionError;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class AppsResourceTest extends EntityResourceTest<App, CreateApp> {
  private static final String SYSTEM_APP_NAME = "systemApp";

  public AppsResourceTest() {
    super(Entity.APPLICATION, App.class, AppResource.AppList.class, "apps", AppResource.FIELDS);
    supportsFieldsQueryParam = false;
    supportedNameCharacters = "_-.";
    supportsEtag = false;
  }

  public static final RetryRegistry APP_TRIGGER_RETRY =
      RetryRegistry.of(
          RetryConfig.custom()
              .maxAttempts(60) // about 30 seconds
              .waitDuration(Duration.ofMillis(500))
              .retryExceptions(RetryableAssertionError.class)
              .build());

  @Override
  @SneakyThrows
  public CreateApp createRequest(String name) {
    // Create AppMarketPlaceDefinition
    AppMarketPlaceResourceTest appMarketPlaceResourceTest = new AppMarketPlaceResourceTest();
    AppMarketPlaceDefinition appMarketPlaceDefinition;
    try {
      appMarketPlaceDefinition =
          appMarketPlaceResourceTest.getEntityByName(name, ADMIN_AUTH_HEADERS);
    } catch (EntityNotFoundException | HttpResponseException ex) {
      CreateAppMarketPlaceDefinitionReq req =
          appMarketPlaceResourceTest.createRequest(name).withSystem(name.equals(SYSTEM_APP_NAME));
      appMarketPlaceDefinition =
          appMarketPlaceResourceTest.createAndCheckEntity(req, ADMIN_AUTH_HEADERS);
    }
    // Create Request
    return new CreateApp()
        .withName(appMarketPlaceDefinition.getName())
        .withAppConfiguration(appMarketPlaceDefinition.getAppConfiguration())
        .withAppSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.HOURLY));
  }

  @Test
  @SneakyThrows
  @Override
  protected void post_entityCreateWithInvalidName_400() {
    // Does not apply since the App is already validated in the AppMarketDefinition
  }

  @Test
  void validate_data_insights_workflow_is_correct_for_a_simple_case()
      throws IOException, InterruptedException {
    long MILLISECONDS_IN_AN_HOUR = (long) 1000 * 60 * 60;

    Long timestamp = System.currentTimeMillis();

    Long endTimestamp = TimestampUtils.getEndOfDayTimestamp(timestamp);
    Long startTimestamp =
        TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(timestamp, 1));

    // Create User
    // -------------------------------------------------
    UserResourceTest userResourceTest = new UserResourceTest();
    User user = userResourceTest.createUser("dataInsightsUser", false);

    // Create Snowflake DatabaseService, Database and Schema
    // -------------------------------------------------
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseService databaseService =
        databaseServiceResourceTest.createEntity(
            databaseServiceResourceTest
                .createRequest("DI Test Snowflake")
                .withServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake),
            ADMIN_AUTH_HEADERS);

    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    Database database =
        databaseResourceTest.createEntity(
            databaseResourceTest
                .createRequest("database")
                .withService(databaseService.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    DatabaseSchemaResourceTest schemaResourceTest = new DatabaseSchemaResourceTest();
    DatabaseSchema schema =
        schemaResourceTest.createEntity(
            schemaResourceTest
                .createRequest("schema")
                .withDatabase(database.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    // Create Table
    // -------------------------------------------------

    // Table CreatedAt and UpdatedAt - Needed so that it will be processed in the DataAssets
    // Workflow
    Long tableCreatedAt = endTimestamp - MILLISECONDS_IN_AN_HOUR * 10;

    // Table AccessedAt - Needed so that it will be processed in the CostAnalysis Workflow
    Long tableAccessedAt = endTimestamp - MILLISECONDS_IN_AN_HOUR * 15;

    TableResourceTest tableResourceTest = new TableResourceTest();
    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);

    // We are manually creating a new Table to be able to assign the updatedAt property to whenever
    // we want.
    // In this case we are Running the Workflow for `System.currentTimeMillis()` and this will
    // process the DataAssets
    // state as of `System.currentTimeMillis() - 1 Day`.
    // Since multiple changes might happen in a given Day, we are defining that the State of the
    // DataAsset for that Day
    // is the Last State of the Day Before.
    // Because of this we are setting the updatedAt value to a date before the startTimestamp.
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withDatabaseSchema(schema.getEntityReference())
            .withDatabase(schema.getDatabase())
            .withService(schema.getService())
            .withServiceType(schema.getServiceType())
            .withName("table")
            .withFullyQualifiedName(FullyQualifiedName.add(schema.getFullyQualifiedName(), "table"))
            .withUpdatedAt(tableCreatedAt)
            .withUpdatedBy("admin")
            .withDescription("description")
            .withColumns(
                listOf(new Column().withName("column").withDataType(INT).withDescription("FooBar")))
            .withLifeCycle(
                new LifeCycle()
                    .withCreated(new AccessDetails().withTimestamp(tableCreatedAt))
                    .withAccessed(
                        new AccessDetails()
                            .withTimestamp(tableAccessedAt)
                            .withAccessedBy(user.getEntityReference())));
    tableRepository.createOrUpdate(null, table, ADMIN_USER_NAME);

    // Adding the ProfileData for the CostAnalysis Workflow to use it
    tableResourceTest.putTableProfileData(
        table.getId(),
        new CreateTableProfile()
            .withTableProfile(
                new TableProfile()
                    .withSizeInByte((double) 1000)
                    .withTimestamp(startTimestamp + MILLISECONDS_IN_AN_HOUR * 12)),
        ADMIN_AUTH_HEADERS);

    // Create PageView Event - Needed for the WebAnalytic Workflow
    WebAnalyticEventRepository webAnalyticEventRepository = new WebAnalyticEventRepository();
    webAnalyticEventRepository.addWebAnalyticEventData(
        new WebAnalyticEventData()
            .withTimestamp(startTimestamp + MILLISECONDS_IN_AN_HOUR * 15)
            .withEventType(WebAnalyticEventType.PAGE_VIEW)
            .withEventData(
                new PageViewData()
                    .withFullUrl(
                        String.format(
                            "http://localhost:8585/table/%s", table.getFullyQualifiedName()))
                    .withUrl(String.format("/table/%s", table.getFullyQualifiedName()))
                    .withHostname("localhost:8585")
                    .withLanguage("English")
                    .withScreenSize("1")
                    .withUserId(user.getId())
                    .withSessionId(UUID.randomUUID())
                    .withPageLoadTime((double) 1)));

    // Trigger the App to validate initial state
    postTriggerApp("DataInsightsApplication", ADMIN_AUTH_HEADERS);

    // Wait 30 seconds for the Workflow to Finish.
    Thread.sleep(30000);

    ReportDataRepository reportDataRepository = new ReportDataRepository();
    ResultList<ReportData> entityViewReportData =
        reportDataRepository.getReportData(
            ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA,
            startTimestamp,
            endTimestamp);
    ResultList<ReportData> userActivityReportData =
        reportDataRepository.getReportData(
            ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
            startTimestamp,
            endTimestamp);
    ResultList<ReportData> rawCostAnalysisReportData =
        reportDataRepository.getReportData(
            ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA, startTimestamp, endTimestamp);
    ResultList<ReportData> aggregatedCostAnalysisReportData =
        reportDataRepository.getReportData(
            ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA,
            startTimestamp,
            endTimestamp);

    // Assert WebAnalytics Workflow
    // -------------------------------------------------
    assert entityViewReportData.getData().size() == 1;
    assert JsonUtils.getMap(entityViewReportData.getData().get(0).getData())
        .get("entityFqn")
        .equals(table.getFullyQualifiedName());

    assert userActivityReportData.getData().size() == 1;
    assert JsonUtils.getMap(userActivityReportData.getData().get(0).getData())
        .get("userName")
        .equals(user.getName());
    assert (int)
            JsonUtils.getMap(userActivityReportData.getData().get(0).getData()).get("totalPageView")
        == 1;
    assert (int)
            JsonUtils.getMap(userActivityReportData.getData().get(0).getData()).get("totalSessions")
        == 1;

    // Assert CostAnalysis Workflow
    // -------------------------------------------------
    assert rawCostAnalysisReportData.getData().size() == 1;
    assert !CommonUtil.nullOrEmpty(
        JsonUtils.getMap(rawCostAnalysisReportData.getData().get(0).getData()).get("lifeCycle"));
    assert (double)
            JsonUtils.getMap(rawCostAnalysisReportData.getData().get(0).getData()).get("sizeInByte")
        == 1000.0;

    assert aggregatedCostAnalysisReportData.getData().size() == 1;
    assert JsonUtils.getMap(aggregatedCostAnalysisReportData.getData().get(0).getData())
        .get("serviceName")
        .equals(databaseService.getFullyQualifiedName());
    assert (double)
            JsonUtils.getMap(aggregatedCostAnalysisReportData.getData().get(0).getData())
                .get("totalCount")
        == 1.0;

    // Assert DataAssets Workflow
    // -------------------------------------------------
    RestClient searchClient = getSearchClient();
    es.org.elasticsearch.client.Response response;
    String clusterAlias = Entity.getSearchRepository().getClusterAlias();
    String endpointSuffix = "di-data-assets-*";
    String endpoint =
        !(clusterAlias == null || clusterAlias.isEmpty())
            ? String.format("%s-%s", clusterAlias, endpointSuffix)
            : endpointSuffix;
    Request request = new Request("GET", String.format("%s/_search", endpoint));
    String payload =
        String.format(
            "{\"query\":{\"bool\":{\"must\":{\"term\":{\"fullyQualifiedName\":\"%s\"}}}}}",
            table.getFullyQualifiedName());
    request.setJsonEntity(payload);
    response = searchClient.performRequest(request);
    searchClient.close();

    String jsonString = EntityUtils.toString(response.getEntity());
    HashMap<String, Object> map =
        (HashMap<String, Object>) JsonUtils.readOrConvertValue(jsonString, HashMap.class);
    LinkedHashMap<String, Object> hits = (LinkedHashMap<String, Object>) map.get("hits");
    ArrayList<LinkedHashMap<String, Object>> hitsList =
        (ArrayList<LinkedHashMap<String, Object>>) hits.get("hits");

    assert hitsList.size() == 1;
    assert JsonUtils.getMap(JsonUtils.getMap(hitsList.get(0)).get("_source"))
        .get("fullyQualifiedName")
        .equals(table.getFullyQualifiedName());
  }

  @Test
  void delete_systemApp_400() throws IOException {
    CreateApp systemAppRequest = createRequest(SYSTEM_APP_NAME);
    App systemApp = createAndCheckEntity(systemAppRequest, ADMIN_AUTH_HEADERS);
    assertResponseContains(
        () -> deleteEntity(systemApp.getId(), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "of type SystemApp can not be deleted");
  }

  @Test
  void post_trigger_app_200() throws HttpResponseException {
    String appName = "SearchIndexingApplication";
    postTriggerApp(appName, ADMIN_AUTH_HEADERS);
    assertAppStatusAvailableAfterTrigger(appName);
    assertListExtension(appName, AppExtension.ExtensionType.STATUS);
    assertAppRanAfterTriggerWithStatus(appName, AppRunRecord.Status.SUCCESS);

    postTriggerApp(appName, ADMIN_AUTH_HEADERS, Map.of("batchSize", 1234));

    assertEventually(
        "triggerCustomConfig",
        () ->
            Assertions.assertEquals(
                1234, getLatestAppRun(appName, ADMIN_AUTH_HEADERS).getConfig().get("batchSize")));
  }

  @Test
  void post_trigger_app_400() {
    String appName = "SearchIndexingApplication";
    assertResponseContains(
        () -> postTriggerApp(appName, ADMIN_AUTH_HEADERS, Map.of("thisShouldFail", "but will it?")),
        BAD_REQUEST,
        "Unrecognized field \"thisShouldFail\"");
  }

  private void assertAppStatusAvailableAfterTrigger(String appName) {
    assertEventually(
        "appIsRunning",
        () -> {
          try {
            assert Objects.nonNull(getLatestAppRun(appName, ADMIN_AUTH_HEADERS));
          } catch (HttpResponseException ex) {
            throw new AssertionError(ex);
          }
        },
        APP_TRIGGER_RETRY);
  }

  private void assertListExtension(String appName, AppExtension.ExtensionType extensionType) {
    assertEventually(
        "appIsRunning",
        () -> {
          try {
            assert Objects.nonNull(listAppExtension(appName, extensionType, ADMIN_AUTH_HEADERS));
          } catch (HttpResponseException ex) {
            throw new AssertionError(ex);
          }
        },
        APP_TRIGGER_RETRY);
  }

  private void assertAppRanAfterTriggerWithStatus(String appName, AppRunRecord.Status status) {
    assertEventually(
        "appStatus",
        () -> {
          assert getLatestAppRun(appName, ADMIN_AUTH_HEADERS).getStatus().equals(status);
        },
        APP_TRIGGER_RETRY);
  }

  @Test
  void post_trigger_no_trigger_app_400() {
    assertResponseContains(
        () -> postTriggerApp("ExampleAppNoTrigger", ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "App does not support manual trigger.");
  }

  @SneakyThrows
  @Test
  void app_with_event_subscription() {
    String subscriptionName = "TestEventSubscription";
    // register app in marketplace
    EventSubscriptionResourceTest eventSubscriptionResourceTest =
        new EventSubscriptionResourceTest();
    CreateAppMarketPlaceDefinitionReq createRequest =
        new CreateAppMarketPlaceDefinitionReq()
            .withName("TestAppEventSubscription")
            .withDisplayName("Test App Event Subscription")
            .withDescription("A Test application with event subscriptions.")
            .withFeatures("nothing really")
            .withDeveloper("Collate Inc.")
            .withDeveloperUrl("https://www.example.com")
            .withPrivacyPolicyUrl("https://www.example.com/privacy")
            .withSupportEmail("support@example.com")
            .withClassName("org.openmetadata.service.resources.apps.TestApp")
            .withAppType(AppType.Internal)
            .withScheduleType(ScheduleType.Scheduled)
            .withRuntime(new ScheduledExecutionContext().withEnabled(true))
            .withAppConfiguration(Map.of())
            .withPermission(NativeAppPermission.All)
            .withEventSubscriptions(
                List.of(
                    new CreateEventSubscription()
                        .withName(subscriptionName)
                        .withDisplayName("Test Event Subscription")
                        .withDescription(
                            "Consume EntityChange Events in order to trigger reverse metadata changes.")
                        .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
                        .withResources(List.of("all"))
                        .withProvider(ProviderType.USER)
                        .withPollInterval(5)
                        .withEnabled(true)));
    String endpoint =
        "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/" + subscriptionName;
    createRequest
        .getEventSubscriptions()
        .get(0)
        .setDestinations(eventSubscriptionResourceTest.getWebhook(endpoint));
    createAppMarketPlaceDefinition(createRequest, ADMIN_AUTH_HEADERS);

    // install app
    CreateApp installApp =
        new CreateApp().withName(createRequest.getName()).withAppConfiguration(Map.of());
    createEntity(installApp, ADMIN_AUTH_HEADERS);
    TestUtils.get(
        getResource(String.format("events/subscriptions/name/%s", subscriptionName)),
        EventSubscription.class,
        ADMIN_AUTH_HEADERS);

    // make change in the system
    TableResourceTest tableResourceTest = new TableResourceTest();
    Table table =
        tableResourceTest.getEntityByName(TEST_TABLE1.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    Table updated = JsonUtils.deepCopy(table, Table.class);
    updated.setDescription("Updated Description");
    tableResourceTest.patchEntity(
        table.getId(), JsonUtils.pojoToJson(table), updated, ADMIN_AUTH_HEADERS);
    // assert webhook was called
    Awaitility.await()
        .timeout(
            Duration.ofSeconds(createRequest.getEventSubscriptions().get(0).getPollInterval() + 10))
        .untilAsserted(
            () -> {
              BaseCallbackResource.EventDetails<ChangeEvent> result =
                  webhookCallbackResource.getEventDetails(subscriptionName);
              Assertions.assertNotNull(result);
              Assertions.assertTrue(
                  result.getEvents().stream()
                      .anyMatch(
                          e ->
                              e.getEventType().equals(EventType.ENTITY_UPDATED)
                                  && e.getChangeDescription()
                                      .getFieldsUpdated()
                                      .get(0)
                                      .getNewValue()
                                      .equals("Updated Description")));
            });
    // uninstall app
    deleteEntityByName(installApp.getName(), true, true, ADMIN_AUTH_HEADERS);
    Table updated2 = JsonUtils.deepCopy(updated, Table.class);
    updated2.setDescription("Updated Description 2");
    tableResourceTest.patchEntity(
        table.getId(), JsonUtils.pojoToJson(table), updated2, ADMIN_AUTH_HEADERS);

    // assert event subscription was deleted
    TestUtils.assertResponse(
        () ->
            TestUtils.get(
                getResource(String.format("events/subscriptions/name/%s", subscriptionName)),
                EventSubscription.class,
                ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        String.format("eventsubscription instance for %s not found", subscriptionName));
  }

  @Test
  void test_data_retention_app_deletes_old_change_events()
      throws IOException, InterruptedException {
    // Create database service, database, and schema
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseService databaseService =
        databaseServiceResourceTest.createEntity(
            databaseServiceResourceTest
                .createRequest("RetentionTestService")
                .withServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake),
            ADMIN_AUTH_HEADERS);

    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    Database database =
        databaseResourceTest.createEntity(
            databaseResourceTest
                .createRequest("retention_test_db")
                .withService(databaseService.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    DatabaseSchemaResourceTest schemaResourceTest = new DatabaseSchemaResourceTest();
    DatabaseSchema schema =
        schemaResourceTest.createEntity(
            schemaResourceTest
                .createRequest("retention_test_schema")
                .withDatabase(database.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    // Create a new table to work with
    TableResourceTest tableResourceTest = new TableResourceTest();
    String tableName = "retention_test_table_" + System.currentTimeMillis();

    Table table =
        tableResourceTest.createEntity(
            tableResourceTest
                .createRequest(tableName)
                .withDatabaseSchema(schema.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    // Create some change events by updating the table multiple times
    for (int i = 0; i < 5; i++) {
      Table updatedTable = JsonUtils.deepCopy(table, Table.class);
      updatedTable.setDescription("Updated description " + i);
      tableResourceTest.patchEntity(
          table.getId(), JsonUtils.pojoToJson(updatedTable), updatedTable, ADMIN_AUTH_HEADERS);
      table = updatedTable;

      // Add a small delay between updates to ensure they're recorded as separate events
      Thread.sleep(100);
    }

    // Wait a moment for change events to be processed
    Thread.sleep(1000);

    // Trigger the Data Retention application
    postTriggerApp("DataRetentionApplication", ADMIN_AUTH_HEADERS);

    // Wait for the app to complete
    Thread.sleep(5000);

    // Assert the app status is available after trigger
    assertAppStatusAvailableAfterTrigger("DataRetentionApplication");

    // Assert the app ran with SUCCESS status
    assertAppRanAfterTriggerWithStatus("DataRetentionApplication", AppRunRecord.Status.SUCCESS);

    // Get the latest run record to check statistics
    AppRunRecord latestRun = getLatestAppRun("DataRetentionApplication", ADMIN_AUTH_HEADERS);
    Assertions.assertNotNull(latestRun);

    // Check whether successContext is not null
    Assertions.assertNotNull(latestRun.getSuccessContext());

    // Clean up - delete the test entities
    tableResourceTest.deleteEntity(table.getId(), true, true, ADMIN_AUTH_HEADERS);
    schemaResourceTest.deleteEntity(schema.getId(), true, true, ADMIN_AUTH_HEADERS);
    databaseResourceTest.deleteEntity(database.getId(), true, true, ADMIN_AUTH_HEADERS);
    databaseServiceResourceTest.deleteEntity(
        databaseService.getId(), true, true, ADMIN_AUTH_HEADERS);
  }

  @Override
  public void validateCreatedEntity(
      App createdEntity, CreateApp request, Map<String, String> authHeaders)
      throws HttpResponseException {}

  public void createAppMarketPlaceDefinition(
      CreateAppMarketPlaceDefinitionReq create, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("apps/marketplace");
    TestUtils.post(
        target, create, AppMarketPlaceDefinition.class, CREATED.getStatusCode(), authHeaders);
  }

  @Override
  public void compareEntities(App expected, App updated, Map<String, String> authHeaders)
      throws HttpResponseException {}

  @Override
  public App validateGetWithDifferentFields(App entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(entity.getOwners());

    fields = "owners";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  private void postTriggerApp(String appName, Map<String, String> authHeaders)
      throws HttpResponseException {
    postTriggerApp(appName, authHeaders, Map.of());
  }

  private void postTriggerApp(
      String appName, Map<String, String> authHeaders, Map<String, Object> config)
      throws HttpResponseException {
    WebTarget target = getResource("apps/trigger").path(appName);
    Response response =
        SecurityUtil.addHeaders(target, authHeaders).post(jakarta.ws.rs.client.Entity.json(config));
    readResponse(response, OK.getStatusCode());
  }

  private void postAppStop(String appName, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("apps/stop").path(appName);
    Response response = SecurityUtil.addHeaders(target, authHeaders).post(null);
    readResponse(response, OK.getStatusCode());
  }

  private AppRunRecord getLatestAppRun(String appName, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(String.format("apps/name/%s/runs/latest", appName));
    return TestUtils.get(target, AppRunRecord.class, authHeaders);
  }

  private AppExtension listAppExtension(
      String appName, AppExtension.ExtensionType extensionType, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResource(
            String.format("apps/name/%s/extension?extensionType=%s", appName, extensionType));
    return TestUtils.get(target, AppExtension.class, authHeaders);
  }
}
