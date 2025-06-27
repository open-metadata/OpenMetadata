package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.WEB_ANALYTIC_EVENT;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class WebAnalyticEventRepository extends EntityRepository<WebAnalyticEvent> {
  public static final String COLLECTION_PATH = "/v1/analytics/web/events";
  private static final String WEB_ANALYTICS_EVENT_DATA_EXTENSION =
      "webAnalyticEvent.webAnalyticEventData";

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
  public void setFields(WebAnalyticEvent entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(WebAnalyticEvent entity, EntityUtil.Fields fields) {
    /* Nothing to do */
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

  public ResultList<WebAnalyticEventData> getWebAnalyticEventData(
      String eventType, Long startTs, Long endTs) {
    List<WebAnalyticEventData> webAnalyticEventData;
    webAnalyticEventData =
        JsonUtils.readObjects(
            getResultsFromAndToTimestamps(
                eventType, WEB_ANALYTICS_EVENT_DATA_EXTENSION, startTs, endTs),
            WebAnalyticEventData.class);

    return new ResultList<>(
        webAnalyticEventData,
        String.valueOf(startTs),
        String.valueOf(endTs),
        webAnalyticEventData.size());
  }

  public int listWebAnalyticEventDataCount(
      String eventType, Long startTs, Long endTs, boolean latest) {
    CollectionDAO.EntityExtensionTimeSeriesDAO timeSeriesDao =
        daoCollection.entityExtensionTimeSeriesDao();
    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(eventType));
    return timeSeriesDao.listCount(filter, startTs, endTs, latest);
  }

  public ResultList<WebAnalyticEventData> listWebAnalyticEventDataWithOffset(
      String offset,
      String eventType,
      int limitParam,
      Long startTs,
      Long endTs,
      boolean latest,
      boolean skipErrors) {
    CollectionDAO.EntityExtensionTimeSeriesDAO timeSeriesDao =
        daoCollection.entityExtensionTimeSeriesDao();
    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(eventType));

    int total = timeSeriesDao.listCount(filter, startTs, endTs, latest);
    List<WebAnalyticEventData> webAnalyticEventData = new ArrayList<>();
    List<EntityError> errors = null;
    int offsetInt = getOffset(offset);
    String afterOffset = getAfterOffset(offsetInt, limitParam, total);
    String beforeOffset = getBeforeOffset(offsetInt, limitParam);

    if (limitParam > 0) {
      List<String> jsons =
          timeSeriesDao.listWithOffset(filter, limitParam, offsetInt, startTs, endTs, latest);
      Map<String, List<?>> entityListMap = getEntityList(jsons, skipErrors);
      webAnalyticEventData = (List<WebAnalyticEventData>) entityListMap.get("entityList");
      if (skipErrors) {
        errors = (List<EntityError>) entityListMap.get("errors");
      }
      return getWebAnalyticEventDataResultList(
          webAnalyticEventData, beforeOffset, afterOffset, total, errors);
    } else {
      return getWebAnalyticEventDataResultList(webAnalyticEventData, null, null, total);
    }
  }

  private ResultList<WebAnalyticEventData> getWebAnalyticEventDataResultList(
      List<WebAnalyticEventData> entities,
      String beforeCursor,
      String afterCursor,
      int total,
      List<EntityError> errors) {
    if (errors == null) {
      return new ResultList<>(entities, beforeCursor, afterCursor, total);
    }
    return new ResultList<>(entities, errors, beforeCursor, afterCursor, total);
  }

  private ResultList<WebAnalyticEventData> getWebAnalyticEventDataResultList(
      List<WebAnalyticEventData> entities, String beforeCursor, String afterCursor, int total) {
    return getWebAnalyticEventDataResultList(entities, beforeCursor, afterCursor, total, null);
  }

  private String getAfterOffset(int offsetInt, int limit, int total) {
    int afterOffset = offsetInt + limit;
    // If afterOffset is greater than total, then set it to null to indicate end of list
    return afterOffset >= total ? null : String.valueOf(afterOffset);
  }

  private String getBeforeOffset(int offsetInt, int limit) {
    int beforeOffsetInt = offsetInt - limit;
    // If offset is negative, then set it to 0 if you pass offset 4 and limit 10, then the previous
    // page will be at offset 0
    if (beforeOffsetInt < 0) beforeOffsetInt = 0;
    // if offsetInt is 0 (i.e. either no offset or offset is 0), then set it to null as there is no
    // previous page
    return (offsetInt == 0) ? null : String.valueOf(beforeOffsetInt);
  }

  private int getOffset(String offset) {
    return offset != null ? Integer.parseInt(RestUtil.decodeCursor(offset)) : 0;
  }

  private Map<String, List<?>> getEntityList(List<String> jsons, boolean skipErrors) {
    List<WebAnalyticEventData> entityList = new ArrayList<>();
    List<EntityError> errors = new ArrayList<>();

    Map<String, List<?>> resultList = new HashMap<>();

    for (String json : jsons) {
      try {
        WebAnalyticEventData recordEntity = JsonUtils.readValue(json, WebAnalyticEventData.class);
        entityList.add(recordEntity);
      } catch (Exception e) {
        if (!skipErrors) {
          throw e;
        }
        errors.add(new EntityError().withMessage(e.getMessage()));
      }
    }
    resultList.put("entityList", entityList);
    resultList.put("errors", errors);
    return resultList;
  }
}
