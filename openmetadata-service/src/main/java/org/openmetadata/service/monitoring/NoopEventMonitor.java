package org.openmetadata.service.monitoring;

import org.openmetadata.schema.monitoring.EventMonitorProvider;
import org.openmetadata.schema.type.ChangeEvent;

public class NoopEventMonitor extends EventMonitor {

    private static NoopEventMonitor INSTANCE;

    private NoopEventMonitor(EventMonitorProvider eventMonitorProvider, String clusterPrefix) {
        super(eventMonitorProvider, clusterPrefix);
    }

    public static NoopEventMonitor getInstance(EventMonitorProvider eventMonitorProvider, String clusterPrefix) {
        if (INSTANCE == null) INSTANCE = new NoopEventMonitor(eventMonitorProvider, clusterPrefix);
        return INSTANCE;
    }

    @Override
    protected void pushMetric(ChangeEvent event) {}

}
