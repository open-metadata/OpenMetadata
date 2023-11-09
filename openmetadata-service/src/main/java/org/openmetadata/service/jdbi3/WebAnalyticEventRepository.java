package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.WEB_ANALYTIC_EVENT;

import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

public class WebAnalyticEventRepository extends EntityRepository<WebAnalyticEvent> {
  public static final String COLLECTION_PATH = "/v1/analytics/web/events";
  private static final String WEB_ANALYTICS_EVENT_DATA_EXTENSION = "webAnalyticEvent.webAnalyticEventData";

  public WebAnalyticEventRepository() {
    super(
        COLLECTION_PATH,
        WEB_ANALYTIC_EVENT,
        WebAnalyticEvent.class,
        Entity.getCollectionDAO().webAnalyticEventDAO(),
        "",
        "");
  }

  @Override
  public WebAnalyticEvent setFields(WebAnalyticEvent entity, EntityUtil.Fields fields) {
    return entity;
  }

  @Override
  public WebAnalyticEvent clearFields(WebAnalyticEvent entity, EntityUtil.Fields fields) {
    return entity;
  }

  @Override
  public void prepare(WebAnalyticEvent entity, boolean update) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(WebAnalyticEvent entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(WebAnalyticEvent entity) {
    // No relationships to store beyond what is stored in the super class
  }

  public Response addWebAnalyticEventData(WebAnalyticEventData webAnalyticEventData) {
    webAnalyticEventData.setEventId(UUID.randomUUID());
    storeTimeSeries(
        webAnalyticEventData.getEventType().value(),
        WEB_ANALYTICS_EVENT_DATA_EXTENSION,
        "webAnalyticEventData",
        JsonUtils.pojoToJson(webAnalyticEventData));
    return Response.ok(webAnalyticEventData).build();
  }

  public void deleteWebAnalyticEventData(WebAnalyticEventType name, Long timestamp) {
    deleteExtensionBeforeTimestamp(name.value(), WEB_ANALYTICS_EVENT_DATA_EXTENSION, timestamp);
  }

  public ResultList<WebAnalyticEventData> getWebAnalyticEventData(String eventType, Long startTs, Long endTs) {
    List<WebAnalyticEventData> webAnalyticEventData;
    webAnalyticEventData =
        JsonUtils.readObjects(
            getResultsFromAndToTimestamps(eventType, WEB_ANALYTICS_EVENT_DATA_EXTENSION, startTs, endTs),
            WebAnalyticEventData.class);

    return new ResultList<>(
        webAnalyticEventData, String.valueOf(startTs), String.valueOf(endTs), webAnalyticEventData.size());
  }
}
