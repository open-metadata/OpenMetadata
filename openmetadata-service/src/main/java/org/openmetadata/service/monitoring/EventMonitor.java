package org.openmetadata.service.monitoring;

import lombok.Getter;
import org.openmetadata.schema.monitoring.EventMonitorProvider;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.resources.events.EventResource.ChangeEventList;

public abstract class EventMonitor {

    @Getter private final String clusterPrefix;

    @Getter private final EventMonitorProvider eventMonitoringProvider;

    protected EventMonitor(EventMonitorProvider eventMonitorProvider, String clusterPrefix) {
        this.eventMonitoringProvider = eventMonitorProvider;
        this.clusterPrefix = clusterPrefix;
    }

    protected String buildMetricNamespace(String namespace) {
        return String.format("%s/%s", this.clusterPrefix, namespace);
    }

    protected abstract void pushMetric(ChangeEvent event);

}
