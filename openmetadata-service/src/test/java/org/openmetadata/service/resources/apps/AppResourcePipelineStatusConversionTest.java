package org.openmetadata.service.resources.apps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;

class AppResourcePipelineStatusConversionTest {

  private static final App EXTERNAL_APP =
      new App().withId(UUID.randomUUID()).withName("ExternalTestApp");

  private static PipelineStatus finishedRun(String triggeredBy) {
    return new PipelineStatus()
        .withRunId("run-1")
        .withPipelineState(PipelineStatusType.SUCCESS)
        .withStartDate(1_000L)
        .withEndDate(2_000L)
        .withTriggeredBy(triggeredBy);
  }

  @Test
  void externalAppRunRecordsWhoTriggeredIt() {
    AppRunRecord run = AppResource.convertPipelineStatus(EXTERNAL_APP, finishedRun("alice"));

    assertEquals("alice", run.getTriggeredBy());
  }

  @Test
  void scheduledExternalAppRunHasNoTriggeringUser() {
    AppRunRecord run = AppResource.convertPipelineStatus(EXTERNAL_APP, finishedRun(null));

    assertNull(run.getTriggeredBy());
  }
}
