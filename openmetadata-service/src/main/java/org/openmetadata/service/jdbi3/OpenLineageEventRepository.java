package org.openmetadata.service.jdbi3;


import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;

import org.openmetadata.schema.lineage.OpenLineageWrappedEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.schema.type.EventType.OPEN_LINEAGE_EVENT_DELETED;


@Slf4j
@Repository
public class OpenLineageEventRepository {
  private final CollectionDAO dao;

  public OpenLineageEventRepository() {
    this.dao = Entity.getCollectionDAO();
    Entity.setOpenLineageEventRepository(this);
    ResourceRegistry.addResource("openLineageEvent", null, Entity.getEntityFields(OpenLineageWrappedEvent.class));
  }

  @Transaction
  public OpenLineageWrappedEvent create(OpenLineageWrappedEvent openLineageEvent) {
    store(openLineageEvent);
    return openLineageEvent;
  }

  private List<OpenLineageWrappedEvent> getLineageEventsList(List<String> jsons) {
    List<OpenLineageWrappedEvent> lineageEvents = new ArrayList<>();
    for (String json : jsons) {
      OpenLineageWrappedEvent lineageEvent = JsonUtils.readValue(json, OpenLineageWrappedEvent.class);
      lineageEvents.add(lineageEvent);
    }
    return lineageEvents;
  }


  public final ResultList<OpenLineageWrappedEvent> listAll() {
    List<String> jsons =
            dao.openLineageEventDAO()
                    .listAll();
    List<OpenLineageWrappedEvent> lineageEvents = getLineageEventsList(jsons);
    return new ResultList<>(lineageEvents,null,null,lineageEvents.size());
  }

  public final List<String> listAllEvents() {

    return dao.openLineageEventDAO()
            .listAll();
  }

  public ResultList<OpenLineageWrappedEvent> queryEvents(String runId, String eventType, Boolean unprocessed) {

    List<String> jsons = dao.openLineageEventDAO().queryEvents(runId, eventType, unprocessed);
    List<OpenLineageWrappedEvent> lineageEvents = getLineageEventsList(jsons);
    return new ResultList<>(lineageEvents, null, null, lineageEvents.size());
  }

  @Transaction
  public void store(OpenLineageWrappedEvent openLineageEvent) {
    // Insert a new LineageEvent
    dao.openLineageEventDAO().insert(JsonUtils.pojoToJson(openLineageEvent));
  }

  @Transaction
  public void markAsProcessed(UUID eventId) {
    dao.openLineageEventDAO().markAsProcessed(eventId);
    LOG.debug("LineageEvent with id {} marked as processed", eventId);
  }

  @Transaction
  public RestUtil.DeleteResponse<OpenLineageWrappedEvent> deleteLineageEvent(
          OpenLineageWrappedEvent lineageEvent) {
    dao.openLineageEventDAO().deleteById(lineageEvent.getId());
    LOG.debug("deleted LineageEvent with id {}", lineageEvent.getId());
    return new RestUtil.DeleteResponse<>(lineageEvent, OPEN_LINEAGE_EVENT_DELETED);
  }

}
