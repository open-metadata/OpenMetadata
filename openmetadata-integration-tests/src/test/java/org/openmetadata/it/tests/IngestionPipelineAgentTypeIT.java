package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.DashboardServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for the {@code agentType} list filter on {@code
 * GET /v1/services/ingestionPipelines}, which expands to the set of {@code pipelineType} values
 * that make up an agent group so clients do not have to enumerate them.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IngestionPipelineAgentTypeIT {

  private static final Date START_DATE = Date.from(Instant.parse("2022-06-10T15:06:47Z"));
  private static final String LIST_PATH = "/v1/services/ingestionPipelines";

  @Test
  void test_agentTypeMetadata_returnsOnlyMetadataAgents(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    String serviceFqn = service.getFullyQualifiedName();

    try {
      String metadataPipeline = createPipeline(ns, service, "agentMetadata", PipelineType.METADATA);
      String lineagePipeline = createPipeline(ns, service, "agentLineage", PipelineType.LINEAGE);
      String reindexPipeline =
          createPipeline(ns, service, "agentReindex", PipelineType.ELASTIC_SEARCH_REINDEX);
      String applicationPipeline =
          createPipeline(ns, service, "agentApplication", PipelineType.APPLICATION);

      Set<String> metadataAgents = listNames(adminClient, serviceFqn, "agentType=metadata");
      assertTrue(
          metadataAgents.containsAll(Set.of(metadataPipeline, lineagePipeline)),
          "agentType=metadata must return every metadata pipelineType");
      assertTrue(
          Set.of(reindexPipeline, applicationPipeline).stream().noneMatch(metadataAgents::contains),
          "agentType=metadata must not fall back to 'everything that is not an application'");

      Set<String> applicationAgents = listNames(adminClient, serviceFqn, "agentType=application");
      assertEquals(Set.of(applicationPipeline), applicationAgents);
    } finally {
      adminClient
          .dashboardServices()
          .delete(service.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    }
  }

  @Test
  void test_agentTypeIsIntersectedWithPipelineType(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    String serviceFqn = service.getFullyQualifiedName();

    try {
      createPipeline(ns, service, "narrowMetadata", PipelineType.METADATA);
      String lineagePipeline = createPipeline(ns, service, "narrowLineage", PipelineType.LINEAGE);
      createPipeline(ns, service, "narrowApplication", PipelineType.APPLICATION);

      assertEquals(
          Set.of(lineagePipeline),
          listNames(adminClient, serviceFqn, "agentType=metadata&pipelineType=lineage"),
          "Both filters set must intersect, not union");
      assertTrue(
          listNames(adminClient, serviceFqn, "agentType=metadata&pipelineType=application")
              .isEmpty(),
          "An empty intersection must match no pipeline");
    } finally {
      adminClient
          .dashboardServices()
          .delete(service.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    }
  }

  private String createPipeline(
      TestNamespace ns, DashboardService service, String name, PipelineType pipelineType) {
    SourceConfig sourceConfig =
        PipelineType.APPLICATION.equals(pipelineType)
            ? new SourceConfig()
                .withConfig(
                    new ApplicationPipeline().withAppConfig(Map.of("type", "AgentTypeTestApp")))
            : new SourceConfig().withConfig(new DashboardServiceMetadataPipeline());
    IngestionPipeline pipeline =
        SdkClients.adminClient()
            .ingestionPipelines()
            .create(
                new CreateIngestionPipeline()
                    .withName(ns.prefix(name))
                    .withPipelineType(pipelineType)
                    .withService(service.getEntityReference())
                    .withSourceConfig(sourceConfig)
                    .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE)));
    return pipeline.getName();
  }

  private Set<String> listNames(OpenMetadataClient client, String serviceFqn, String filter) {
    String path = String.format("%s?service=%s&limit=100&%s", LIST_PATH, serviceFqn, filter);
    IngestionPipelineList response =
        client.getHttpClient().execute(HttpMethod.GET, path, null, IngestionPipelineList.class);
    List<IngestionPipeline> data = response.getData();
    return data == null
        ? Set.of()
        : data.stream().map(IngestionPipeline::getName).collect(Collectors.toSet());
  }

  static class IngestionPipelineList extends ResultList<IngestionPipeline> {}
}
