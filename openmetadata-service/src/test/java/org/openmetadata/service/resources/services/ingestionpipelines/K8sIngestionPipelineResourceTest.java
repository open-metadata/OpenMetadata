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

package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import io.dropwizard.testing.ConfigOverride;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.apis.BatchV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1ConfigMap;
import io.kubernetes.client.openapi.models.V1CronJob;
import io.kubernetes.client.openapi.models.V1CronJobList;
import io.kubernetes.client.openapi.models.V1JobList;
import io.kubernetes.client.openapi.models.V1Namespace;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.util.Config;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.StringReader;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.util.TestUtils;
import org.testcontainers.k3s.K3sContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Integration test for IngestionPipeline API with K8sPipelineClient.
 *
 * <p>This test starts the OpenMetadata application with a K3s container and validates that pipeline
 * operations work correctly through the REST API with the Kubernetes backend.
 *
 * <p>Run with: mvn test -Dtest=K8sIngestionPipelineResourceTest -DargLine="-DenableK8s=true"
 */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class K8sIngestionPipelineResourceTest extends OpenMetadataApplicationTest {

  private static final String K8S_NAMESPACE = "openmetadata-pipelines";
  private static final DockerImageName K3S_IMAGE =
      DockerImageName.parse("rancher/k3s:v1.27.4-k3s1");
  private static final String COLLECTION = "services/ingestionPipelines";

  private static K3sContainer k3sContainer;
  private static CoreV1Api coreApi;
  private static BatchV1Api batchApi;
  private static boolean k8sEnabled;
  private static String kubeConfigYaml;

  private static EntityReference testServiceRef;
  private static SourceConfig DATABASE_METADATA_CONFIG;
  private static Date START_DATE;

  @Override
  protected DropwizardAppExtension<OpenMetadataApplicationConfig> getApp(
      ConfigOverride[] configOverridesArray) {
    // Check both system property and environment variable for enabling K8s tests
    k8sEnabled =
        "true".equals(System.getProperty("enableK8s"))
            || "true".equalsIgnoreCase(System.getenv("ENABLE_K8S_TESTS"));

    if (!k8sEnabled) {
      LOG.info("K8s tests disabled. Set -DenableK8s=true or ENABLE_K8S_TESTS=true to enable.");
      return super.getApp(configOverridesArray);
    }

    try {
      // Reset the pipeline service client factory to ensure we create a new K8s client
      // instead of reusing a cached MockPipelineServiceClient from other tests
      org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory.reset();

      setupK3sContainer();

      ConfigOverride[] k8sOverrides =
          new ConfigOverride[] {
            ConfigOverride.config(
                "pipelineServiceClientConfiguration.className",
                "org.openmetadata.service.clients.pipeline.k8s.K8sPipelineClient"),
            ConfigOverride.config(
                "pipelineServiceClientConfiguration.parameters.namespace", K8S_NAMESPACE),
            ConfigOverride.config(
                "pipelineServiceClientConfiguration.parameters.inCluster", "false"),
            ConfigOverride.config(
                "pipelineServiceClientConfiguration.parameters.kubeConfigContent", kubeConfigYaml),
            ConfigOverride.config(
                "pipelineServiceClientConfiguration.parameters.ingestionImage",
                "openmetadata/ingestion:latest"),
            ConfigOverride.config(
                "pipelineServiceClientConfiguration.parameters.serviceAccountName", "default"),
            ConfigOverride.config(
                "pipelineServiceClientConfiguration.parameters.imagePullPolicy", "IfNotPresent")
          };

      ConfigOverride[] combined =
          new ConfigOverride[configOverridesArray.length + k8sOverrides.length];
      System.arraycopy(configOverridesArray, 0, combined, 0, configOverridesArray.length);
      System.arraycopy(k8sOverrides, 0, combined, configOverridesArray.length, k8sOverrides.length);

      LOG.info("K8s overrides count: {}", k8sOverrides.length);
      LOG.info("Total combined overrides: {}", combined.length);
      for (ConfigOverride override : k8sOverrides) {
        LOG.info("K8s override: {}", override);
      }

      return new DropwizardAppExtension<>(OpenMetadataApplication.class, CONFIG_PATH, combined);
    } catch (Exception e) {
      LOG.error("Failed to setup K3s container", e);
      k8sEnabled = false;
      return super.getApp(configOverridesArray);
    }
  }

  private void setupK3sContainer() throws Exception {
    LOG.info("Starting K3s container for integration tests...");

    k3sContainer = new K3sContainer(K3S_IMAGE);
    k3sContainer.start();
    kubeConfigYaml = k3sContainer.getKubeConfigYaml();

    ApiClient apiClient = Config.fromConfig(new StringReader(kubeConfigYaml));
    apiClient.setReadTimeout(30000);
    apiClient.setConnectTimeout(10000);

    coreApi = new CoreV1Api(apiClient);
    batchApi = new BatchV1Api(apiClient);

    createK8sNamespace();
    LOG.info("K3s container started and namespace created");
  }

  private void createK8sNamespace() throws Exception {
    V1Namespace namespace = new V1Namespace().metadata(new V1ObjectMeta().name(K8S_NAMESPACE));

    try {
      coreApi.createNamespace(namespace).execute();
      LOG.info("Created namespace: {}", K8S_NAMESPACE);
    } catch (Exception e) {
      if (e.getMessage() != null && e.getMessage().contains("already exists")) {
        LOG.info("Namespace {} already exists", K8S_NAMESPACE);
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
                V1Namespace ns = coreApi.readNamespace(K8S_NAMESPACE).execute();
                return "Active".equals(ns.getStatus().getPhase());
              } catch (Exception e) {
                return false;
              }
            });
  }

  @Override
  @BeforeAll
  public void createApplication() throws Exception {
    // Call parent's createApplication which sets up containers, migrations, and starts the app
    super.createApplication();

    if (k8sEnabled) {
      // Reset the PipelineServiceClientFactory after the app starts
      // This is necessary because migrations create a MockPipelineServiceClient before
      // ConfigOverrides are applied, and it gets cached in the singleton factory
      LOG.info("Resetting PipelineServiceClientFactory to use K8sPipelineClient");
      org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory.reset();

      // Force re-creation of the client by calling any API that uses it
      // The next call to createPipelineServiceClient will use the overridden config
    }
  }

  @BeforeAll
  public void setupTestData() throws Exception {
    if (!k8sEnabled) {
      return;
    }

    DatabaseServiceMetadataPipeline databaseServiceMetadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withIncludeViews(true)
            .withSchemaFilterPattern(
                new FilterPattern().withExcludes(List.of("information_schema.*", "test.*")))
            .withTableFilterPattern(
                new FilterPattern().withIncludes(List.of("sales.*", "users.*")));
    DATABASE_METADATA_CONFIG = new SourceConfig().withConfig(databaseServiceMetadataPipeline);
    START_DATE = new DateTime("2022-06-10T15:06:47+00:00").toDate();

    testServiceRef = createTestDatabaseService();
  }

  private EntityReference createTestDatabaseService() throws Exception {
    String serviceName = "k8s-test-service-" + UUID.randomUUID().toString().substring(0, 8);

    MysqlConnection mysqlConnection =
        new MysqlConnection()
            .withHostPort("localhost:3306")
            .withUsername("test")
            .withAuthType(new basicAuth().withPassword("test"));

    CreateDatabaseService createService =
        new CreateDatabaseService()
            .withName(serviceName)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(new DatabaseConnection().withConfig(mysqlConnection));

    WebTarget target = getResource("services/databaseServices");
    DatabaseService service =
        TestUtils.post(target, createService, DatabaseService.class, ADMIN_AUTH_HEADERS);

    return new EntityReference()
        .withId(service.getId())
        .withName(service.getName())
        .withType("databaseService");
  }

  @Override
  public void stopApplication() throws Exception {
    super.stopApplication();
    if (k3sContainer != null && k3sContainer.isRunning()) {
      LOG.info("Stopping K3s container...");
      k3sContainer.stop();
    }
  }

  private String sanitizeName(String name) {
    return name.toLowerCase().replaceAll("[^a-z0-9-]", "-");
  }

  private IngestionPipeline createPipeline(String name, String schedule) throws Exception {
    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(name)
            .withPipelineType(PipelineType.METADATA)
            .withService(testServiceRef)
            .withSourceConfig(DATABASE_METADATA_CONFIG)
            .withAirflowConfig(
                schedule != null
                    ? new AirflowConfig().withStartDate(START_DATE).withScheduleInterval(schedule)
                    : new AirflowConfig().withStartDate(START_DATE));

    WebTarget target = getResource(COLLECTION);
    return TestUtils.post(target, request, IngestionPipeline.class, ADMIN_AUTH_HEADERS);
  }

  @Test
  @Order(1)
  void test_deployScheduledPipeline_withK8sBackend() throws Exception {
    if (!k8sEnabled) {
      LOG.info("Skipping K8s test - not enabled");
      return;
    }

    IngestionPipeline pipeline = createPipeline("k8s-scheduled-test", "0 * * * *");
    assertNotNull(pipeline);

    WebTarget target = getResource(COLLECTION + "/deploy/" + pipeline.getId());
    PipelineServiceClientResponse response =
        TestUtils.post(target, "", PipelineServiceClientResponse.class, 200, ADMIN_AUTH_HEADERS);

    assertEquals(200, response.getCode());
    assertEquals("Kubernetes", response.getPlatform());

    String sanitizedName = sanitizeName("k8s-scheduled-test");
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
  @Order(2)
  void test_deployOnDemandPipeline_withK8sBackend() throws Exception {
    if (!k8sEnabled) {
      LOG.info("Skipping K8s test - not enabled");
      return;
    }

    IngestionPipeline pipeline = createPipeline("k8s-ondemand-test", null);
    assertNotNull(pipeline);

    WebTarget target = getResource(COLLECTION + "/deploy/" + pipeline.getId());
    PipelineServiceClientResponse response =
        TestUtils.post(target, "", PipelineServiceClientResponse.class, 200, ADMIN_AUTH_HEADERS);

    assertEquals(200, response.getCode());

    String sanitizedName = sanitizeName("k8s-ondemand-test");

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
  @Order(3)
  void test_runPipeline_withK8sBackend() throws Exception {
    if (!k8sEnabled) {
      LOG.info("Skipping K8s test - not enabled");
      return;
    }

    IngestionPipeline pipeline = createPipeline("k8s-run-test", null);

    WebTarget deployTarget = getResource(COLLECTION + "/deploy/" + pipeline.getId());
    TestUtils.post(deployTarget, "", PipelineServiceClientResponse.class, 200, ADMIN_AUTH_HEADERS);

    WebTarget runTarget = getResource(COLLECTION + "/trigger/" + pipeline.getId());
    PipelineServiceClientResponse response =
        TestUtils.post(runTarget, "", PipelineServiceClientResponse.class, 200, ADMIN_AUTH_HEADERS);

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("triggered"));

    String sanitizedName = sanitizeName("k8s-run-test");
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
  @Order(4)
  void test_togglePipeline_withK8sBackend() throws Exception {
    if (!k8sEnabled) {
      LOG.info("Skipping K8s test - not enabled");
      return;
    }

    IngestionPipeline pipeline = createPipeline("k8s-toggle-test", "0 * * * *");

    WebTarget deployTarget = getResource(COLLECTION + "/deploy/" + pipeline.getId());
    TestUtils.post(deployTarget, "", PipelineServiceClientResponse.class, 200, ADMIN_AUTH_HEADERS);

    String sanitizedName = sanitizeName("k8s-toggle-test");
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

    WebTarget toggleTarget = getResource(COLLECTION + "/toggleIngestion/" + pipeline.getId());
    TestUtils.post(
        toggleTarget,
        "",
        IngestionPipeline.class,
        Response.Status.OK.getStatusCode(),
        ADMIN_AUTH_HEADERS);

    V1CronJob cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE).execute();
    assertTrue(cronJob.getSpec().getSuspend());

    TestUtils.post(
        toggleTarget,
        "",
        IngestionPipeline.class,
        Response.Status.OK.getStatusCode(),
        ADMIN_AUTH_HEADERS);

    cronJob =
        batchApi.readNamespacedCronJob("om-cronjob-" + sanitizedName, K8S_NAMESPACE).execute();
    assertFalse(cronJob.getSpec().getSuspend());

    LOG.info("Pipeline toggle tested successfully with K8s backend");
  }

  @Test
  @Order(5)
  void test_killPipeline_withK8sBackend() throws Exception {
    if (!k8sEnabled) {
      LOG.info("Skipping K8s test - not enabled");
      return;
    }

    IngestionPipeline pipeline = createPipeline("k8s-kill-test", null);

    WebTarget deployTarget = getResource(COLLECTION + "/deploy/" + pipeline.getId());
    TestUtils.post(deployTarget, "", PipelineServiceClientResponse.class, 200, ADMIN_AUTH_HEADERS);

    WebTarget runTarget = getResource(COLLECTION + "/trigger/" + pipeline.getId());
    TestUtils.post(runTarget, "", PipelineServiceClientResponse.class, 200, ADMIN_AUTH_HEADERS);

    String sanitizedName = sanitizeName("k8s-kill-test");
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

    WebTarget killTarget = getResource(COLLECTION + "/kill/" + pipeline.getId());
    PipelineServiceClientResponse response =
        TestUtils.post(
            killTarget, "", PipelineServiceClientResponse.class, 200, ADMIN_AUTH_HEADERS);

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
  @Order(6)
  void test_deletePipeline_withK8sBackend() throws Exception {
    if (!k8sEnabled) {
      LOG.info("Skipping K8s test - not enabled");
      return;
    }

    IngestionPipeline pipeline = createPipeline("k8s-delete-test", "0 * * * *");

    WebTarget deployTarget = getResource(COLLECTION + "/deploy/" + pipeline.getId());
    TestUtils.post(deployTarget, "", PipelineServiceClientResponse.class, 200, ADMIN_AUTH_HEADERS);

    String sanitizedName = sanitizeName("k8s-delete-test");
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

    WebTarget deleteTarget = getResource(COLLECTION + "/" + pipeline.getId());
    TestUtils.delete(deleteTarget, ADMIN_AUTH_HEADERS);

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
  @Order(7)
  void test_getServiceStatus_withK8sBackend() throws Exception {
    if (!k8sEnabled) {
      LOG.info("Skipping K8s test - not enabled");
      return;
    }

    WebTarget target = getResource(COLLECTION + "/status");
    PipelineServiceClientResponse response =
        TestUtils.get(target, PipelineServiceClientResponse.class, ADMIN_AUTH_HEADERS);

    assertEquals(200, response.getCode());
    assertEquals("Kubernetes", response.getPlatform());
    assertNotNull(response.getVersion());

    LOG.info(
        "Service status: platform={}, version={}", response.getPlatform(), response.getVersion());
  }
}
