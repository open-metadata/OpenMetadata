package org.openmetadata.service.monitoring;

import com.google.common.annotations.VisibleForTesting;
import lombok.Getter;
import org.openmetadata.schema.monitoring.EventMonitorProvider;

public class EventMonitorFactory {

    @Getter private static EventMonitor eventMonitor;

    public static EventMonitor createEventMonitor(EventMonitorConfiguration config, String clusterName) {
        if (eventMonitor != null) {
            return eventMonitor;
        }
        EventMonitorProvider eventMonitorProvider =
            config != null && config.getEventMonitor() != null
                ? config.getEventMonitor()
                : EventMonitorConfiguration.DEFAULT_EVENT_MONITORING;

        switch (eventMonitorProvider) {
            case NOOP:
              eventMonitor = NoopEventMonitor.getInstance(eventMonitorProvider, clusterName);
              break;
          case CLOUDWATCH:
              eventMonitor = CloudwatchEventMonitor.getInstance(eventMonitorProvider, clusterName);
              break;
          default:
              throw new IllegalArgumentException("Not implemented Event monitor: " + eventMonitorProvider);
        }

        return eventMonitor;

    }

    @VisibleForTesting
    public static void setEventMonitor(EventMonitor eventMonitor) {
        EventMonitorFactory.eventMonitor = eventMonitor;
    }
}
