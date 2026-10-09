package org.openmetadata.service.formatter.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mockStatic;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.TestMessageDecorator;

class IngestionPipelineFormatterTest {

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
}
