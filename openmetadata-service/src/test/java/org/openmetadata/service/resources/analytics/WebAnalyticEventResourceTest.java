package org.openmetadata.service.resources.analytics;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.text.ParseException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.analytics.PageViewData;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.api.tests.CreateWebAnalyticEvent;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.analytics.WebAnalyticEventResource.WebAnalyticEventDataList;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

public class WebAnalyticEventResourceTest
    extends EntityResourceTest<WebAnalyticEvent, CreateWebAnalyticEvent> {
  public WebAnalyticEventResourceTest() {
    super(
        Entity.WEB_ANALYTIC_EVENT,
        WebAnalyticEvent.class,
        WebAnalyticEventResource.WebAnalyticEventList.class,
        "analytics/web/events",
        WebAnalyticEventResource.FIELDS);
    supportsSearchIndex = false;
  }

  @Test
  void post_web_analytic_event_200(TestInfo test) throws IOException {
    CreateWebAnalyticEvent create = createRequest(test);
    create.withName("bar").withEventType(WebAnalyticEventType.PAGE_VIEW);
    WebAnalyticEvent webAnalyticEvent = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    webAnalyticEvent = getEntity(webAnalyticEvent.getId(), ADMIN_AUTH_HEADERS);
    validateCreatedEntity(webAnalyticEvent, create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_web_analytic_event_4x(TestInfo test) {
    assertResponseContains(
        () -> createEntity(createRequest(test).withEventType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "query param eventType must not be null");

    assertResponseContains(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "query param name must not be null");
  }

  @Test
  void put_and_delete_web_analytic_event_data_200() throws IOException, ParseException {
    String[] dates = {"2022-10-11", "2022-10-10", "2022-10-09", "2022-10-08"};

    for (String date : dates) {
      WebAnalyticEventData webAnalyticEventData =
          new WebAnalyticEventData()
              .withTimestamp(TestUtils.dateToTimestamp(date))
              .withEventType(WebAnalyticEventType.PAGE_VIEW)
              .withEventData(
                  new PageViewData()
                      .withHostname("http://localhost")
                      .withUserId(UUID.randomUUID())
                      .withSessionId(UUID.randomUUID()));
      putWebAnalyticEventData(webAnalyticEventData, ADMIN_AUTH_HEADERS);

      ResultList<WebAnalyticEventData> webAnalyticEventDataResultList =
          getWebAnalyticEventData(
              WebAnalyticEventType.PAGE_VIEW.value(),
              TestUtils.dateToTimestamp(date),
              TestUtils.dateToTimestamp(date),
              ADMIN_AUTH_HEADERS);

      verifyWebAnalyticEventData(webAnalyticEventDataResultList, List.of(webAnalyticEventData), 1);
    }

    deleteWebAnalyticEventData(
        TestUtils.dateToTimestamp("2022-10-11"), authHeaders(BOT_USER.getName()));

    ResultList<WebAnalyticEventData> webAnalyticEventDataResultList =
        getWebAnalyticEventData(
            WebAnalyticEventType.PAGE_VIEW.value(),
            TestUtils.dateToTimestamp("2022-10-11"),
            TestUtils.dateToTimestamp("2022-10-11"),
            ADMIN_AUTH_HEADERS);

    assertEquals(1, webAnalyticEventDataResultList.getData().size());

    ResultList<WebAnalyticEventData> emptyWebAnalyticEventDataResultList =
        getWebAnalyticEventData(
            WebAnalyticEventType.PAGE_VIEW.value(),
            TestUtils.dateToTimestamp("2022-10-08"),
            TestUtils.dateToTimestamp("2022-10-10"),
            ADMIN_AUTH_HEADERS);

    assertEquals(0, emptyWebAnalyticEventDataResultList.getData().size());
  }

  @Test
  void put_and_delete_web_analytic_event_data_403() throws IOException, ParseException {
    WebAnalyticEventData webAnalyticEventData =
        new WebAnalyticEventData()
            .withTimestamp(TestUtils.dateToTimestamp("2022-10-08"))
            .withEventType(WebAnalyticEventType.PAGE_VIEW)
            .withEventData(
                new PageViewData()
                    .withHostname("http://localhost")
                    .withUserId(UUID.randomUUID())
                    .withSessionId(UUID.randomUUID()));
    putWebAnalyticEventData(webAnalyticEventData, ADMIN_AUTH_HEADERS);

    assertResponse(
        () ->
            deleteWebAnalyticEventData(
                TestUtils.dateToTimestamp("2022-10-11"), authHeaders(DATA_CONSUMER.getName())),
        FORBIDDEN,
        permissionNotAllowed(DATA_CONSUMER.getName(), List.of(MetadataOperation.DELETE)));
  }

  @Override
  public CreateWebAnalyticEvent createRequest(String name) {
    return new CreateWebAnalyticEvent()
        .withName(name)
        .withDescription(name)
        .withEventType(WebAnalyticEventType.PAGE_VIEW);
  }

  @Override
  public void validateCreatedEntity(
      WebAnalyticEvent createdEntity,
      CreateWebAnalyticEvent request,
      Map<String, String> authHeaders) {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
  }

  @Override
  public void compareEntities(
      WebAnalyticEvent expected, WebAnalyticEvent updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getDescription(), updated.getDescription());
  }

  @Override
  public WebAnalyticEvent validateGetWithDifferentFields(WebAnalyticEvent entity, boolean byName)
      throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwners());
    fields = "owners";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(entity.getOwners());
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {}

  public void putWebAnalyticEventData(WebAnalyticEventData data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/collect");
    TestUtils.put(target, data, OK, authHeaders);
  }

  public void deleteWebAnalyticEventData(Long timestamp, Map<String, String> authHeaders)
      throws IOException {
    String url = String.format("/%s/%s/collect", WebAnalyticEventType.PAGE_VIEW.value(), timestamp);
    WebTarget target = getCollection().path(url);
    TestUtils.delete(target, WebAnalyticEvent.class, authHeaders);
  }

  public ResultList<WebAnalyticEventData> getWebAnalyticEventData(
      String eventType, Long start, Long end, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/collect");
    target = target.queryParam("startTs", start);
    target = target.queryParam("endTs", end);
    target = target.queryParam("eventType", eventType);
    return TestUtils.get(target, WebAnalyticEventDataList.class, authHeaders);
  }

  private void verifyWebAnalyticEventData(
      ResultList<WebAnalyticEventData> actualWebAnalyticEventData,
      List<WebAnalyticEventData> expectedWebAnalyticEventData,
      int expectedCount) {
    assertEquals(expectedCount, actualWebAnalyticEventData.getPaging().getTotal());
    assertEquals(expectedWebAnalyticEventData.size(), actualWebAnalyticEventData.getData().size());
  }
}
