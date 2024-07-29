package org.openmetadata.service.resources.apps;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertEventually;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;
import static org.openmetadata.service.util.TestUtils.readResponse;

import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Objects;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.security.SecurityUtil;
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

  public static RetryRegistry appTriggerRetry =
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
    assertAppRanAfterTrigger(appName);
  }

  private void assertAppRanAfterTrigger(String appName) {
    assertEventually(
        "appIsRunning",
        () -> {
          try {
            assert Objects.nonNull(getLatestAppRun(appName, ADMIN_AUTH_HEADERS));
          } catch (HttpResponseException ex) {
            throw new AssertionError(ex);
          }
        },
        appTriggerRetry);
    assertEventually(
        "appSuccess",
        () -> {
          assert getLatestAppRun(appName, ADMIN_AUTH_HEADERS)
              .getStatus()
              .equals(AppRunRecord.Status.SUCCESS);
        },
        appTriggerRetry);
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
    TestUtils.assertListNull(entity.getOwner());

    fields = "owner";
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

  private AppRunRecord getLatestAppRun(String appName, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(String.format("apps/name/%s/runs/latest", appName));
    return TestUtils.get(target, AppRunRecord.class, authHeaders);
  }
}
