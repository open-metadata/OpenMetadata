package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.env.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for IngestionPipeline entity operations.
 *
 * <p>This test class requires K8s (K3s) pipeline scheduler for delete/deploy operations. Enable
 * K8s tests by setting ENABLE_K8S_TESTS=true environment variable or system property.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds ingestion pipeline-specific tests
 * for source configs and pipeline types.
 *
 * <p>Migrated from:
 * org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceTest
 *
 * <p>Run with: mvn test -Dtest=IngestionPipelineResourceIT -DENABLE_K8S_TESTS=true
 */
@Execution(ExecutionMode.CONCURRENT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class IngestionPipelineResourceIT
    extends BaseEntityIT<IngestionPipeline, CreateIngestionPipeline> {

  private static final Logger LOG = LoggerFactory.getLogger(IngestionPipelineResourceIT.class);
  private static final Date START_DATE = new DateTime("2022-06-10T15:06:47+00:00").toDate();

  // IngestionPipeline only supports owners,followers fields - no tags, no domain
  {
    supportsTags = false;
    supportsDomains = false;
    supportsDataProducts = false;
  }

  @BeforeAll
  void setupK8s() {
    // IngestionPipelineResourceIT requires K8s for delete/deploy operations
    TestSuiteBootstrap.setupK8s();
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateIngestionPipeline createMinimalRequest(
      TestNamespace ns, OpenMetadataClient client) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true).withIncludeViews(true);

    SourceConfig sourceConfig = new SourceConfig().withConfig(metadataPipeline);

    return new CreateIngestionPipeline()
        .withName(ns.prefix("ingestion"))
        .withDescription("Test ingestion pipeline created by integration test")
        .withPipelineType(PipelineType.METADATA)
        .withService(service.getEntityReference())
        .withSourceConfig(sourceConfig)
        .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));
  }

  @Override
  protected CreateIngestionPipeline createRequest(
      String name, TestNamespace ns, OpenMetadataClient client) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true).withIncludeViews(true);

    SourceConfig sourceConfig = new SourceConfig().withConfig(metadataPipeline);

    return new CreateIngestionPipeline()
        .withName(name)
        .withDescription("Test ingestion pipeline")
        .withPipelineType(PipelineType.METADATA)
        .withService(service.getEntityReference())
        .withSourceConfig(sourceConfig)
        .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));
  }

  @Override
  protected IngestionPipeline createEntity(
      CreateIngestionPipeline createRequest, OpenMetadataClient client) {
    return client.ingestionPipelines().create(createRequest);
  }

  @Override
  protected IngestionPipeline getEntity(String id, OpenMetadataClient client) {
    return client.ingestionPipelines().get(id);
  }

  @Override
  protected IngestionPipeline getEntityByName(String fqn, OpenMetadataClient client) {
    return client.ingestionPipelines().getByName(fqn);
  }

  @Override
  protected IngestionPipeline patchEntity(
      String id, IngestionPipeline entity, OpenMetadataClient client) {
    return client.ingestionPipelines().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.ingestionPipelines().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.ingestionPipelines().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.ingestionPipelines().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "ingestionPipeline";
  }

  @Override
  protected void validateCreatedEntity(
      IngestionPipeline entity, CreateIngestionPipeline createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "IngestionPipeline must have a service");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain ingestion pipeline name");
  }

  @Override
  protected ListResponse<IngestionPipeline> listEntities(
      ListParams params, OpenMetadataClient client) {
    return client.ingestionPipelines().list(params);
  }

  @Override
  protected IngestionPipeline getEntityWithFields(
      String id, String fields, OpenMetadataClient client) {
    return client.ingestionPipelines().get(id, fields);
  }

  @Override
  protected IngestionPipeline getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.ingestionPipelines().getByName(fqn, fields);
  }

  @Override
  protected IngestionPipeline getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    // IngestionPipeline only supports owners,followers fields
    return client.ingestionPipelines().get(id, "owners,followers", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.ingestionPipelines().getVersionList(id);
  }

  @Override
  protected IngestionPipeline getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.ingestionPipelines().getVersion(id.toString(), version);
  }

  // ===================================================================
  // INGESTION PIPELINE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_ingestionPipelineWithMetadataType_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true).withIncludeViews(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("ing_metadata"))
            .withDescription("Metadata ingestion pipeline")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request, client);
    assertNotNull(pipeline);
    assertEquals(PipelineType.METADATA, pipeline.getPipelineType());
  }

  @Test
  void post_ingestionPipelineWithFilterPatterns_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withIncludeViews(true)
            .withSchemaFilterPattern(
                new FilterPattern().withExcludes(List.of("information_schema.*", "test.*")))
            .withTableFilterPattern(
                new FilterPattern().withIncludes(List.of("sales.*", "users.*")));

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("ing_filters"))
            .withDescription("Ingestion with filter patterns")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request, client);
    assertNotNull(pipeline);
    assertNotNull(pipeline.getSourceConfig());
  }

  @Test
  void put_ingestionPipelineDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("ing_update_desc"))
            .withDescription("Initial description")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = createEntity(request, client);
    assertEquals("Initial description", pipeline.getDescription());

    // Update description
    pipeline.setDescription("Updated description");
    IngestionPipeline updated = patchEntity(pipeline.getId().toString(), pipeline, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_ingestionPipelineNameUniquenessWithinService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    String pipelineName = ns.prefix("unique_ing");
    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true);

    CreateIngestionPipeline request1 =
        new CreateIngestionPipeline()
            .withName(pipelineName)
            .withDescription("First pipeline")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline1 = createEntity(request1, client);
    assertNotNull(pipeline1);

    // Attempt to create duplicate within same service
    CreateIngestionPipeline request2 =
        new CreateIngestionPipeline()
            .withName(pipelineName)
            .withDescription("Duplicate pipeline")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    assertThrows(
        Exception.class,
        () -> createEntity(request2, client),
        "Creating duplicate ingestion pipeline in same service should fail");
  }
}
