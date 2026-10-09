package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.consumer.Consumers;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.utils.DataMigrationStep;
import org.openmetadata.service.migration.utils.v220.ConsumerIdMigration;

/**
 * The upgrade to the release where an alert names its consumer by id. An alert stored under its
 * consumer's class names that consumer's id afterwards; one naming a consumer nothing answers to
 * is left as it is.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class ConsumerIdMigrationIT {
  private static final String STORED_BEFORE_IDS =
      "org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher";
  private static final String NOTHING_ANSWERS = "org.example.NoSuchConsumer";

  @Test
  void anAlertStoredUnderItsConsumersClassNamesItsId(TestNamespace ns) {
    EventSubscription byClass = storedNaming(ns, "by_class", STORED_BEFORE_IDS);
    EventSubscription byNobody = storedNaming(ns, "by_nobody", NOTHING_ANSWERS);

    ConsumerIdMigration.storeConsumerIds(Entity.getCollectionDAO());

    assertEquals(Consumers.DEFAULT, AlertFixtures.stored(byClass.getId()).getClassName());
    assertEquals(NOTHING_ANSWERS, AlertFixtures.stored(byNobody.getId()).getClassName());
  }

  /**
   * The suite's bootstrap ran the real migration workflow, so the step already recorded its marker,
   * and a later re-run of 2.2.0 does not run it again.
   */
  @Test
  void theUpgradeRecordedTheStepSoAReRunLeavesTheAlertsAlone() {
    MigrationDAO migrationDAO = TestSuiteBootstrap.getJdbi().onDemand(MigrationDAO.class);
    AtomicInteger runs = new AtomicInteger();

    DataMigrationStep.runOnce(
        migrationDAO, "2.2.0", ConsumerIdMigration.STEP_NAME, runs::incrementAndGet);

    assertEquals(0, runs.get(), "the upgrade already stored the ids, a re-run must not");
  }

  // As a previous release stored it, behind the server, and switched off so no tick runs it.
  private static EventSubscription storedNaming(TestNamespace ns, String name, String className) {
    EventSubscription alert =
        AlertFixtures.tableAlert(
            ns, name, null, List.of(AlertFixtures.external(WEBHOOK, "http://localhost:9/unused")));
    QuietAlert.settle(alert);
    return AlertFixtures.writeBehindTheServer(alert.withClassName(className).withEnabled(false));
  }
}
