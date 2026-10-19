package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.resources.services.ingestionpipelines.PipelineBotRedeployScheduler.PENDING_REDEPLOY;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceProfilerPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceQueryUsagePipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.utils.DataMigrationStep;
import org.openmetadata.service.migration.utils.v210.PipelineBotRedeployMigration;

/**
 * The upgrade to the release where AutoPilot deploys its agents as their own bot. Agents it had
 * already deployed as ingestion-bot are marked in entity_extension for the server to redeploy;
 * every other pipeline is left alone.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class IngestionPipelineBotRedeployMigrationIT {
  private static final Map<String, String> HARD_DELETE = Map.of("hardDelete", "true");

  private final List<IngestionPipeline> created = new ArrayList<>();

  @AfterEach
  void deletePipelines() {
    for (IngestionPipeline pipeline : created) {
      Entity.getCollectionDAO().entityExtensionDAO().delete(pipeline.getId(), PENDING_REDEPLOY);
      SdkClients.adminClient()
          .ingestionPipelines()
          .delete(pipeline.getId().toString(), HARD_DELETE);
    }
  }

  @Test
  void marksTheAgentsAutoPilotDeployedAsIngestionBot(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    IngestionPipeline autoPilotUsage =
        deployed(ns, service, PipelineType.USAGE, ProviderType.AUTOMATION, "Usage Agent");
    IngestionPipeline createdBy17Profiler =
        deployed(ns, service, PipelineType.PROFILER, ProviderType.USER, "Profiler Agent");
    IngestionPipeline autoPilotMetadata =
        deployed(ns, service, PipelineType.METADATA, ProviderType.AUTOMATION, "Metadata Agent");
    IngestionPipeline userProfiler =
        deployed(ns, service, PipelineType.PROFILER, ProviderType.USER, "Nightly profiler");

    PipelineBotRedeployMigration.markAutoPilotAgentsForRedeploy(Entity.getCollectionDAO());

    assertNotNull(marker(autoPilotUsage));
    assertNotNull(marker(createdBy17Profiler));
    assertNull(marker(autoPilotMetadata));
    assertNull(marker(userProfiler));
  }

  // A soft-deleted pipeline keeps running on schedule, so it still writes as ingestion-bot.
  @Test
  void marksASoftDeletedAgentToo(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    IngestionPipeline agent =
        deployed(ns, service, PipelineType.USAGE, ProviderType.AUTOMATION, "Usage Agent");
    SdkClients.adminClient().ingestionPipelines().delete(agent.getId().toString(), Map.of());

    PipelineBotRedeployMigration.markAutoPilotAgentsForRedeploy(Entity.getCollectionDAO());

    assertNotNull(marker(agent));
  }

  @Test
  void hardDeletingAMarkedAgentRemovesItsMarker(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    IngestionPipeline agent =
        deployed(ns, service, PipelineType.USAGE, ProviderType.AUTOMATION, "Usage Agent");
    PipelineBotRedeployMigration.markAutoPilotAgentsForRedeploy(Entity.getCollectionDAO());
    assertNotNull(marker(agent));

    created.remove(agent);
    SdkClients.adminClient().ingestionPipelines().delete(agent.getId().toString(), HARD_DELETE);

    assertNull(marker(agent));
  }

  /** The suite's bootstrap ran the real migration workflow, so the step is already recorded. */
  @Test
  void theUpgradeRecordedTheStepSoAReRunMarksNothing() {
    MigrationDAO migrationDAO = TestSuiteBootstrap.getJdbi().onDemand(MigrationDAO.class);
    AtomicInteger runs = new AtomicInteger();

    DataMigrationStep.runOnce(
        migrationDAO, "2.1.0", PipelineBotRedeployMigration.STEP_NAME, runs::incrementAndGet);

    assertEquals(0, runs.get(), "the upgrade already marked the agents, a re-run must not");
  }

  // Created through the API, then marked deployed behind the server as a previous release left it.
  private IngestionPipeline deployed(
      TestNamespace ns,
      DatabaseService service,
      PipelineType pipelineType,
      ProviderType provider,
      String displayName) {
    IngestionPipeline pipeline =
        SdkClients.adminClient()
            .ingestionPipelines()
            .create(
                new CreateIngestionPipeline()
                    .withName(ns.prefix(displayName.replace(" ", "_")))
                    .withDisplayName(displayName)
                    .withPipelineType(pipelineType)
                    .withProvider(provider)
                    .withService(service.getEntityReference())
                    .withSourceConfig(new SourceConfig().withConfig(sourceConfigFor(pipelineType)))
                    .withAirflowConfig(new AirflowConfig()));
    created.add(pipeline);
    pipeline.setDeployed(true);
    Entity.getCollectionDAO().ingestionPipelineDAO().update(pipeline);
    EntityRepository.invalidateCacheForEntity(
        Entity.INGESTION_PIPELINE, pipeline.getId(), pipeline.getFullyQualifiedName());
    return pipeline;
  }

  private static Object sourceConfigFor(PipelineType pipelineType) {
    return switch (pipelineType) {
      case USAGE -> new DatabaseServiceQueryUsagePipeline();
      case PROFILER -> new DatabaseServiceProfilerPipeline();
      default -> new DatabaseServiceMetadataPipeline();
    };
  }

  private static String marker(IngestionPipeline pipeline) {
    return Entity.getCollectionDAO()
        .entityExtensionDAO()
        .getExtension(pipeline.getId(), PENDING_REDEPLOY);
  }
}
