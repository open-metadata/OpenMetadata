package org.openmetadata.service.governance.workflows;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.Consumer;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

public class WorkflowEventConsumer implements Consumer<ChangeEvent>, Job {
  @Override
  public List<ChangeEvent> pollEvents(long offset, long batchSize) {
    return null;
  }

  @Override
  public void publishEvents(Map<ChangeEvent, Set<UUID>> events) {}

  @Override
  public void handleFailedEvent(EventPublisherException e) {}

  @Override
  public void commit(JobExecutionContext jobExecutionContext) {
    long currentTime = System.currentTimeMillis();
    // Upsert Offset
    EventSubscriptionOffset eventSubscriptionOffset =
        new EventSubscriptionOffset().withOffset(offset).withTimestamp(currentTime);
    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertSubscriberExtension(
            eventSubscription.getId().toString(),
            OFFSET_EXTENSION,
            "eventSubscriptionOffset",
            JsonUtils.pojoToJson(eventSubscriptionOffset));
    jobExecutionContext
        .getJobDetail()
        .getJobDataMap()
        .put(ALERT_OFFSET_KEY, eventSubscriptionOffset);

    // Upsert Metrics
    AlertMetrics metrics =
        new AlertMetrics()
            .withTotalEvents(alertMetrics.getTotalEvents())
            .withFailedEvents(alertMetrics.getFailedEvents())
            .withSuccessEvents(alertMetrics.getSuccessEvents())
            .withTimestamp(currentTime);
    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertSubscriberExtension(
            eventSubscription.getId().toString(),
            METRICS_EXTENSION,
            "alertMetrics",
            JsonUtils.pojoToJson(metrics));
    jobExecutionContext.getJobDetail().getJobDataMap().put(METRICS_EXTENSION, alertMetrics);

    // Populate the Destination map
    jobExecutionContext.getJobDetail().getJobDataMap().put(DESTINATION_MAP_KEY, destinationMap);
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) throws JobExecutionException {
    // Must Have , Before Execute the Init, Quartz Requires a Non-Arg Constructor
    this.init(jobExecutionContext);
    // Poll Events from Change Event Table
    List<ChangeEvent> batch = pollEvents(offset, eventSubscription.getBatchSize());
    int batchSize = batch.size();
    Map<ChangeEvent, Set<UUID>> eventsWithReceivers = createEventsWithReceivers(batch);
    try {
      // Publish Events
      if (!eventsWithReceivers.isEmpty()) {
        alertMetrics.withTotalEvents(alertMetrics.getTotalEvents() + eventsWithReceivers.size());
        publishEvents(eventsWithReceivers);
      }
    } catch (Exception e) {
      LOG.error("Error in executing the Job : {} ", e.getMessage());
    } finally {
      if (!eventsWithReceivers.isEmpty()) {
        // Commit the Offset
        offset += batchSize;
        commit(jobExecutionContext);
      }
    }
  }
}
