package org.openmetadata.service.resources.apps;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.schema.type.ColumnDataType.INT;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.getSearchRepository;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertEventually;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;
import static org.openmetadata.service.util.TestUtils.readResponse;

import es.org.elasticsearch.client.Request;
import es.org.elasticsearch.client.RestClient;
import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.apache.http.util.EntityUtils;
import org.junit.jupiter.api.Test;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.analytics.PageViewData;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.TableProfile;
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
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
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
    String clusterAlias = getSearchRepository().getClusterAlias();
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

  @Override
  public void validateCreatedEntity(
      App createdEntity, CreateApp request, Map<String, String> authHeaders)
      throws HttpResponseException {}

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
    WebTarget target = getResource("apps/trigger").path(appName);
    Response response = SecurityUtil.addHeaders(target, authHeaders).post(null);
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
