package org.openmetadata.service.formatter.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mockStatic;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.TestMessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;

class PipelineFormatterTest {

  @Test
  void formatHandlesPipelineStatusUpdatesAndMalformedPayloads() {
    Pipeline pipeline = new Pipeline().withName("etl_daily");
    Thread thread = pipelineThread();
    PipelineFormatter formatter = new PipelineFormatter();
    long timestamp = 1_700_000_000_000L;
    String expectedDate = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss").format(new Date(timestamp));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntity(
                      thread.getEntityRef().getType(),
                      thread.getEntityRef().getId(),
                      "id",
                      Include.ALL))
          .thenReturn(pipeline);

      String statusMessage =
          formatter.format(
              new TestMessageDecorator(),
              thread,
              new FieldChange()
                  .withName("pipelineStatus")
                  .withNewValue(
                      JsonUtils.pojoToJson(
                          new PipelineStatus()
                              .withTimestamp(timestamp)
                              .withExecutionStatus(StatusType.Successful))),
              FormatterUtil.CHANGE_TYPE.UPDATE);

      assertEquals(
          String.format(
              "Pipeline <b>%s</b> <b>%s</b> at %s", "etl_daily", "Successful", expectedDate),
          statusMessage);

      String updatedMessage =
          formatter.format(
              new TestMessageDecorator(),
              thread,
              new FieldChange().withName("pipelineStatus").withNewValue("not-json"),
              FormatterUtil.CHANGE_TYPE.UPDATE);

      assertEquals("Pipeline <b>etl_daily</b> is updated", updatedMessage);
    }

    String defaultMessage =
        formatter.format(
            new TestMessageDecorator(),
            thread.withAbout("<#E::pipeline::service.etl.daily>"),
            new FieldChange().withName("description").withNewValue("new description"),
            FormatterUtil.CHANGE_TYPE.ADD);
    assertEquals("Added <b>description</b>: <ins>new description</ins>", defaultMessage);
  }

  private static Thread pipelineThread() {
    return new Thread()
        .withId(UUID.randomUUID())
        .withEntityRef(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.PIPELINE)
                .withFullyQualifiedName("service.etl.daily"));
  }
}
