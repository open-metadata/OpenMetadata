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

package org.openmetadata.service.clients.pipeline.k8s;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.apis.BatchV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1ConfigMap;
import io.kubernetes.client.openapi.models.V1CronJob;
import io.kubernetes.client.openapi.models.V1CronJobList;
import io.kubernetes.client.openapi.models.V1Job;
import io.kubernetes.client.openapi.models.V1JobList;
import io.kubernetes.client.openapi.models.V1Namespace;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1Secret;
import io.kubernetes.client.util.Config;
import java.io.StringReader;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.EntityReference;
import org.testcontainers.k3s.K3sContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Integration test for K8sPipelineClient using a real K3s (lightweight Kubernetes) cluster.
 *
 * <p>This test starts a K3s container and validates that the K8sPipelineClient can:
 *
 * <ul>
 *   <li>Deploy pipelines (create ConfigMaps, Secrets, and CronJobs)
 *   <li>Run pipelines (create Jobs)
 *   <li>Toggle pipeline state (suspend/resume CronJobs)
 *   <li>Kill running pipelines (delete Jobs)
 *   <li>Delete pipelines (cleanup all resources)
 * </ul>
 *
 * <p>Note: This test requires Docker to be running and may take longer than unit tests.
 */
@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class K8sPipelineClientIntegrationTest {

  private static final String NAMESPACE = "openmetadata-test";
  private static final DockerImageName K3S_IMAGE =
      DockerImageName.parse("rancher/k3s:v1.27.4-k3s1");

  private K3sContainer k3sContainer;
  private K8sPipelineClient client;
  private CoreV1Api coreApi;
  private BatchV1Api batchApi;

  private IngestionPipeline scheduledPipeline;
  private IngestionPipeline onDemandPipeline;

  @BeforeAll
  void setUp() throws Exception {
    LOG.info("Starting K3s container for integration tests...");

    k3sContainer = new K3sContainer(K3S_IMAGE);
    k3sContainer.start();

    LOG.info("K3s container started successfully");

    String kubeconfig = k3sContainer.getKubeConfigYaml();
    ApiClient apiClient = Config.fromConfig(new StringReader(kubeconfig));
    apiClient.setReadTimeout(30000);
    apiClient.setConnectTimeout(10000);

    coreApi = new CoreV1Api(apiClient);
    batchApi = new BatchV1Api(apiClient);

    createNamespace();

    Parameters params = new Parameters();
    params.setAdditionalProperty("namespace", NAMESPACE);
    params.setAdditionalProperty("inCluster", "false");
    params.setAdditionalProperty("skipInit", "true");
    params.setAdditionalProperty("ingestionImage", "openmetadata/ingestion:latest");
    params.setAdditionalProperty("serviceAccountName", "default");
    params.setAdditionalProperty("imagePullPolicy", "IfNotPresent");

    PipelineServiceClientConfiguration config = new PipelineServiceClientConfiguration();
    config.setEnabled(true);
    config.setMetadataApiEndpoint("http://openmetadata-server:8585/api");
    config.setParameters(params);

    client = new K8sPipelineClient(config);
    client.setBatchApi(batchApi);
    client.setCoreApi(coreApi);

    scheduledPipeline = createTestPipeline("scheduled-pipeline", "0 * * * *");
    onDemandPipeline = createTestPipeline("ondemand-pipeline", null);

    LOG.info("K8sPipelineClient integration test setup complete");
  }

  @AfterAll
  void tearDown() {
    if (k3sContainer != null) {
      LOG.info("Stopping K3s container...");
      k3sContainer.stop();
    }
  }

  private void createNamespace() throws Exception {
    V1Namespace namespace = new V1Namespace().metadata(new V1ObjectMeta().name(NAMESPACE));

    try {
      coreApi.createNamespace(namespace).execute();
      LOG.info("Created namespace: {}", NAMESPACE);
    } catch (Exception e) {
      if (e.getMessage() != null && e.getMessage().contains("already exists")) {
        LOG.info("Namespace {} already exists", NAMESPACE);
      } else {
        throw e;
      }
    }

    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(1, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                V1Namespace ns = coreApi.readNamespace(NAMESPACE).execute();
                return "Active".equals(ns.getStatus().getPhase());
              } catch (Exception e) {
                return false;
              }
            });
  }

  @Test
  @Order(1)
  void testDeployScheduledPipeline() throws Exception {
    LOG.info("Testing deployment of scheduled pipeline...");

    PipelineServiceClientResponse response = client.deployPipeline(scheduledPipeline, null);

    assertEquals(200, response.getCode());
    assertTrue(scheduledPipeline.getDeployed());

    V1ConfigMap configMap =
        coreApi.readNamespacedConfigMap("om-config-scheduled-pipeline", NAMESPACE).execute();
    assertNotNull(configMap);
    assertNotNull(configMap.getData());
    assertTrue(configMap.getData().containsKey("config"));

    V1Secret secret =
        coreApi.readNamespacedSecret("om-secret-scheduled-pipeline", NAMESPACE).execute();
    assertNotNull(secret);

    V1CronJob cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-scheduled-pipeline", NAMESPACE).execute();
    assertNotNull(cronJob);
    assertEquals("0 * * * *", cronJob.getSpec().getSchedule());
    assertFalse(cronJob.getSpec().getSuspend());

    LOG.info("Scheduled pipeline deployed successfully");
  }

  @Test
  @Order(2)
  void testDeployOnDemandPipeline() throws Exception {
    LOG.info("Testing deployment of on-demand pipeline...");

    PipelineServiceClientResponse response = client.deployPipeline(onDemandPipeline, null);

    assertEquals(200, response.getCode());
    assertTrue(onDemandPipeline.getDeployed());

    V1ConfigMap configMap =
        coreApi.readNamespacedConfigMap("om-config-ondemand-pipeline", NAMESPACE).execute();
    assertNotNull(configMap);

    V1Secret secret =
        coreApi.readNamespacedSecret("om-secret-ondemand-pipeline", NAMESPACE).execute();
    assertNotNull(secret);

    V1CronJobList cronJobs =
        batchApi
            .listNamespacedCronJob(NAMESPACE)
            .labelSelector("app.kubernetes.io/pipeline=ondemand-pipeline")
            .execute();
    assertTrue(cronJobs.getItems().isEmpty());

    LOG.info("On-demand pipeline deployed successfully");
  }

  @Test
  @Order(3)
  void testRunPipeline() throws Exception {
    LOG.info("Testing running a pipeline...");

    PipelineServiceClientResponse response = client.runPipeline(onDemandPipeline, null);

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("triggered"));

    Awaitility.await()
        .atMost(10, TimeUnit.SECONDS)
        .pollInterval(1, TimeUnit.SECONDS)
        .until(
            () -> {
              V1JobList jobs =
                  batchApi
                      .listNamespacedJob(NAMESPACE)
                      .labelSelector("app.kubernetes.io/pipeline=ondemand-pipeline")
                      .execute();
              return !jobs.getItems().isEmpty();
            });

    V1JobList jobs =
        batchApi
            .listNamespacedJob(NAMESPACE)
            .labelSelector("app.kubernetes.io/pipeline=ondemand-pipeline")
            .execute();

    assertFalse(jobs.getItems().isEmpty());
    V1Job job = jobs.getItems().get(0);
    assertTrue(job.getMetadata().getName().startsWith("om-job-ondemand-pipeline-"));

    LOG.info("Pipeline run triggered successfully, job: {}", job.getMetadata().getName());
  }

  @Test
  @Order(4)
  void testGetQueuedPipelineStatus() throws Exception {
    LOG.info("Testing getting pipeline status...");

    List<PipelineStatus> statuses = client.getQueuedPipelineStatus(onDemandPipeline);

    assertNotNull(statuses);
    assertFalse(statuses.isEmpty());

    PipelineStatus status = statuses.get(0);
    assertNotNull(status.getRunId());
    assertNotNull(status.getPipelineState());

    LOG.info("Got {} pipeline status(es)", statuses.size());
  }

  @Test
  @Order(5)
  void testToggleIngestionDisable() throws Exception {
    LOG.info("Testing disabling scheduled pipeline...");

    scheduledPipeline.setEnabled(true);
    PipelineServiceClientResponse response = client.toggleIngestion(scheduledPipeline);

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("disabled"));
    assertFalse(scheduledPipeline.getEnabled());

    V1CronJob cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-scheduled-pipeline", NAMESPACE).execute();
    assertTrue(cronJob.getSpec().getSuspend());

    LOG.info("Scheduled pipeline disabled successfully");
  }

  @Test
  @Order(6)
  void testToggleIngestionEnable() throws Exception {
    LOG.info("Testing enabling scheduled pipeline...");

    scheduledPipeline.setEnabled(false);
    PipelineServiceClientResponse response = client.toggleIngestion(scheduledPipeline);

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("enabled"));
    assertTrue(scheduledPipeline.getEnabled());

    V1CronJob cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-scheduled-pipeline", NAMESPACE).execute();
    assertFalse(cronJob.getSpec().getSuspend());

    LOG.info("Scheduled pipeline enabled successfully");
  }

  @Test
  @Order(7)
  void testKillIngestion() throws Exception {
    LOG.info("Testing killing pipeline jobs...");

    client.runPipeline(onDemandPipeline, null);

    Awaitility.await()
        .atMost(10, TimeUnit.SECONDS)
        .pollInterval(1, TimeUnit.SECONDS)
        .until(
            () -> {
              V1JobList jobs =
                  batchApi
                      .listNamespacedJob(NAMESPACE)
                      .labelSelector("app.kubernetes.io/pipeline=ondemand-pipeline")
                      .execute();
              return !jobs.getItems().isEmpty();
            });

    PipelineServiceClientResponse response = client.killIngestion(onDemandPipeline);

    assertEquals(200, response.getCode());

    // Verify jobs are deleted (K8s job deletion can take time with finalizers)
    Awaitility.await()
        .atMost(60, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .ignoreExceptions()
        .until(
            () -> {
              V1JobList jobs =
                  batchApi
                      .listNamespacedJob(NAMESPACE)
                      .labelSelector("app.kubernetes.io/pipeline=ondemand-pipeline")
                      .execute();
              // Jobs might be in Terminating state, check if any are actually active
              return jobs.getItems().stream()
                  .noneMatch(
                      job ->
                          job.getStatus() != null
                              && job.getStatus().getActive() != null
                              && job.getStatus().getActive() > 0);
            });

    LOG.info("Pipeline jobs killed successfully");
  }

  @Test
  @Order(8)
  void testRedeployPipelineUpdatesConfig() throws Exception {
    LOG.info("Testing redeployment updates config...");

    scheduledPipeline.getAirflowConfig().setScheduleInterval("30 * * * *");
    PipelineServiceClientResponse response = client.deployPipeline(scheduledPipeline, null);

    assertEquals(200, response.getCode());

    V1CronJob cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-scheduled-pipeline", NAMESPACE).execute();
    assertEquals("30 * * * *", cronJob.getSpec().getSchedule());

    LOG.info("Pipeline redeployed with updated config successfully");
  }

  @Test
  @Order(9)
  void testDeleteScheduledPipeline() throws Exception {
    LOG.info("Testing deletion of scheduled pipeline...");

    PipelineServiceClientResponse response = client.deletePipeline(scheduledPipeline);

    assertEquals(200, response.getCode());

    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                coreApi
                    .readNamespacedConfigMap("om-config-scheduled-pipeline", NAMESPACE)
                    .execute();
                return false;
              } catch (Exception e) {
                return e.getMessage() != null && e.getMessage().contains("404");
              }
            });

    LOG.info("Scheduled pipeline deleted successfully");
  }

  @Test
  @Order(10)
  void testDeleteOnDemandPipeline() throws Exception {
    LOG.info("Testing deletion of on-demand pipeline...");

    PipelineServiceClientResponse response = client.deletePipeline(onDemandPipeline);

    assertEquals(200, response.getCode());

    Awaitility.await()
        .atMost(30, TimeUnit.SECONDS)
        .pollInterval(2, TimeUnit.SECONDS)
        .until(
            () -> {
              try {
                coreApi.readNamespacedConfigMap("om-config-ondemand-pipeline", NAMESPACE).execute();
                return false;
              } catch (Exception e) {
                return e.getMessage() != null && e.getMessage().contains("404");
              }
            });

    LOG.info("On-demand pipeline deleted successfully");
  }

  @Test
  @Order(11)
  void testGetServiceStatus() {
    LOG.info("Testing service status...");

    PipelineServiceClientResponse status = client.getServiceStatus();

    assertEquals(200, status.getCode());
    assertEquals("Kubernetes", status.getPlatform());
    assertNotNull(status.getVersion());

    LOG.info("Service status: platform={}, version={}", status.getPlatform(), status.getVersion());
  }

  private IngestionPipeline createTestPipeline(String name, String schedule) {
    AirflowConfig airflowConfig = new AirflowConfig();
    if (schedule != null) {
      airflowConfig.setScheduleInterval(schedule);
    }
    airflowConfig.setPipelineTimezone("UTC");

    EntityReference serviceRef = new EntityReference();
    serviceRef.setId(UUID.randomUUID());
    serviceRef.setName("test-service");
    serviceRef.setType("databaseService");

    IngestionPipeline pipeline = new IngestionPipeline();
    pipeline.setId(UUID.randomUUID());
    pipeline.setName(name);
    pipeline.setFullyQualifiedName("test-service." + name);
    pipeline.setPipelineType(PipelineType.METADATA);
    pipeline.setAirflowConfig(airflowConfig);
    pipeline.setService(serviceRef);
    pipeline.setDeployed(false);
    pipeline.setEnabled(true);

    return pipeline;
  }
}
