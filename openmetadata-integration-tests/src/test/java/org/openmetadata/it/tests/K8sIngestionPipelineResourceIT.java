/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.apis.BatchV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1ConfigMap;
import io.kubernetes.client.openapi.models.V1CronJob;
import io.kubernetes.client.openapi.models.V1CronJobList;
import io.kubernetes.client.openapi.models.V1JobList;
import io.kubernetes.client.util.Config;
import java.io.StringReader;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
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
 * Integration tests for IngestionPipeline REST API with K8s pipeline backend.
 *
 * <p>This test validates that pipeline REST API operations work correctly with the
 * Kubernetes backend through the OpenMetadata API layer using native Kubernetes
 * Jobs and CronJobs (not the custom OMJob operator).
 *
 * <p>Uses native Jobs/CronJobs (useOMJobOperator=false by default in TestSuiteBootstrap).
 *
 * <p>Run with: ENABLE_K8S_TESTS=true mvn test -Dtest=K8sIngestionPipelineResourceIT
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class K8sIngestionPipelineResourceIT {

  private static final Logger LOG = LoggerFactory.getLogger(K8sIngestionPipelineResourceIT.class);
  private static final String K8S_NAMESPACE = "openmetadata-pipelines";

  private static CoreV1Api coreApi;
  private static BatchV1Api batchApi;
  private static DatabaseService testService;

  @BeforeAll
  static void setupK8s() throws Exception {
    // Skip tests if K8s is not enabled
    assumeTrue(
        TestSuiteBootstrap.isK8sEnabled(),
        "K8s tests disabled. Run with ENABLE_K8S_TESTS=true to enable.");

    LOG.info("K8s is running, configuring test environment with native Jobs/CronJobs");

    try {
      String kubeConfigYaml = TestSuiteBootstrap.getKubeConfigYaml();
      ApiClient apiClient = Config.fromConfig(new StringReader(kubeConfigYaml));
      apiClient.setReadTimeout(30000);
      apiClient.setConnectTimeout(10000);

      coreApi = new CoreV1Api(apiClient);
      batchApi = new BatchV1Api(apiClient);

      // Create test database service (this needs the OpenMetadata server running)
      TestNamespace ns = new TestNamespace("K8sIngestionPipelineResourceIT");
      testService = DatabaseServiceTestFactory.createPostgres(ns);

      LOG.info(
          "K8s integration test environment initialized successfully with native Jobs/CronJobs (useOMJobOperator=false by default)");
    } catch (Exception e) {
      LOG.error("Failed to setup K8s test environment", e);
      throw new RuntimeException("Failed to setup K8s environment", e);
    }
  }

  private String sanitizeName(String name) {
    return name.toLowerCase().replaceAll("[^a-z0-9-]", "-");
  }

  private IngestionPipeline createPipeline(String name, String schedule) throws Exception {
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
            .withName(name)
            .withPipelineType(PipelineType.METADATA)
            .withService(testService.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(
                schedule != null
                    ? new AirflowConfig().withScheduleInterval(schedule).withPipelineTimezone("UTC")
                    : new AirflowConfig().withPipelineTimezone("UTC"));

    return SdkClients.adminClient().ingestionPipelines().create(request);
  }

  private PipelineServiceClientResponse deployPipeline(IngestionPipeline pipeline)
      throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = "/v1/services/ingestionPipelines/deploy/" + pipeline.getId();
    return client
        .getHttpClient()
        .execute(HttpMethod.POST, path, null, PipelineServiceClientResponse.class);
  }

  private PipelineServiceClientResponse triggerPipeline(IngestionPipeline pipeline)
      throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = "/v1/services/ingestionPipelines/trigger/" + pipeline.getId();
    return client
        .getHttpClient()
        .execute(HttpMethod.POST, path, null, PipelineServiceClientResponse.class);
  }

  private IngestionPipeline togglePipeline(IngestionPipeline pipeline)
      throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = "/v1/services/ingestionPipelines/toggleIngestion/" + pipeline.getId();
    return client.getHttpClient().execute(HttpMethod.POST, path, null, IngestionPipeline.class);
  }

  private PipelineServiceClientResponse killPipeline(IngestionPipeline pipeline)
      throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = "/v1/services/ingestionPipelines/kill/" + pipeline.getId();
    return client
        .getHttpClient()
        .execute(HttpMethod.POST, path, null, PipelineServiceClientResponse.class);
  }

  @Test
  @Order(1)
  void test_k8sClusterWithNativeJobs() throws Exception {
    LOG.info("Testing K8s cluster setup with native Jobs/CronJobs...");

    // Verify namespace exists
    var namespace = coreApi.readNamespace(K8S_NAMESPACE).execute();
    assertNotNull(namespace);
    assertEquals(K8S_NAMESPACE, namespace.getMetadata().getName());
    LOG.info("Test namespace verified: {}", namespace.getMetadata().getName());

    // Verify we can list native CronJobs (not CronOMJobs)
    V1CronJobList cronJobs = batchApi.listNamespacedCronJob(K8S_NAMESPACE).execute();
    assertNotNull(cronJobs);
    LOG.info("Can list native CronJobs in namespace");

    // Verify we can list native Jobs (not OMJobs)
    V1JobList jobs = batchApi.listNamespacedJob(K8S_NAMESPACE).execute();
    assertNotNull(jobs);
    LOG.info("Can list native Jobs in namespace");

    LOG.info("K8s cluster with native Jobs/CronJobs verified successfully");
  }

  @Test
  @Order(2)
  void test_deployScheduledPipeline_withK8sBackend() throws Exception {

    LOG.info("Testing scheduled pipeline deployment with K8s backend...");

    String pipelineName = "k8s-scheduled-test-" + System.currentTimeMillis();
    IngestionPipeline pipeline = createPipeline(pipelineName, "0 * * * *");
    assertNotNull(pipeline);

    PipelineServiceClientResponse response = deployPipeline(pipeline);

    assertEquals(200, response.getCode());
    assertEquals("Kubernetes", response.getPlatform());

    String sanitizedName = sanitizeName(pipelineName);

    // Verify ConfigMap creation
    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                V1ConfigMap configMap =
                    coreApi
                        .readNamespacedConfigMap("om-config-" + sanitizedName, K8S_NAMESPACE)
                        .execute();
                return configMap != null
                    && configMap.getData() != null
                    && configMap.getData().containsKey("config");
              } catch (Exception e) {
                return false;
              }
            });

    // Verify CronJob creation
    V1CronJob cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE).execute();
    assertNotNull(cronJob);
    assertEquals("0 * * * *", cronJob.getSpec().getSchedule());
    assertFalse(cronJob.getSpec().getSuspend());

    LOG.info("Scheduled pipeline deployed successfully with K8s backend");
  }

  @Test
  @Order(3)
  void test_deployOnDemandPipeline_withK8sBackend() throws Exception {

    LOG.info("Testing on-demand pipeline deployment...");

    String pipelineName = "k8s-ondemand-test-" + System.currentTimeMillis();
    IngestionPipeline pipeline = createPipeline(pipelineName, null);
    assertNotNull(pipeline);

    PipelineServiceClientResponse response = deployPipeline(pipeline);
    assertEquals(200, response.getCode());

    String sanitizedName = sanitizeName(pipelineName);

    // Verify ConfigMap exists
    V1ConfigMap configMap =
        coreApi.readNamespacedConfigMap("om-config-" + sanitizedName, K8S_NAMESPACE).execute();
    assertNotNull(configMap);

    // Verify NO CronJob is created for on-demand pipeline
    V1CronJobList cronJobs =
        batchApi
            .listNamespacedCronJob(K8S_NAMESPACE)
            .labelSelector("app.kubernetes.io/pipeline=" + sanitizedName)
            .execute();
    assertTrue(cronJobs.getItems().isEmpty());

    LOG.info("On-demand pipeline deployed successfully with K8s backend");
  }

  @Test
  @Order(4)
  void test_runPipeline_withK8sBackend() throws Exception {

    LOG.info("Testing pipeline execution...");

    String pipelineName = "k8s-run-test-" + System.currentTimeMillis();
    IngestionPipeline pipeline = createPipeline(pipelineName, null);

    deployPipeline(pipeline);

    PipelineServiceClientResponse response = triggerPipeline(pipeline);

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("triggered"));

    String sanitizedName = sanitizeName(pipelineName);

    // Verify Job creation
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
  @Order(5)
  void test_togglePipeline_withK8sBackend() throws Exception {

    LOG.info("Testing pipeline toggle functionality...");

    String pipelineName = "k8s-toggle-test-" + System.currentTimeMillis();
    IngestionPipeline pipeline = createPipeline(pipelineName, "0 * * * *");

    deployPipeline(pipeline);

    String sanitizedName = sanitizeName(pipelineName);

    // Wait for CronJob to be created
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

    // Test disable
    IngestionPipeline updated = togglePipeline(pipeline);
    assertFalse(updated.getEnabled());

    V1CronJob cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE).execute();
    assertTrue(cronJob.getSpec().getSuspend());

    // Test enable
    updated = togglePipeline(updated);
    assertTrue(updated.getEnabled());

    cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE).execute();
    assertFalse(cronJob.getSpec().getSuspend());

    LOG.info("Pipeline toggle tested successfully with K8s backend");
  }

  @Test
  @Order(6)
  void test_killPipeline_withK8sBackend() throws Exception {

    LOG.info("Testing pipeline kill functionality...");

    String pipelineName = "k8s-kill-test-" + System.currentTimeMillis();
    IngestionPipeline pipeline = createPipeline(pipelineName, null);

    deployPipeline(pipeline);
    triggerPipeline(pipeline);

    String sanitizedName = sanitizeName(pipelineName);

    // Wait for job to be created
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

    PipelineServiceClientResponse response = killPipeline(pipeline);
    assertEquals(200, response.getCode());

    // Verify jobs are deleted or no longer active
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
  @Order(7)
  void test_deletePipeline_withK8sBackend() throws Exception {

    LOG.info("Testing pipeline deletion...");

    String pipelineName = "k8s-delete-test-" + System.currentTimeMillis();
    IngestionPipeline pipeline = createPipeline(pipelineName, "0 * * * *");

    deployPipeline(pipeline);

    String sanitizedName = sanitizeName(pipelineName);

    // Wait for resources to be created
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

    // Delete pipeline
    SdkClients.adminClient().ingestionPipelines().delete(pipeline.getId().toString());

    // Verify all resources are cleaned up
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

    LOG.info("Pipeline deletion tested successfully with K8s backend");
  }

  @Test
  @Order(8)
  void test_getServiceStatus_withK8sBackend() throws Exception {

    LOG.info("Testing service status with K8s backend...");

    OpenMetadataClient client = SdkClients.adminClient();
    String path = "/v1/services/ingestionPipelines/status";
    PipelineServiceClientResponse response =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, path, null, PipelineServiceClientResponse.class);

    assertEquals(200, response.getCode());
    assertEquals("Kubernetes", response.getPlatform());
    assertNotNull(response.getVersion());

    LOG.info(
        "Service status: platform={}, version={}", response.getPlatform(), response.getVersion());
  }
}
