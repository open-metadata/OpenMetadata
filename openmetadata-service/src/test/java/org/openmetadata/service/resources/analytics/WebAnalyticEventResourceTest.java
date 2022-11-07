package org.openmetadata.service.resources.analytics;

import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.text.ParseException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.analytics.PageViewData;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.api.tests.CreateWebAnalyticEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

public class WebAnalyticEventResourceTest extends EntityResourceTest<WebAnalyticEvent, CreateWebAnalyticEvent> {
  public WebAnalyticEventResourceTest() {
    super(
        Entity.WEB_ANALYTIC_EVENT,
        WebAnalyticEvent.class,
        WebAnalyticEventResource.WebAnalyticEventList.class,
        "analytics/webAnalyticEvent",
        WebAnalyticEventResource.FIELDS);
    supportsEmptyDescription = false;
    supportsFollowers = false;
    supportsAuthorizedMetadataOperations = false;
    supportsOwner = false;
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
        "eventType must not be null");

    assertResponseContains(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "name must not be null");
  }

  @Test
  void put_web_analytic_event_data_200() throws IOException, ParseException {
    WebAnalyticEventData webAnalyticEventData =
        new WebAnalyticEventData()
            .withTimestamp(TestUtils.dateToTimestamp("2022-10-11"))
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
            TestUtils.dateToTimestamp("2022-10-10"),
            TestUtils.dateToTimestamp("2022-10-12"),
            ADMIN_AUTH_HEADERS);

    verifyWebAnalyticEventData(webAnalyticEventDataResultList, List.of(webAnalyticEventData), 1);
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
      WebAnalyticEvent createdEntity, CreateWebAnalyticEvent request, Map<String, String> authHeaders) {
    assertEquals(request.getName(), createdEntity.getName());
    assertEquals(request.getDescription(), createdEntity.getDescription());
  }

  @Override
  public void compareEntities(WebAnalyticEvent expected, WebAnalyticEvent updated, Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getDescription(), updated.getDescription());
  }

  @Override
  public WebAnalyticEvent validateGetWithDifferentFields(WebAnalyticEvent entity, boolean byName) {
    return null;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {}

  public static void putWebAnalyticEventData(WebAnalyticEventData data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = OpenMetadataApplicationTest.getResource("analytics/webAnalyticEvent/collect");
    TestUtils.put(target, data, OK, authHeaders);
  }

  public static ResultList<WebAnalyticEventData> getWebAnalyticEventData(
      String eventType, Long start, Long end, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = OpenMetadataApplicationTest.getResource("analytics/webAnalyticEvent/collect");
    target = target.queryParam("startTs", start);
    target = target.queryParam("endTs", end);
    target = target.queryParam("eventType", eventType);
    return TestUtils.get(target, WebAnalyticEventResource.WebAnalyticEventDataList.class, authHeaders);
  }

  private void verifyWebAnalyticEventData(
      ResultList<WebAnalyticEventData> actualWebAnalyticEventData,
      List<WebAnalyticEventData> expectedWebAnalyticEventData,
      int expectedCount) {
    assertEquals(expectedCount, actualWebAnalyticEventData.getPaging().getTotal());
    assertEquals(expectedWebAnalyticEventData.size(), actualWebAnalyticEventData.getData().size());
  }
}
