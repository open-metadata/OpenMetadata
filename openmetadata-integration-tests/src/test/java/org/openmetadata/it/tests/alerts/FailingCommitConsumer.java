package org.openmetadata.it.tests.alerts;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.util.DIContainer;
import org.quartz.JobExecutionContext;

/**
 * An alert consumer whose commit fails while a test asks it to, named through the alert's
 * className. It behaves exactly like the default consumer otherwise.
 */
public class FailingCommitConsumer extends AlertPublisher {
  static final String ID = "test.failingCommit";

  private static final Set<UUID> FAILING = ConcurrentHashMap.newKeySet();

  public FailingCommitConsumer(DIContainer dependencies) {
    super(dependencies);
  }

  static void fail(UUID alertId) {
    FAILING.add(alertId);
  }

  static void recover(UUID alertId) {
    FAILING.remove(alertId);
  }

  @Override
  public void commit(JobExecutionContext context) {
    if (FAILING.contains(getEventSubscription().getId())) {
      throw new IllegalStateException("The database refused the commit");
    }
    super.commit(context);
  }
}
