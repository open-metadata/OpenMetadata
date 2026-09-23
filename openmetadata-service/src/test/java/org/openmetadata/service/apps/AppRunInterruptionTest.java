package org.openmetadata.service.apps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.InetAddress;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.utils.JsonUtils;

class AppRunInterruptionTest {

  @Test
  void startupFailureNamesThisServerSoItsRestartHistoryCanBeFound() throws Exception {
    final IndexingError failure =
        JsonUtils.readValue(AppRunInterruption.stillRunningAtStartup(), IndexingError.class);

    assertEquals(IndexingError.ErrorSource.JOB, failure.getErrorSource());
    assertTrue(
        failure
            .getMessage()
            .startsWith(
                "Still running when server '" + InetAddress.getLocalHost().getHostName() + "'"),
        failure.getMessage());
  }

  @Test
  void failureCarriesTheGivenReasonAsAJobError() {
    final IndexingError failure =
        JsonUtils.readValue(
            AppRunInterruption.failure("Job abandoned due to server crash or shutdown"),
            IndexingError.class);

    assertEquals(IndexingError.ErrorSource.JOB, failure.getErrorSource());
    assertEquals("Job abandoned due to server crash or shutdown", failure.getMessage());
  }

  @Test
  void onlyARunCarryingTheMarkerCountsAsInterrupted() {
    final AppRunRecord marked =
        new AppRunRecord()
            .withFailureContext(
                new FailureContext().withAdditionalProperty(AppRunInterruption.INTERRUPTED, true));
    final AppRunRecord failedByItself =
        new AppRunRecord()
            .withFailureContext(
                new FailureContext().withFailure(new IndexingError().withMessage("bad input")));

    assertTrue(AppRunInterruption.isInterrupted(marked));
    assertFalse(AppRunInterruption.isInterrupted(failedByItself));
    assertFalse(AppRunInterruption.isInterrupted(new AppRunRecord()));
  }
}
