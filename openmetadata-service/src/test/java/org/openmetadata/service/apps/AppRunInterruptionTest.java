package org.openmetadata.service.apps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.InetAddress;
import org.junit.jupiter.api.Test;
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
  void lockFailureNamesTheServerThatStoppedAndTheServerThatNoticed() throws Exception {
    final IndexingError failure =
        JsonUtils.readValue(
            AppRunInterruption.lockNoLongerRenewed("om-server-0"), IndexingError.class);

    assertEquals(IndexingError.ErrorSource.JOB, failure.getErrorSource());
    assertTrue(
        failure.getMessage().contains("server 'om-server-0' stopped renewing the lock"),
        failure.getMessage());
    assertTrue(
        failure
            .getMessage()
            .contains("server '" + InetAddress.getLocalHost().getHostName() + "' marked it failed"),
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
}
