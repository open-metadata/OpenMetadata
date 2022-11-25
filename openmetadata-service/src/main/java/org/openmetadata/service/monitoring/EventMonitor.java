package org.openmetadata.service.monitoring;

import lombok.Getter;
import org.openmetadata.schema.monitoring.EventMonitorProvider;
import org.openmetadata.schema.type.ChangeEvent;

public abstract class EventMonitor {

  @Getter private final String clusterPrefix;

  @Getter private final EventMonitorProvider eventMonitoringProvider;
  @Getter private final EventMonitorConfiguration eventMonitorConfiguration;

  protected EventMonitor(
      EventMonitorProvider eventMonitorProvider, EventMonitorConfiguration config, String clusterPrefix) {
    this.eventMonitoringProvider = eventMonitorProvider;
    this.clusterPrefix = clusterPrefix;
    this.eventMonitorConfiguration = config;
  }

  protected String buildMetricNamespace(String namespace) {
    return String.format("%s/%s", this.clusterPrefix, namespace);
  }

  protected abstract void pushMetric(ChangeEvent event);

  protected abstract void close();
}
