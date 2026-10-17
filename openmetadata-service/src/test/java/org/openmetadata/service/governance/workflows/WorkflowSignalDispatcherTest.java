package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class WorkflowSignalDispatcherTest {
  @ParameterizedTest
  @ValueSource(
      strings = {
        "Deadlock found when trying to get lock",
        "Lock wait timeout exceeded",
        "try restarting transaction",
        "was updated by another transaction concurrently",
        "OptimisticLockingFailureException"
      })
  void retriesTransientFlowableFailures(final String message) {
    assertTrue(
        WorkflowSignalDispatcher.isTransientDatabaseError(
            new IllegalStateException(new SQLException(message))));
  }

  @ParameterizedTest
  @ValueSource(strings = {"40001", "40P01"})
  void recognizesDatabaseRollbackWithoutRelyingOnTheErrorMessage(final String state) {
    assertTrue(
        WorkflowSignalDispatcher.isTransientDatabaseError(
            new IllegalStateException(new SQLException("Localized database failure", state))));
  }

  @Test
  void doesNotRetryPermanentOrMissingFailures() {
    assertFalse(WorkflowSignalDispatcher.isTransientDatabaseError(null));
    assertFalse(WorkflowSignalDispatcher.isTransientDatabaseError(new IllegalStateException()));
    assertFalse(
        WorkflowSignalDispatcher.isTransientDatabaseError(
            new IllegalArgumentException("Invalid workflow configuration")));
  }
}
