package org.openmetadata.service.monitoring;

import org.openmetadata.schema.monitoring.EventMonitorProvider;
import org.openmetadata.schema.type.ChangeEvent;

public class CloudwatchEventMonitor extends EventMonitor {

    private static CloudwatchEventMonitor INSTANCE;

    public CloudwatchEventMonitor(EventMonitorProvider eventMonitorProvider, String clusterPrefix) {
        super(eventMonitorProvider, clusterPrefix);
    }

    public static CloudwatchEventMonitor getInstance(EventMonitorProvider eventMonitorProvider, String clusterPrefix) {
        if (INSTANCE == null) INSTANCE = new CloudwatchEventMonitor(eventMonitorProvider, clusterPrefix);
        return INSTANCE;
    }

    @Override
    protected void pushMetric(ChangeEvent event) {

        System.out.println(event);
    }
}
