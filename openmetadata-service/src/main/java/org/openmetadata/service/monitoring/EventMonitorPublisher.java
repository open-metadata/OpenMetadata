package org.openmetadata.service.monitoring;

import com.fasterxml.jackson.core.JsonProcessingException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.filter.EventFilter;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.AbstractEventPublisher;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.resources.events.EventResource;

import java.util.ArrayList;

@Slf4j
public class EventMonitorPublisher extends AbstractEventPublisher {

    private final EventMonitor eventMonitor;

    public EventMonitorPublisher(EventMonitorConfiguration config, EventMonitor eventMonitor) {
        super(config.getBatchSize(), new ArrayList<>());
        this.eventMonitor = eventMonitor;
    }

    @Override
    public void publish(EventResource.ChangeEventList events) throws EventPublisherException, JsonProcessingException {
        for (ChangeEvent event : events.getData()) {
            String entityType = event.getEntityType();
            if (Entity.INGESTION_PIPELINE.equals(entityType)) {
                this.eventMonitor.pushMetric(event);
            }
        }
    }

    @Override
    public void onStart() {
        LOG.info("Event Monitor Publisher Started");
    }


    @Override
    public void onShutdown() {
        LOG.info("Event Monitor Publisher Closed");
    }
}
