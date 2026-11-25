package org.openmetadata.it.tests.alerts;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.openmetadata.service.alerting.AlertPublisher;
import org.openmetadata.service.events.consumer.SelfDrivenConsumer;
import org.openmetadata.service.util.DIContainer;
import org.quartz.JobExecutionContext;

/**
 * A consumer that makes its own work, as a self-driven one does, named through the alert's
 * className. A test says what its next tick reports; every other tick reports nothing.
 */
public class ReportingConsumer extends AlertPublisher implements SelfDrivenConsumer {
  static final String ID = "test.reporting";

  private record Report(int delivered, int failed) {}

  private static final Map<UUID, Report> NEXT = new ConcurrentHashMap<>();

  public ReportingConsumer(DIContainer dependencies) {
    super(dependencies);
  }

  static void reportOnNextTick(UUID alertId, int delivered, int failed) {
    NEXT.put(alertId, new Report(delivered, failed));
  }

  @Override
  protected void doInit(JobExecutionContext context) {
    Report report = NEXT.remove(getEventSubscription().getId());
    if (report != null) {
      recordDelivery(report.delivered(), report.failed());
      if (report.failed() > 0) {
        recordFailure("the fixture failed " + report.failed());
      }
    }
  }
}
