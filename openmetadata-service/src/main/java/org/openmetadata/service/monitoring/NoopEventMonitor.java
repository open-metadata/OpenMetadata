package org.openmetadata.service.monitoring;

import org.openmetadata.schema.monitoring.EventMonitorProvider;
import org.openmetadata.schema.type.ChangeEvent;

public class NoopEventMonitor extends EventMonitor {

  private static NoopEventMonitor INSTANCE;

  private NoopEventMonitor(
      EventMonitorProvider eventMonitorProvider, EventMonitorConfiguration config, String clusterPrefix) {
    super(eventMonitorProvider, config, clusterPrefix);
  }

  public static NoopEventMonitor getInstance(
      EventMonitorProvider eventMonitorProvider, EventMonitorConfiguration config, String clusterPrefix) {
    if (INSTANCE == null) INSTANCE = new NoopEventMonitor(eventMonitorProvider, config, clusterPrefix);
    return INSTANCE;
  }

  @Override
  protected void pushMetric(ChangeEvent event) {}

  @Override
  protected void close() {}
}
