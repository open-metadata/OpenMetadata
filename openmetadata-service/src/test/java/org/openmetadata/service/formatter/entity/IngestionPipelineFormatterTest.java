package org.openmetadata.service.formatter.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mockStatic;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.TestMessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;

class IngestionPipelineFormatterTest {

  @Test
  void formatHandlesPipelineStatusAndFallsBackToDefaultFormatting() {
    IngestionPipeline pipeline = new IngestionPipeline().withName("metadata_daily");
    Thread thread = pipelineThread();
    IngestionPipelineFormatter formatter = new IngestionPipelineFormatter();
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
                              .withPipelineState(PipelineStatusType.RUNNING))),
              FormatterUtil.CHANGE_TYPE.UPDATE);

      assertEquals(
          String.format(
              "Ingestion Pipeline <b>%s</b> <b>%s</b> at %s",
              "metadata_daily", PipelineStatusType.RUNNING, expectedDate),
          statusMessage);

      String updatedMessage =
          formatter.format(
              new TestMessageDecorator(),
              thread,
              new FieldChange().withName("pipelineStatus").withNewValue("not-json"),
              FormatterUtil.CHANGE_TYPE.UPDATE);

      assertEquals("Ingestion Pipeline <b>metadata_daily</b> is updated", updatedMessage);
    }

    String defaultMessage =
        formatter.format(
            new TestMessageDecorator(),
            thread.withAbout("<#E::ingestionPipeline::service.ingestion.pipeline>"),
            new FieldChange().withName("description").withNewValue("new description"),
            FormatterUtil.CHANGE_TYPE.ADD);
    assertEquals("Added <b>description</b>: <ins>new description</ins>", defaultMessage);
  }

  @Test
  void getIngestionPipelineUrlHandlesSupportedPipelineTypes() {
    TestMessageDecorator decorator = new TestMessageDecorator();

    IngestionPipeline testSuitePipeline =
        new IngestionPipeline()
            .withPipelineType(PipelineType.TEST_SUITE)
            .withService(
                new EntityReference()
                    .withType(Entity.TABLE)
                    .withFullyQualifiedName("service.sales.orders.testSuite"));
    assertEquals(
        "table|service.sales.orders|profiler?activeTab=Data%20Quality",
        IngestionPipelineFormatter.getIngestionPipelineUrl(
            decorator, Entity.INGESTION_PIPELINE, testSuitePipeline));

    IngestionPipeline applicationPipeline =
        new IngestionPipeline()
            .withPipelineType(PipelineType.APPLICATION)
            .withService(
                new EntityReference()
                    .withType(Entity.APPLICATION)
                    .withFullyQualifiedName("service.sales.automation"));
    assertEquals(
        "automations|service.sales.automation|automator-details",
        IngestionPipelineFormatter.getIngestionPipelineUrl(
            decorator, Entity.INGESTION_PIPELINE, applicationPipeline));

    IngestionPipeline metadataPipeline =
        new IngestionPipeline()
            .withPipelineType(PipelineType.METADATA)
            .withService(
                new EntityReference()
                    .withType(Entity.DATABASE_SERVICE)
                    .withFullyQualifiedName("service.sales"));
    assertEquals(
        "service/databaseServices|service.sales|ingestions",
        IngestionPipelineFormatter.getIngestionPipelineUrl(
            decorator, Entity.INGESTION_PIPELINE, metadataPipeline));
    assertEquals(
        "",
        IngestionPipelineFormatter.getIngestionPipelineUrl(
            decorator, Entity.TABLE, metadataPipeline));
  }

  @Test
  void getIngestionPipelineUrlResolvesMissingServiceAndHandlesUnresolvedService() {
    TestMessageDecorator decorator = new TestMessageDecorator();
    IngestionPipeline unresolvedPipeline =
        new IngestionPipeline()
            .withId(UUID.randomUUID())
            .withName("metadata_daily")
            .withPipelineType(PipelineType.METADATA);
    IngestionPipeline resolvedPipeline =
        new IngestionPipeline()
            .withService(
                new EntityReference()
                    .withType(Entity.DATABASE_SERVICE)
                    .withFullyQualifiedName("service.sales"));

    IngestionPipeline unresolvedServicePipeline =
        new IngestionPipeline()
            .withId(UUID.randomUUID())
            .withName("metadata_daily")
            .withPipelineType(PipelineType.METADATA);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntity(unresolvedPipeline.getEntityReference(), "service", Include.ALL))
          .thenReturn(resolvedPipeline);
      entityMock
          .when(
              () ->
                  Entity.getEntity(
                      unresolvedServicePipeline.getEntityReference(), "service", Include.ALL))
          .thenReturn(new IngestionPipeline());

      assertEquals(
          "service/databaseServices|service.sales|ingestions",
          IngestionPipelineFormatter.getIngestionPipelineUrl(
              decorator, Entity.INGESTION_PIPELINE, unresolvedPipeline));
      assertEquals(
          "",
          IngestionPipelineFormatter.getIngestionPipelineUrl(
              decorator, Entity.INGESTION_PIPELINE, unresolvedServicePipeline));
    }
  }

  @Test
  void getDataContractUrlUsesResolvedTableReference() {
    TestMessageDecorator decorator = new TestMessageDecorator();
    UUID tableId = UUID.randomUUID();
    DataContract contract =
        new DataContract().withEntity(new EntityReference().withType(Entity.TABLE).withId(tableId));
    EntityReference tableRef =
        new EntityReference()
            .withType(Entity.TABLE)
            .withId(tableId)
            .withFullyQualifiedName("service.sales.orders");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityReferenceById(Entity.TABLE, tableId, Include.ALL))
          .thenReturn(tableRef);

      assertEquals(
          "table|service.sales.orders|contract",
          IngestionPipelineFormatter.getDataContractUrl(decorator, Entity.DATA_CONTRACT, contract));

      entityMock
          .when(() -> Entity.getEntityReferenceById(Entity.TABLE, tableId, Include.ALL))
          .thenReturn(null);
      assertEquals(
          "",
          IngestionPipelineFormatter.getDataContractUrl(decorator, Entity.DATA_CONTRACT, contract));
    }

    assertEquals(
        "", IngestionPipelineFormatter.getDataContractUrl(decorator, Entity.TABLE, contract));
  }

  private static Thread pipelineThread() {
    return new Thread()
        .withId(UUID.randomUUID())
        .withEntityRef(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.INGESTION_PIPELINE)
                .withFullyQualifiedName("service.ingestion.pipeline"));
  }
}
