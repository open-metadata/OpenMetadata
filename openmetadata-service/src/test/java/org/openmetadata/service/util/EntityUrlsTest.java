package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mockStatic;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUrls.LinkFormatter;

class EntityUrlsTest {

  private final LinkFormatter decorator = (prefix, fqn, extra) -> prefix + "|" + fqn + "|" + extra;

  @Test
  void buildEntityUrlUsesEntitySpecificRoutesAndFallsBackToRepositoryLookup() {
    Table unresolvedTable =
        new Table().withId(UUID.randomUUID()).withFullyQualifiedName("").withName("orders");
    Table resolvedTable = new Table().withFullyQualifiedName("service.sales.orders");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(
              () ->
                  Entity.getEntity(
                      Entity.TABLE, unresolvedTable.getId(), "id", Include.NON_DELETED))
          .thenReturn(resolvedTable);

      assertEquals(
          "table|service.sales.orders|",
          EntityUrls.buildEntityUrl(Entity.TABLE, unresolvedTable, decorator));
    }

    TestCase testCase = new TestCase().withFullyQualifiedName("quality.row_count");

    assertEquals(
        "test-case|quality.row_count|test-case-results",
        EntityUrls.buildEntityUrl(Entity.TEST_CASE, testCase, decorator));
    assertEquals(
        "glossary|Business.Term|",
        EntityUrls.buildEntityUrl(
            Entity.GLOSSARY_TERM, new Table().withFullyQualifiedName("Business.Term"), decorator));
    assertEquals(
        "tags|PII|",
        EntityUrls.buildEntityUrl(
            Entity.TAG, new Table().withFullyQualifiedName("PII.Sensitive"), decorator));
    assertEquals(
        "users|alice|",
        EntityUrls.buildEntityUrl(
            Entity.USER, new Table().withFullyQualifiedName("alice"), decorator));
    assertEquals(
        "settings/members/teams|dataStewards|",
        EntityUrls.buildEntityUrl(
            Entity.TEAM, new Table().withFullyQualifiedName("dataStewards"), decorator));
  }

  @Test
  void getIngestionPipelineUrlHandlesSupportedPipelineTypes() {

    IngestionPipeline testSuitePipeline =
        new IngestionPipeline()
            .withPipelineType(PipelineType.TEST_SUITE)
            .withService(
                new EntityReference()
                    .withType(Entity.TABLE)
                    .withFullyQualifiedName("service.sales.orders.testSuite"));
    assertEquals(
        "table|service.sales.orders|profiler?activeTab=Data%20Quality",
        EntityUrls.getIngestionPipelineUrl(
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
        EntityUrls.getIngestionPipelineUrl(
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
        EntityUrls.getIngestionPipelineUrl(decorator, Entity.INGESTION_PIPELINE, metadataPipeline));
    assertEquals("", EntityUrls.getIngestionPipelineUrl(decorator, Entity.TABLE, metadataPipeline));
  }

  @Test
  void getIngestionPipelineUrlResolvesMissingServiceAndHandlesUnresolvedService() {
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
          EntityUrls.getIngestionPipelineUrl(
              decorator, Entity.INGESTION_PIPELINE, unresolvedPipeline));
      assertEquals(
          "",
          EntityUrls.getIngestionPipelineUrl(
              decorator, Entity.INGESTION_PIPELINE, unresolvedServicePipeline));
    }
  }

  @Test
  void getDataContractUrlUsesResolvedTableReference() {
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
          EntityUrls.getDataContractUrl(decorator, Entity.DATA_CONTRACT, contract));

      entityMock
          .when(() -> Entity.getEntityReferenceById(Entity.TABLE, tableId, Include.ALL))
          .thenReturn(null);
      assertEquals("", EntityUrls.getDataContractUrl(decorator, Entity.DATA_CONTRACT, contract));
    }

    assertEquals("", EntityUrls.getDataContractUrl(decorator, Entity.TABLE, contract));
  }
}
