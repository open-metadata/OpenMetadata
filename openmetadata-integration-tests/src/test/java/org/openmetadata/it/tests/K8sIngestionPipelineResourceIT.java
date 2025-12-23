package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.apis.BatchV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1ConfigMap;
import io.kubernetes.client.openapi.models.V1CronJob;
import io.kubernetes.client.openapi.models.V1CronJobList;
import io.kubernetes.client.openapi.models.V1JobList;
import io.kubernetes.client.util.Config;
import java.io.StringReader;
import java.util.Date;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.env.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for IngestionPipeline K8s-specific operations.
 *
 * Tests pipeline deployment, triggering, and management using the K8s backend.
 * Requires K8s to be enabled via ENABLE_K8S_TESTS=true.
 *
 * Migrated from:
 * org.openmetadata.service.resources.services.ingestionpipelines.K8sIngestionPipelineResourceTest
 *
 * Run with: mvn test -Dtest=K8sIngestionPipelineResourceIT -DENABLE_K8S_TESTS=true
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class K8sIngestionPipelineResourceIT {

  private static final Logger LOG = LoggerFactory.getLogger(K8sIngestionPipelineResourceIT.class);
  private static final String K8S_NAMESPACE = "openmetadata-pipelines";
  private static final Date START_DATE = new DateTime("2022-06-10T15:06:47+00:00").toDate();

  private static CoreV1Api coreApi;
  private static BatchV1Api batchApi;

  @BeforeAll
  void setupK8s() {
    TestSuiteBootstrap.setupK8s();
    assertTrue(TestSuiteBootstrap.isK8sEnabled(), "K8s must be enabled for this test");
    initializeK8sClients();
  }

  private void initializeK8sClients() {
    try {
      String kubeConfigYaml = TestSuiteBootstrap.getKubeConfigYaml();
      ApiClient apiClient = Config.fromConfig(new StringReader(kubeConfigYaml));
      apiClient.setReadTimeout(30000);
      apiClient.setConnectTimeout(10000);

      coreApi = new CoreV1Api(apiClient);
      batchApi = new BatchV1Api(apiClient);
    } catch (Exception e) {
      fail("Failed to initialize K8s API clients: " + e.getMessage());
    }
  }

  private IngestionPipeline createPipeline(String name, String schedule, TestNamespace ns) {
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
            .withName(ns.prefix(name))
            .withDescription("K8s test ingestion pipeline")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(
                schedule != null
                    ? new AirflowConfig().withStartDate(START_DATE).withScheduleInterval(schedule)
                    : new AirflowConfig().withStartDate(START_DATE));

    return SdkClients.adminClient().ingestionPipelines().create(request);
  }

  private String sanitizeName(String name) {
    return name.toLowerCase().replaceAll("[^a-z0-9-]", "-");
  }

  private PipelineServiceClientResponse deployPipeline(String pipelineId)
      throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = "/v1/services/ingestionPipelines/deploy/" + pipelineId;
    return client
        .getHttpClient()
        .execute(HttpMethod.POST, path, "", PipelineServiceClientResponse.class);
  }

  private PipelineServiceClientResponse triggerPipeline(String pipelineId)
      throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = "/v1/services/ingestionPipelines/trigger/" + pipelineId;
    return client
        .getHttpClient()
        .execute(HttpMethod.POST, path, "", PipelineServiceClientResponse.class);
  }

  private IngestionPipeline togglePipeline(String pipelineId) throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = "/v1/services/ingestionPipelines/toggleIngestion/" + pipelineId;
    return client.getHttpClient().execute(HttpMethod.POST, path, "", IngestionPipeline.class);
  }

  private PipelineServiceClientResponse killPipeline(String pipelineId)
      throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = "/v1/services/ingestionPipelines/kill/" + pipelineId;
    return client
        .getHttpClient()
        .execute(HttpMethod.POST, path, "", PipelineServiceClientResponse.class);
  }

  private PipelineServiceClientResponse getServiceStatus() throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = "/v1/services/ingestionPipelines/status";
    return client
        .getHttpClient()
        .execute(HttpMethod.GET, path, null, PipelineServiceClientResponse.class);
  }

  @Test
  void test_deployScheduledPipeline_withK8sBackend(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createPipeline("k8s-scheduled-test", "0 * * * *", ns);
    assertNotNull(pipeline);

    PipelineServiceClientResponse response = deployPipeline(pipeline.getId().toString());

    assertEquals(200, response.getCode());
    assertEquals("Kubernetes", response.getPlatform());

    String sanitizedName = sanitizeName(pipeline.getName());
    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                V1CronJob cronJob =
                    batchApi
                        .readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE)
                        .execute();
                return cronJob != null;
              } catch (Exception e) {
                return false;
              }
            });

    V1CronJob cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE).execute();
    assertNotNull(cronJob);
    assertEquals("0 * * * *", cronJob.getSpec().getSchedule());

    LOG.info("Scheduled pipeline deployed successfully with K8s backend");
  }

  @Test
  void test_deployOnDemandPipeline_withK8sBackend(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createPipeline("k8s-ondemand-test", null, ns);
    assertNotNull(pipeline);

    PipelineServiceClientResponse response = deployPipeline(pipeline.getId().toString());

    assertEquals(200, response.getCode());

    String sanitizedName = sanitizeName(pipeline.getName());

    V1CronJobList cronJobs =
        batchApi
            .listNamespacedCronJob(K8S_NAMESPACE)
            .labelSelector("app.kubernetes.io/pipeline=" + sanitizedName)
            .execute();
    assertTrue(cronJobs.getItems().isEmpty());

    V1ConfigMap configMap =
        coreApi.readNamespacedConfigMap("om-config-" + sanitizedName, K8S_NAMESPACE).execute();
    assertNotNull(configMap);

    LOG.info("On-demand pipeline deployed successfully with K8s backend");
  }

  @Test
  void test_runPipeline_withK8sBackend(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createPipeline("k8s-run-test", null, ns);

    deployPipeline(pipeline.getId().toString());

    PipelineServiceClientResponse response = triggerPipeline(pipeline.getId().toString());

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("triggered"));

    String sanitizedName = sanitizeName(pipeline.getName());
    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                V1JobList jobs =
                    batchApi
                        .listNamespacedJob(K8S_NAMESPACE)
                        .labelSelector("app.kubernetes.io/pipeline=" + sanitizedName)
                        .execute();
                return !jobs.getItems().isEmpty();
              } catch (Exception e) {
                return false;
              }
            });

    LOG.info("Pipeline run triggered successfully with K8s backend");
  }

  @Test
  void test_togglePipeline_withK8sBackend(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createPipeline("k8s-toggle-test", "0 * * * *", ns);

    deployPipeline(pipeline.getId().toString());

    String sanitizedName = sanitizeName(pipeline.getName());
    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                batchApi
                    .readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE)
                    .execute();
                return true;
              } catch (Exception e) {
                return false;
              }
            });

    togglePipeline(pipeline.getId().toString());

    V1CronJob cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE).execute();
    assertTrue(cronJob.getSpec().getSuspend());

    togglePipeline(pipeline.getId().toString());

    cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE).execute();
    assertFalse(cronJob.getSpec().getSuspend());

    LOG.info("Pipeline toggle tested successfully with K8s backend");
  }

  @Test
  void test_killPipeline_withK8sBackend(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createPipeline("k8s-kill-test", null, ns);

    deployPipeline(pipeline.getId().toString());

    triggerPipeline(pipeline.getId().toString());

    String sanitizedName = sanitizeName(pipeline.getName());
    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                V1JobList jobs =
                    batchApi
                        .listNamespacedJob(K8S_NAMESPACE)
                        .labelSelector("app.kubernetes.io/pipeline=" + sanitizedName)
                        .execute();
                return !jobs.getItems().isEmpty();
              } catch (Exception e) {
                return false;
              }
            });

    PipelineServiceClientResponse response = killPipeline(pipeline.getId().toString());

    assertEquals(200, response.getCode());

    Awaitility.await()
        .atMost(60, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .ignoreExceptions()
        .until(
            () -> {
              V1JobList jobs =
                  batchApi
                      .listNamespacedJob(K8S_NAMESPACE)
                      .labelSelector("app.kubernetes.io/pipeline=" + sanitizedName)
                      .execute();
              return jobs.getItems().stream()
                  .noneMatch(
                      job ->
                          job.getStatus() != null
                              && job.getStatus().getActive() != null
                              && job.getStatus().getActive() > 0);
            });

    LOG.info("Pipeline kill tested successfully with K8s backend");
  }

  @Test
  void test_deletePipeline_withK8sBackend(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createPipeline("k8s-delete-test", "0 * * * *", ns);

    deployPipeline(pipeline.getId().toString());

    String sanitizedName = sanitizeName(pipeline.getName());
    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                batchApi
                    .readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE)
                    .execute();
                return true;
              } catch (Exception e) {
                return false;
              }
            });

    SdkClients.adminClient().ingestionPipelines().delete(pipeline.getId().toString());

    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                coreApi
                    .readNamespacedConfigMap("om-config-" + sanitizedName, K8S_NAMESPACE)
                    .execute();
                return false;
              } catch (Exception e) {
                return e.getMessage() != null && e.getMessage().contains("404");
              }
            });

    LOG.info("Pipeline delete tested successfully with K8s backend");
  }

  @Test
  void test_getServiceStatus_withK8sBackend(TestNamespace ns) throws Exception {
    PipelineServiceClientResponse response = getServiceStatus();

    assertEquals(200, response.getCode());
    assertEquals("Kubernetes", response.getPlatform());
    assertNotNull(response.getVersion());

    LOG.info(
        "Service status: platform={}, version={}", response.getPlatform(), response.getVersion());
  }

  @Test
  void test_pipelineWithFilterPatterns_withK8sBackend(TestNamespace ns) throws Exception {
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
            .withName(ns.prefix("k8s-filters"))
            .withDescription("Pipeline with filter patterns")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    IngestionPipeline pipeline = SdkClients.adminClient().ingestionPipelines().create(request);
    assertNotNull(pipeline);
    assertNotNull(pipeline.getSourceConfig());

    PipelineServiceClientResponse response = deployPipeline(pipeline.getId().toString());
    assertEquals(200, response.getCode());

    String sanitizedName = sanitizeName(pipeline.getName());
    V1ConfigMap configMap =
        coreApi.readNamespacedConfigMap("om-config-" + sanitizedName, K8S_NAMESPACE).execute();
    assertNotNull(configMap);

    LOG.info("Pipeline with filter patterns deployed successfully with K8s backend");
  }

  @Test
  void test_updatePipelineSchedule_withK8sBackend(TestNamespace ns) throws Exception {
    IngestionPipeline pipeline = createPipeline("k8s-update-schedule", "0 * * * *", ns);

    deployPipeline(pipeline.getId().toString());

    String sanitizedName = sanitizeName(pipeline.getName());
    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                batchApi
                    .readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE)
                    .execute();
                return true;
              } catch (Exception e) {
                return false;
              }
            });

    V1CronJob cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE).execute();
    assertEquals("0 * * * *", cronJob.getSpec().getSchedule());

    pipeline.setAirflowConfig(
        new AirflowConfig().withStartDate(START_DATE).withScheduleInterval("0 0 * * *"));
    IngestionPipeline updated =
        SdkClients.adminClient().ingestionPipelines().update(pipeline.getId().toString(), pipeline);

    deployPipeline(updated.getId().toString());

    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                V1CronJob updatedCronJob =
                    batchApi
                        .readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE)
                        .execute();
                return "0 0 * * *".equals(updatedCronJob.getSpec().getSchedule());
              } catch (Exception e) {
                return false;
              }
            });

    LOG.info("Pipeline schedule update tested successfully with K8s backend");
  }
}
