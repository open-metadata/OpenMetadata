package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.WEB_ANALYTIC_EVENT;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

public class WebAnalyticEventRepository extends EntityRepository<WebAnalyticEvent> {
  public static final String COLLECTION_PATH = "/v1/analytics/webAnalyticEvent";
  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";
  private static final String WEB_ANALYTICS_EVENT_DATA_EXTENSION = "webAnalyticEvent.webAnalyticEventData";

  public WebAnalyticEventRepository(CollectionDAO dao) {
    super(
        COLLECTION_PATH,
        WEB_ANALYTIC_EVENT,
        WebAnalyticEvent.class,
        dao.webAnalyticEventDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public WebAnalyticEvent setFields(WebAnalyticEvent entity, EntityUtil.Fields fields) {
    return entity;
  }

  @Override
  public void prepare(WebAnalyticEvent entity) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(WebAnalyticEvent entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();

    entity.withOwner(null).withHref(null);
    store(entity, update);

    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(WebAnalyticEvent entity) {
    storeOwner(entity, entity.getOwner());
  }

  @Transaction
  public Response addWebAnalyticEventData(WebAnalyticEventData webAnalyticEventData) throws IOException {
    webAnalyticEventData.setEventId(UUID.randomUUID());
    daoCollection
        .entityExtensionTimeSeriesDao()
        .insert(
            webAnalyticEventData.getEventType().value(),
            WEB_ANALYTICS_EVENT_DATA_EXTENSION,
            "webAnalyticEventData",
            JsonUtils.pojoToJson(webAnalyticEventData));

    return Response.ok(webAnalyticEventData).build();
  }

  @Transaction
  public void deleteWebAnalyticEventData(WebAnalyticEventType name, Long timestamp) {
    daoCollection
        .entityExtensionTimeSeriesDao()
        .deleteBeforeExclusive(name.value(), WEB_ANALYTICS_EVENT_DATA_EXTENSION, timestamp);
  }

  public ResultList<WebAnalyticEventData> getWebAnalyticEventData(String eventType, Long startTs, Long endTs)
      throws IOException {
    List<WebAnalyticEventData> webAnalyticEventData;
    webAnalyticEventData =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestamps(eventType, WEB_ANALYTICS_EVENT_DATA_EXTENSION, startTs, endTs),
            WebAnalyticEventData.class);

    return new ResultList<>(
        webAnalyticEventData, String.valueOf(startTs), String.valueOf(endTs), webAnalyticEventData.size());
  }
}
