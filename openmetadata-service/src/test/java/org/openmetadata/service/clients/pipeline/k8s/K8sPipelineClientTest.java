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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.BatchV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.apis.CustomObjectsApi;
import io.kubernetes.client.openapi.models.V1ConfigMap;
import io.kubernetes.client.openapi.models.V1Container;
import io.kubernetes.client.openapi.models.V1CronJob;
import io.kubernetes.client.openapi.models.V1CronJobSpec;
import io.kubernetes.client.openapi.models.V1EnvVar;
import io.kubernetes.client.openapi.models.V1EnvVarSource;
import io.kubernetes.client.openapi.models.V1Job;
import io.kubernetes.client.openapi.models.V1JobList;
import io.kubernetes.client.openapi.models.V1JobStatus;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1Pod;
import io.kubernetes.client.openapi.models.V1PodList;
import io.kubernetes.client.openapi.models.V1PodSpec;
import io.kubernetes.client.openapi.models.V1Secret;
import io.kubernetes.client.openapi.models.V1Status;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.IngestionPipelineDeploymentException;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.EntityUtil;

@ExtendWith(MockitoExtension.class)
class K8sPipelineClientTest {

  @Mock private BatchV1Api batchApi;
  @Mock private CoreV1Api coreApi;
  @Mock private CustomObjectsApi customObjectsApi;
  @Mock private BatchV1Api.APIcreateNamespacedJobRequest createJobRequest;
  @Mock private BatchV1Api.APIlistNamespacedJobRequest listJobRequest;
  @Mock private BatchV1Api.APIdeleteNamespacedJobRequest deleteJobRequest;
  @Mock private BatchV1Api.APIreadNamespacedCronJobRequest readCronJobRequest;
  @Mock private BatchV1Api.APIreplaceNamespacedCronJobRequest replaceCronJobRequest;
  @Mock private BatchV1Api.APIcreateNamespacedCronJobRequest createCronJobRequest;
  @Mock private BatchV1Api.APIdeleteNamespacedCronJobRequest deleteCronJobRequest;
  @Mock private CoreV1Api.APIcreateNamespacedConfigMapRequest createConfigMapRequest;
  @Mock private CoreV1Api.APIreadNamespacedConfigMapRequest readConfigMapRequest;
  @Mock private CoreV1Api.APIreplaceNamespacedConfigMapRequest replaceConfigMapRequest;
  @Mock private CoreV1Api.APIcreateNamespacedSecretRequest createSecretRequest;
  @Mock private CoreV1Api.APIreadNamespacedSecretRequest readSecretRequest;
  @Mock private CoreV1Api.APIreplaceNamespacedSecretRequest replaceSecretRequest;
  @Mock private CoreV1Api.APIreadNamespaceRequest readNamespaceRequest;
  @Mock private CoreV1Api.APIdeleteNamespacedConfigMapRequest deleteConfigMapRequest;
  @Mock private CoreV1Api.APIdeleteNamespacedSecretRequest deleteSecretRequest;
  @Mock private CoreV1Api.APIlistNamespacedPodRequest listPodRequest;
  @Mock private CoreV1Api.APIlistNamespacedConfigMapRequest listConfigMapRequest;
  @Mock private CoreV1Api.APIlistNamespacedSecretRequest listSecretRequest;
  @Mock private CoreV1Api.APIreadNamespacedPodLogRequest readPodLogRequest;
  @Mock private CustomObjectsApi.APIcreateNamespacedCustomObjectRequest createCustomObjectRequest;
  @Mock private CustomObjectsApi.APIgetNamespacedCustomObjectRequest getCustomObjectRequest;
  @Mock private CustomObjectsApi.APIreplaceNamespacedCustomObjectRequest replaceCustomObjectRequest;
  @Mock private CustomObjectsApi.APIlistNamespacedCustomObjectRequest listCustomObjectsRequest;
  @Mock private CustomObjectsApi.APIdeleteNamespacedCustomObjectRequest deleteCustomObjectRequest;

  private K8sPipelineClient client;
  private ServiceEntityInterface testService;
  private static final String NAMESPACE = "openmetadata-pipelines";

  @BeforeEach
  void setUp() {
    Parameters params = new Parameters();
    params.setAdditionalProperty("namespace", NAMESPACE);
    params.setAdditionalProperty("inCluster", "false");
    params.setAdditionalProperty("skipInit", "true");
    params.setAdditionalProperty("ingestionImage", "openmetadata/ingestion:test");
    params.setAdditionalProperty("serviceAccountName", "test-sa");

    PipelineServiceClientConfiguration config = new PipelineServiceClientConfiguration();
    config.setEnabled(true);
    config.setMetadataApiEndpoint("http://localhost:8585/api");
    config.setParameters(params);

    client = new K8sPipelineClient(config);
    client.setBatchApi(batchApi);
    client.setCoreApi(coreApi);
    setField(client, "customObjectsApi", customObjectsApi);

    // Create test service
    testService = createTestService();
  }

  @Test
  void testDeployPipelineWithSchedule() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");

    when(coreApi.readNamespacedConfigMap(any(), eq(NAMESPACE))).thenReturn(readConfigMapRequest);
    when(readConfigMapRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.createNamespacedConfigMap(eq(NAMESPACE), any()))
        .thenReturn(createConfigMapRequest);
    when(createConfigMapRequest.execute()).thenReturn(new V1ConfigMap());

    when(coreApi.readNamespacedSecret(any(), eq(NAMESPACE))).thenReturn(readSecretRequest);
    when(readSecretRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.createNamespacedSecret(eq(NAMESPACE), any())).thenReturn(createSecretRequest);
    when(createSecretRequest.execute()).thenReturn(new V1Secret());

    when(batchApi.readNamespacedCronJob(any(), eq(NAMESPACE))).thenReturn(readCronJobRequest);
    when(readCronJobRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(batchApi.createNamespacedCronJob(eq(NAMESPACE), any())).thenReturn(createCronJobRequest);
    when(createCronJobRequest.execute()).thenReturn(new V1CronJob());

    PipelineServiceClientResponse response = client.deployPipeline(pipeline, testService);

    assertEquals(200, response.getCode());
    assertTrue(pipeline.getDeployed());
    verify(coreApi).createNamespacedConfigMap(eq(NAMESPACE), any());
    verify(coreApi).createNamespacedSecret(eq(NAMESPACE), any());
    verify(batchApi).createNamespacedCronJob(eq(NAMESPACE), any());
  }

  @Test
  void testDeployPipelineWithoutSchedule() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    when(coreApi.readNamespacedConfigMap(any(), eq(NAMESPACE))).thenReturn(readConfigMapRequest);
    when(readConfigMapRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.createNamespacedConfigMap(eq(NAMESPACE), any()))
        .thenReturn(createConfigMapRequest);
    when(createConfigMapRequest.execute()).thenReturn(new V1ConfigMap());

    when(coreApi.readNamespacedSecret(any(), eq(NAMESPACE))).thenReturn(readSecretRequest);
    when(readSecretRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.createNamespacedSecret(eq(NAMESPACE), any())).thenReturn(createSecretRequest);
    when(createSecretRequest.execute()).thenReturn(new V1Secret());

    when(batchApi.deleteNamespacedCronJob(any(), eq(NAMESPACE))).thenReturn(deleteCronJobRequest);
    when(deleteCronJobRequest.execute()).thenThrow(new ApiException(404, "Not found"));

    PipelineServiceClientResponse response = client.deployPipeline(pipeline, testService);

    assertEquals(200, response.getCode());
    assertTrue(pipeline.getDeployed());
    verify(batchApi, never()).createNamespacedCronJob(any(), any());
  }

  @Test
  void testRunPipelineCreatesJob() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    when(batchApi.createNamespacedJob(eq(NAMESPACE), any())).thenReturn(createJobRequest);
    when(createJobRequest.execute()).thenReturn(new V1Job());

    PipelineServiceClientResponse response = client.runPipeline(pipeline, testService);

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("triggered"));

    ArgumentCaptor<V1Job> jobCaptor = ArgumentCaptor.forClass(V1Job.class);
    verify(batchApi).createNamespacedJob(eq(NAMESPACE), jobCaptor.capture());

    V1Job createdJob = jobCaptor.getValue();
    assertNotNull(createdJob.getMetadata());
    assertTrue(createdJob.getMetadata().getName().startsWith("om-job-test-pipeline-"));
    assertEquals(
        "test-pipeline", createdJob.getMetadata().getLabels().get("app.kubernetes.io/pipeline"));
  }

  @Test
  void testBuildEnvVarsIncludeConfigAndExtraEnvVars() {
    K8sPipelineClient clientWithExtraEnvs = createClientWithExtraEnvVars();
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);
    String runId = UUID.randomUUID().toString();

    List<V1EnvVar> envVars = clientWithExtraEnvs.buildEnvVars(pipeline, runId, null, testService);
    Map<String, String> envMap = toEnvMap(envVars);

    assertTrue(envMap.containsKey("config"));
    assertFalse(StringUtils.isBlank(envMap.get("config")));
    assertEquals("bar", envMap.get("FOO"));
    assertEquals("qux", envMap.get("BAZ"));
    assertFalse(envMap.containsKey("OPENMETADATA_SERVER_URL"));
  }

  @Test
  void testExitHandlerEnvVarsIncludeConfigAndExtraEnvVars() {
    K8sPipelineClient clientWithExtraEnvs = createClientWithExtraEnvVars();
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);
    String runId = UUID.randomUUID().toString();

    List<V1EnvVar> envVars =
        clientWithExtraEnvs.buildExitHandlerEnvVars(pipeline, runId, null, testService);
    Map<String, String> envMap = toEnvMap(envVars);

    assertTrue(envMap.containsKey("config"));
    assertFalse(StringUtils.isBlank(envMap.get("config")));
    assertEquals("bar", envMap.get("FOO"));
    assertEquals("qux", envMap.get("BAZ"));
    assertFalse(envMap.containsKey("OPENMETADATA_SERVER_URL"));
  }

  @Test
  void testBuildCronOMJobUsesConfigMap() {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");

    CronOMJob cronOMJob = clientWithOMJob.buildCronOMJob(pipeline);

    assertEquals("om-cronomjob-test-pipeline", cronOMJob.getMetadata().getName());
    assertEquals("0 * * * *", cronOMJob.getSpec().getSchedule());
    assertEquals("UTC", cronOMJob.getSpec().getTimeZone());

    List<V1EnvVar> env = cronOMJob.getSpec().getOmJobSpec().getMainPodSpec().getEnv();
    Map<String, V1EnvVar> envMap =
        env.stream().collect(Collectors.toMap(V1EnvVar::getName, v -> v));

    V1EnvVar configEnv = envMap.get("config");
    assertNotNull(configEnv);
    V1EnvVarSource source = configEnv.getValueFrom();
    assertNotNull(source);
    assertNotNull(source.getConfigMapKeyRef());
    assertEquals("om-config-test-pipeline", source.getConfigMapKeyRef().getName());
  }

  @Test
  void testBuildCronOMJobWithCustomTimezone() {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");
    pipeline.getAirflowConfig().setPipelineTimezone("America/New_York");

    CronOMJob cronOMJob = clientWithOMJob.buildCronOMJob(pipeline);

    assertEquals("America/New_York", cronOMJob.getSpec().getTimeZone());
  }

  @Test
  void testBuildCronOMJobWithDisabledPipeline() {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");
    pipeline.setEnabled(false);

    CronOMJob cronOMJob = clientWithOMJob.buildCronOMJob(pipeline);

    assertTrue(cronOMJob.getSpec().getSuspend());
  }

  @Test
  void testBuildCronOMJobWithHistoryLimits() {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");

    CronOMJob cronOMJob = clientWithOMJob.buildCronOMJob(pipeline);

    assertEquals(3, cronOMJob.getSpec().getSuccessfulJobsHistoryLimit());
    assertEquals(3, cronOMJob.getSpec().getFailedJobsHistoryLimit());
  }

  @Test
  void testBuildCronOMJobWithStartingDeadline() {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");

    CronOMJob cronOMJob = clientWithOMJob.buildCronOMJob(pipeline);

    assertNotNull(cronOMJob.getSpec().getStartingDeadlineSeconds());
    assertEquals(60, cronOMJob.getSpec().getStartingDeadlineSeconds());
  }

  @Test
  void testOMCronScheduleConversion() {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);

    // Test daily schedule
    IngestionPipeline dailyPipeline = createTestPipeline("daily", "@daily");
    CronOMJob dailyCron = clientWithOMJob.buildCronOMJob(dailyPipeline);
    assertEquals("0 0 * * *", dailyCron.getSpec().getSchedule());

    // Test hourly schedule
    IngestionPipeline hourlyPipeline = createTestPipeline("hourly", "@hourly");
    CronOMJob hourlyCron = clientWithOMJob.buildCronOMJob(hourlyPipeline);
    assertEquals("0 * * * *", hourlyCron.getSpec().getSchedule());

    // Test weekly schedule
    IngestionPipeline weeklyPipeline = createTestPipeline("weekly", "@weekly");
    CronOMJob weeklyCron = clientWithOMJob.buildCronOMJob(weeklyPipeline);
    assertEquals("0 0 * * 0", weeklyCron.getSpec().getSchedule());

    // Test custom cron expression
    IngestionPipeline customPipeline = createTestPipeline("custom", "*/15 * * * *");
    CronOMJob customCron = clientWithOMJob.buildCronOMJob(customPipeline);
    assertEquals("*/15 * * * *", customCron.getSpec().getSchedule());
  }

  @Test
  void testKillIngestionDeletesActiveJobs() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    V1Job activeJob =
        new V1Job()
            .metadata(new V1ObjectMeta().name("om-job-test-pipeline-abc123"))
            .status(new V1JobStatus().active(1));
    V1JobList jobList = new V1JobList().items(List.of(activeJob));

    when(batchApi.listNamespacedJob(eq(NAMESPACE))).thenReturn(listJobRequest);
    when(listJobRequest.labelSelector(any())).thenReturn(listJobRequest);
    when(listJobRequest.execute()).thenReturn(jobList);
    when(batchApi.deleteNamespacedJob(any(), eq(NAMESPACE))).thenReturn(deleteJobRequest);
    when(deleteJobRequest.propagationPolicy(any())).thenReturn(deleteJobRequest);
    when(deleteJobRequest.execute()).thenReturn(new V1Status());

    PipelineServiceClientResponse response = client.killIngestion(pipeline);

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("1"));
    verify(batchApi).deleteNamespacedJob(eq("om-job-test-pipeline-abc123"), eq(NAMESPACE));
  }

  @Test
  void testToggleIngestionSuspendsCronJob() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");
    pipeline.setEnabled(true);

    V1CronJob cronJob =
        new V1CronJob()
            .metadata(new V1ObjectMeta().name("om-cronjob-test-pipeline"))
            .spec(new V1CronJobSpec().suspend(false));

    when(batchApi.readNamespacedCronJob(any(), eq(NAMESPACE))).thenReturn(readCronJobRequest);
    when(readCronJobRequest.execute()).thenReturn(cronJob);
    when(batchApi.replaceNamespacedCronJob(any(), eq(NAMESPACE), any()))
        .thenReturn(replaceCronJobRequest);
    when(replaceCronJobRequest.execute()).thenReturn(cronJob);

    PipelineServiceClientResponse response = client.toggleIngestion(pipeline);

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("disabled"));
    assertFalse(pipeline.getEnabled());

    ArgumentCaptor<V1CronJob> cronJobCaptor = ArgumentCaptor.forClass(V1CronJob.class);
    verify(batchApi).replaceNamespacedCronJob(any(), eq(NAMESPACE), cronJobCaptor.capture());
    assertTrue(cronJobCaptor.getValue().getSpec().getSuspend());
  }

  @Test
  void testToggleIngestionEnablesCronJob() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");
    pipeline.setEnabled(false);

    V1CronJob cronJob =
        new V1CronJob()
            .metadata(new V1ObjectMeta().name("om-cronjob-test-pipeline"))
            .spec(new V1CronJobSpec().suspend(true));

    when(batchApi.readNamespacedCronJob(any(), eq(NAMESPACE))).thenReturn(readCronJobRequest);
    when(readCronJobRequest.execute()).thenReturn(cronJob);
    when(batchApi.replaceNamespacedCronJob(any(), eq(NAMESPACE), any()))
        .thenReturn(replaceCronJobRequest);
    when(replaceCronJobRequest.execute()).thenReturn(cronJob);

    PipelineServiceClientResponse response = client.toggleIngestion(pipeline);

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("enabled"));
    assertTrue(pipeline.getEnabled());
  }

  @Test
  void testDeletePipelineRemovesAllResources() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");

    when(batchApi.listNamespacedJob(eq(NAMESPACE))).thenReturn(listJobRequest);
    when(listJobRequest.labelSelector(any())).thenReturn(listJobRequest);
    when(listJobRequest.execute()).thenReturn(new V1JobList().items(List.of()));

    when(batchApi.deleteNamespacedCronJob(any(), eq(NAMESPACE))).thenReturn(deleteCronJobRequest);
    when(deleteCronJobRequest.execute()).thenReturn(new V1Status());

    when(coreApi.deleteNamespacedSecret(any(), eq(NAMESPACE))).thenReturn(deleteSecretRequest);
    when(deleteSecretRequest.execute()).thenReturn(new V1Status());

    when(coreApi.deleteNamespacedConfigMap(any(), eq(NAMESPACE)))
        .thenReturn(deleteConfigMapRequest);
    when(deleteConfigMapRequest.execute()).thenReturn(new V1Status());

    PipelineServiceClientResponse response = client.deletePipeline(pipeline);

    assertEquals(200, response.getCode());
    verify(batchApi).deleteNamespacedCronJob(eq("om-cronjob-test-pipeline"), eq(NAMESPACE));
    verify(coreApi).deleteNamespacedSecret(eq("om-secret-test-pipeline"), eq(NAMESPACE));
    verify(coreApi).deleteNamespacedConfigMap(eq("om-config-test-pipeline"), eq(NAMESPACE));
  }

  @Test
  void testDeployPipelineRollbackOnCronJobFailure() throws Exception {
    // Tests P0: Resource cleanup on partial deployment failure
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");

    // ConfigMap creation succeeds
    when(coreApi.readNamespacedConfigMap(any(), eq(NAMESPACE))).thenReturn(readConfigMapRequest);
    when(readConfigMapRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.createNamespacedConfigMap(eq(NAMESPACE), any()))
        .thenReturn(createConfigMapRequest);
    when(createConfigMapRequest.execute()).thenReturn(new V1ConfigMap());

    // Secret creation succeeds
    when(coreApi.readNamespacedSecret(any(), eq(NAMESPACE))).thenReturn(readSecretRequest);
    when(readSecretRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.createNamespacedSecret(eq(NAMESPACE), any())).thenReturn(createSecretRequest);
    when(createSecretRequest.execute()).thenReturn(new V1Secret());

    // CronJob creation fails with 403 (non-retryable)
    when(batchApi.readNamespacedCronJob(any(), eq(NAMESPACE))).thenReturn(readCronJobRequest);
    when(readCronJobRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(batchApi.createNamespacedCronJob(eq(NAMESPACE), any())).thenReturn(createCronJobRequest);
    when(createCronJobRequest.execute()).thenThrow(new ApiException(403, "Forbidden"));

    // Setup rollback mocks
    when(coreApi.deleteNamespacedConfigMap(any(), eq(NAMESPACE)))
        .thenReturn(deleteConfigMapRequest);
    when(deleteConfigMapRequest.execute()).thenReturn(new V1Status());
    when(coreApi.deleteNamespacedSecret(any(), eq(NAMESPACE))).thenReturn(deleteSecretRequest);
    when(deleteSecretRequest.execute()).thenReturn(new V1Status());

    // Verify deployment fails and rollback occurs
    assertThrows(
        IngestionPipelineDeploymentException.class,
        () -> client.deployPipeline(pipeline, testService));

    // Verify rollback deleted the created resources
    verify(coreApi).deleteNamespacedConfigMap(eq("om-config-test-pipeline"), eq(NAMESPACE));
    verify(coreApi).deleteNamespacedSecret(eq("om-secret-test-pipeline"), eq(NAMESPACE));
  }

  @Test
  void testOptimisticLockingUsesResourceVersion() throws Exception {
    // Tests P1: Optimistic locking with resourceVersion
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");

    // ConfigMap exists with resourceVersion
    V1ConfigMap existingConfigMap =
        new V1ConfigMap()
            .metadata(new V1ObjectMeta().name("om-config-test-pipeline").resourceVersion("12345"));
    when(coreApi.readNamespacedConfigMap(any(), eq(NAMESPACE))).thenReturn(readConfigMapRequest);
    when(readConfigMapRequest.execute()).thenReturn(existingConfigMap);
    when(coreApi.replaceNamespacedConfigMap(any(), eq(NAMESPACE), any()))
        .thenReturn(replaceConfigMapRequest);
    when(replaceConfigMapRequest.execute()).thenReturn(new V1ConfigMap());

    // Secret exists with resourceVersion
    V1Secret existingSecret =
        new V1Secret()
            .metadata(new V1ObjectMeta().name("om-secret-test-pipeline").resourceVersion("67890"));
    when(coreApi.readNamespacedSecret(any(), eq(NAMESPACE))).thenReturn(readSecretRequest);
    when(readSecretRequest.execute()).thenReturn(existingSecret);
    when(coreApi.replaceNamespacedSecret(any(), eq(NAMESPACE), any()))
        .thenReturn(replaceSecretRequest);
    when(replaceSecretRequest.execute()).thenReturn(new V1Secret());

    // CronJob exists with resourceVersion
    V1CronJob existingCronJob =
        new V1CronJob()
            .metadata(new V1ObjectMeta().name("om-cronjob-test-pipeline").resourceVersion("11111"))
            .spec(new V1CronJobSpec().schedule("0 * * * *"));
    when(batchApi.readNamespacedCronJob(any(), eq(NAMESPACE))).thenReturn(readCronJobRequest);
    when(readCronJobRequest.execute()).thenReturn(existingCronJob);
    when(batchApi.replaceNamespacedCronJob(any(), eq(NAMESPACE), any()))
        .thenReturn(replaceCronJobRequest);
    when(replaceCronJobRequest.execute()).thenReturn(new V1CronJob());

    PipelineServiceClientResponse response = client.deployPipeline(pipeline, testService);
    assertEquals(200, response.getCode());

    // Verify resourceVersion is set on updates
    ArgumentCaptor<V1ConfigMap> configMapCaptor = ArgumentCaptor.forClass(V1ConfigMap.class);
    verify(coreApi).replaceNamespacedConfigMap(any(), eq(NAMESPACE), configMapCaptor.capture());
    assertEquals("12345", configMapCaptor.getValue().getMetadata().getResourceVersion());

    ArgumentCaptor<V1Secret> secretCaptor = ArgumentCaptor.forClass(V1Secret.class);
    verify(coreApi).replaceNamespacedSecret(any(), eq(NAMESPACE), secretCaptor.capture());
    assertEquals("67890", secretCaptor.getValue().getMetadata().getResourceVersion());

    ArgumentCaptor<V1CronJob> cronJobCaptor = ArgumentCaptor.forClass(V1CronJob.class);
    verify(batchApi).replaceNamespacedCronJob(any(), eq(NAMESPACE), cronJobCaptor.capture());
    assertEquals("11111", cronJobCaptor.getValue().getMetadata().getResourceVersion());
  }

  @Test
  void testSecurityContextIsSetOnJob() throws Exception {
    // Tests P0: Pod security context (non-root, drop capabilities)
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    when(batchApi.createNamespacedJob(eq(NAMESPACE), any())).thenReturn(createJobRequest);
    when(createJobRequest.execute()).thenReturn(new V1Job());

    client.runPipeline(pipeline, testService);

    ArgumentCaptor<V1Job> jobCaptor = ArgumentCaptor.forClass(V1Job.class);
    verify(batchApi).createNamespacedJob(eq(NAMESPACE), jobCaptor.capture());

    V1Job createdJob = jobCaptor.getValue();
    V1PodSpec podSpec = createdJob.getSpec().getTemplate().getSpec();

    // Verify pod security context
    assertNotNull(podSpec.getSecurityContext());
    assertTrue(podSpec.getSecurityContext().getRunAsNonRoot());
    assertEquals(1000L, podSpec.getSecurityContext().getRunAsUser());
    assertEquals(1000L, podSpec.getSecurityContext().getRunAsGroup());
    assertEquals(1000L, podSpec.getSecurityContext().getFsGroup());

    // Verify container security context
    assertNotNull(podSpec.getContainers().get(0).getSecurityContext());
    assertTrue(podSpec.getContainers().get(0).getSecurityContext().getRunAsNonRoot());
    assertFalse(podSpec.getContainers().get(0).getSecurityContext().getAllowPrivilegeEscalation());
    assertNotNull(podSpec.getContainers().get(0).getSecurityContext().getCapabilities());
    assertTrue(
        podSpec
            .getContainers()
            .get(0)
            .getSecurityContext()
            .getCapabilities()
            .getDrop()
            .contains("ALL"));
  }

  @Test
  void testRetryOnTransientFailure() throws Exception {
    // Tests P0: Retry logic with exponential backoff for K8s API calls
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    // First call fails with 503 (retryable), second call succeeds
    when(batchApi.createNamespacedJob(eq(NAMESPACE), any())).thenReturn(createJobRequest);
    when(createJobRequest.execute())
        .thenThrow(new ApiException(503, "Service Unavailable"))
        .thenReturn(new V1Job());

    PipelineServiceClientResponse response = client.runPipeline(pipeline, testService);

    assertEquals(200, response.getCode());
    // Verify the API was called twice (initial + 1 retry)
    verify(batchApi, times(2)).createNamespacedJob(eq(NAMESPACE), any());
  }

  @Test
  void testNoRetryOnNonRetryableError() throws Exception {
    // Tests P0: Retry logic should NOT retry on 4xx errors (except 429)
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    when(batchApi.createNamespacedJob(eq(NAMESPACE), any())).thenReturn(createJobRequest);
    when(createJobRequest.execute()).thenThrow(new ApiException(403, "Forbidden"));

    assertThrows(
        IngestionPipelineDeploymentException.class,
        () -> client.runPipeline(pipeline, testService));

    // Verify the API was only called once (no retry)
    verify(batchApi, times(1)).createNamespacedJob(eq(NAMESPACE), any());
  }

  @Test
  void testDetailedErrorMessageOnFailure() throws Exception {
    // Tests P1: Detailed error messages with hints
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    when(batchApi.createNamespacedJob(eq(NAMESPACE), any())).thenReturn(createJobRequest);
    ApiException apiException = new ApiException(403, "Forbidden");
    when(createJobRequest.execute()).thenThrow(apiException);

    IngestionPipelineDeploymentException exception =
        assertThrows(
            IngestionPipelineDeploymentException.class,
            () -> client.runPipeline(pipeline, testService));

    // Verify error message contains helpful context
    String message = exception.getMessage();
    assertTrue(message.contains("403"), "Should contain HTTP status code");
    assertTrue(
        message.contains("openmetadata-pipelines") || message.contains("namespace"),
        "Should contain namespace context");
  }

  @Test
  void testPodAnnotations() throws Exception {
    // Tests P2: Pod annotations support
    Parameters params = new Parameters();
    params.setAdditionalProperty("namespace", NAMESPACE);
    params.setAdditionalProperty("skipInit", "true");
    params.setAdditionalProperty("ingestionImage", "openmetadata/ingestion:test");
    params.setAdditionalProperty(
        "podAnnotations", "prometheus.io/scrape=true,sidecar.istio.io/inject=false");

    PipelineServiceClientConfiguration config = new PipelineServiceClientConfiguration();
    config.setEnabled(true);
    config.setMetadataApiEndpoint("http://localhost:8585/api");
    config.setParameters(params);

    K8sPipelineClient clientWithAnnotations = new K8sPipelineClient(config);
    clientWithAnnotations.setBatchApi(batchApi);
    clientWithAnnotations.setCoreApi(coreApi);

    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    when(batchApi.createNamespacedJob(eq(NAMESPACE), any())).thenReturn(createJobRequest);
    when(createJobRequest.execute()).thenReturn(new V1Job());

    clientWithAnnotations.runPipeline(pipeline, testService);

    ArgumentCaptor<V1Job> jobCaptor = ArgumentCaptor.forClass(V1Job.class);
    verify(batchApi).createNamespacedJob(eq(NAMESPACE), jobCaptor.capture());

    V1Job createdJob = jobCaptor.getValue();
    Map<String, String> annotations =
        createdJob.getSpec().getTemplate().getMetadata().getAnnotations();

    assertNotNull(annotations, "Should have annotations");
    assertEquals("true", annotations.get("prometheus.io/scrape"));
    assertEquals("false", annotations.get("sidecar.istio.io/inject"));
  }

  @Test
  void testCronScheduleConversion() throws Exception {
    IngestionPipeline hourlyPipeline = createTestPipeline("hourly", "@hourly");
    IngestionPipeline dailyPipeline = createTestPipeline("daily", "@daily");
    IngestionPipeline weeklyPipeline = createTestPipeline("weekly", "@weekly");
    IngestionPipeline monthlyPipeline = createTestPipeline("monthly", "@monthly");
    IngestionPipeline customPipeline = createTestPipeline("custom", "30 2 * * 1-5");

    setupDeploymentMocks();

    ArgumentCaptor<V1CronJob> cronJobCaptor = ArgumentCaptor.forClass(V1CronJob.class);

    client.deployPipeline(hourlyPipeline, testService);
    verify(batchApi, times(1)).createNamespacedCronJob(eq(NAMESPACE), cronJobCaptor.capture());
    assertEquals("0 * * * *", cronJobCaptor.getValue().getSpec().getSchedule());

    resetAllMocks();
    setupDeploymentMocks();
    client.deployPipeline(dailyPipeline, testService);
    verify(batchApi, times(1)).createNamespacedCronJob(eq(NAMESPACE), cronJobCaptor.capture());
    assertEquals("0 0 * * *", cronJobCaptor.getValue().getSpec().getSchedule());

    resetAllMocks();
    setupDeploymentMocks();
    client.deployPipeline(weeklyPipeline, testService);
    verify(batchApi, times(1)).createNamespacedCronJob(eq(NAMESPACE), cronJobCaptor.capture());
    assertEquals("0 0 * * 0", cronJobCaptor.getValue().getSpec().getSchedule());

    resetAllMocks();
    setupDeploymentMocks();
    client.deployPipeline(monthlyPipeline, testService);
    verify(batchApi, times(1)).createNamespacedCronJob(eq(NAMESPACE), cronJobCaptor.capture());
    assertEquals("0 0 1 * *", cronJobCaptor.getValue().getSpec().getSchedule());

    resetAllMocks();
    setupDeploymentMocks();
    client.deployPipeline(customPipeline, testService);
    verify(batchApi, times(1)).createNamespacedCronJob(eq(NAMESPACE), cronJobCaptor.capture());
    assertEquals("30 2 * * 1-5", cronJobCaptor.getValue().getSpec().getSchedule());
  }

  @Test
  void testGetQueuedPipelineStatusReturnsOnlyQueuedJobs() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    V1Job queuedWithRunId =
        new V1Job()
            .metadata(
                new V1ObjectMeta()
                    .name("queued-with-run-id")
                    .labels(Map.of("app.kubernetes.io/run-id", "run-1"))
                    .creationTimestamp(OffsetDateTime.parse("2026-03-09T10:15:30Z")));
    V1Job queuedWithoutRunId =
        new V1Job()
            .metadata(
                new V1ObjectMeta()
                    .name("queued-without-run-id")
                    .creationTimestamp(OffsetDateTime.parse("2026-03-09T10:16:30Z")))
            .status(new V1JobStatus().active(0).succeeded(0).failed(0));
    V1Job activeJob =
        new V1Job()
            .metadata(new V1ObjectMeta().name("active-job"))
            .status(new V1JobStatus().active(1));
    V1Job deletingJob =
        new V1Job()
            .metadata(
                new V1ObjectMeta()
                    .name("deleting-job")
                    .deletionTimestamp(OffsetDateTime.parse("2026-03-09T10:17:30Z")))
            .status(new V1JobStatus().active(0).succeeded(0).failed(0));

    when(batchApi.listNamespacedJob(eq(NAMESPACE))).thenReturn(listJobRequest);
    when(listJobRequest.labelSelector(eq("app.kubernetes.io/pipeline=test-pipeline")))
        .thenReturn(listJobRequest);
    when(listJobRequest.execute())
        .thenReturn(
            new V1JobList()
                .items(List.of(queuedWithRunId, queuedWithoutRunId, activeJob, deletingJob)));

    List<PipelineStatus> queuedStatuses = client.getQueuedPipelineStatus(pipeline);

    assertEquals(2, queuedStatuses.size());
    assertEquals("run-1", queuedStatuses.get(0).getRunId());
    assertEquals(PipelineStatusType.QUEUED, queuedStatuses.get(0).getPipelineState());
    assertEquals("queued-without-run-id", queuedStatuses.get(1).getRunId());
    assertEquals(
        queuedWithRunId.getMetadata().getCreationTimestamp().toInstant().toEpochMilli(),
        queuedStatuses.get(0).getStartDate());
  }

  @Test
  void testGetQueuedPipelineStatusHandlesApiFailure() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    when(batchApi.listNamespacedJob(eq(NAMESPACE))).thenReturn(listJobRequest);
    when(listJobRequest.labelSelector(eq("app.kubernetes.io/pipeline=test-pipeline")))
        .thenReturn(listJobRequest);
    when(listJobRequest.execute()).thenThrow(new ApiException(500, "boom"));

    assertTrue(client.getQueuedPipelineStatus(pipeline).isEmpty());
  }

  @Test
  void testGetLastIngestionLogsPrefersMainPodAndReturnsTaskLogs() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    V1Pod newerSidecarPod =
        pod(
            "newer-sidecar",
            OffsetDateTime.parse("2026-03-09T10:20:30Z"),
            Map.of(),
            List.of("worker"));
    V1Pod olderMainPod =
        pod(
            "older-main",
            OffsetDateTime.parse("2026-03-09T10:19:30Z"),
            Map.of("omjob.pipelines.openmetadata.org/pod-type", "main"),
            List.of("main", "sidecar"));

    when(coreApi.listNamespacedPod(eq(NAMESPACE))).thenReturn(listPodRequest);
    when(listPodRequest.labelSelector(eq("app.kubernetes.io/pipeline=test-pipeline")))
        .thenReturn(listPodRequest);
    when(listPodRequest.execute())
        .thenReturn(new V1PodList().items(List.of(newerSidecarPod, olderMainPod)));
    when(coreApi.readNamespacedPodLog(eq("older-main"), eq(NAMESPACE)))
        .thenReturn(readPodLogRequest);
    when(readPodLogRequest.container(eq("main"))).thenReturn(readPodLogRequest);
    when(readPodLogRequest.execute()).thenReturn("hello from ingestion");

    Map<String, String> logs = client.getLastIngestionLogs(pipeline, null);

    assertEquals("hello from ingestion", logs.get("ingestion_task"));
    assertEquals("1", logs.get("total"));
  }

  @Test
  void testGetLastIngestionLogsHandlesEmptyLogsAndApiFailures() throws Exception {
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);
    V1Pod workerPod =
        pod(
            "worker-pod",
            OffsetDateTime.parse("2026-03-09T10:20:30Z"),
            Map.of(),
            List.of("worker"));

    when(coreApi.listNamespacedPod(eq(NAMESPACE))).thenReturn(listPodRequest);
    when(listPodRequest.labelSelector(eq("app.kubernetes.io/pipeline=test-pipeline")))
        .thenReturn(listPodRequest);
    when(listPodRequest.execute()).thenReturn(new V1PodList().items(List.of(workerPod)));
    when(coreApi.readNamespacedPodLog(eq("worker-pod"), eq(NAMESPACE)))
        .thenReturn(readPodLogRequest);
    when(readPodLogRequest.container(eq("worker"))).thenReturn(readPodLogRequest);
    when(readPodLogRequest.execute()).thenReturn("");

    Map<String, String> emptyLogs = client.getLastIngestionLogs(pipeline, null);
    assertEquals("No logs available for pod: worker-pod", emptyLogs.get("logs"));

    reset(listPodRequest);
    when(coreApi.listNamespacedPod(eq(NAMESPACE))).thenReturn(listPodRequest);
    when(listPodRequest.labelSelector(eq("app.kubernetes.io/pipeline=test-pipeline")))
        .thenReturn(listPodRequest);
    when(listPodRequest.execute()).thenThrow(new ApiException(500, "pod lookup failed"));

    Map<String, String> failureLogs = client.getLastIngestionLogs(pipeline, null);
    assertTrue(failureLogs.get("logs").contains("Failed to retrieve logs"));
  }

  @Test
  void testGetServiceStatusHealthyWhenPermissionsAreAvailable() throws Exception {
    when(coreApi.listNamespacedPod(eq(NAMESPACE))).thenReturn(listPodRequest);
    when(listPodRequest.limit(1)).thenReturn(listPodRequest);
    when(listPodRequest.execute()).thenReturn(new V1PodList());

    when(batchApi.listNamespacedJob(eq(NAMESPACE))).thenReturn(listJobRequest);
    when(listJobRequest.limit(1)).thenReturn(listJobRequest);
    when(listJobRequest.execute()).thenReturn(new V1JobList());

    when(coreApi.listNamespacedConfigMap(eq(NAMESPACE))).thenReturn(listConfigMapRequest);
    when(listConfigMapRequest.limit(1)).thenReturn(listConfigMapRequest);
    when(listConfigMapRequest.execute()).thenReturn(null);

    when(coreApi.listNamespacedSecret(eq(NAMESPACE))).thenReturn(listSecretRequest);
    when(listSecretRequest.limit(1)).thenReturn(listSecretRequest);
    when(listSecretRequest.execute()).thenReturn(null);

    PipelineServiceClientResponse response = client.getServiceStatus();

    assertEquals(200, response.getCode());
    assertEquals("kubernetes", response.getVersion());
    assertEquals("Kubernetes", response.getPlatform());
    assertTrue(response.getReason().contains("openmetadata-pipelines"));
  }

  @Test
  void testGetServiceStatusSurfacesMissingConfigMapAndSecretPermissions() throws Exception {
    when(coreApi.listNamespacedPod(eq(NAMESPACE))).thenReturn(listPodRequest);
    when(listPodRequest.limit(1)).thenReturn(listPodRequest);
    when(listPodRequest.execute()).thenReturn(new V1PodList());

    when(batchApi.listNamespacedJob(eq(NAMESPACE))).thenReturn(listJobRequest);
    when(listJobRequest.limit(1)).thenReturn(listJobRequest);
    when(listJobRequest.execute()).thenReturn(new V1JobList());

    when(coreApi.listNamespacedConfigMap(eq(NAMESPACE))).thenReturn(listConfigMapRequest);
    when(listConfigMapRequest.limit(1)).thenReturn(listConfigMapRequest);
    when(listConfigMapRequest.execute()).thenThrow(new ApiException(403, "forbidden configmaps"));

    PipelineServiceClientResponse configMapFailure = client.getServiceStatus();
    assertEquals(500, configMapFailure.getCode());
    assertTrue(configMapFailure.getReason().contains("missing ConfigMap permissions"));

    reset(listConfigMapRequest);
    when(coreApi.listNamespacedConfigMap(eq(NAMESPACE))).thenReturn(listConfigMapRequest);
    when(listConfigMapRequest.limit(1)).thenReturn(listConfigMapRequest);
    when(listConfigMapRequest.execute()).thenReturn(null);

    when(coreApi.listNamespacedSecret(eq(NAMESPACE))).thenReturn(listSecretRequest);
    when(listSecretRequest.limit(1)).thenReturn(listSecretRequest);
    when(listSecretRequest.execute()).thenThrow(new ApiException(403, "forbidden secrets"));

    PipelineServiceClientResponse secretFailure = client.getServiceStatus();
    assertEquals(500, secretFailure.getCode());
    assertTrue(secretFailure.getReason().contains("missing Secret permissions"));
  }

  @Test
  void testRunAutomationAndApplicationFlowsCreateJobs() throws Exception {
    Workflow workflow = createTestWorkflow("Nightly Cleanup");

    when(batchApi.createNamespacedJob(eq(NAMESPACE), any())).thenReturn(createJobRequest);
    when(createJobRequest.execute()).thenReturn(new V1Job());

    PipelineServiceClientResponse workflowResponse = client.runAutomationsWorkflow(workflow);

    assertEquals(200, workflowResponse.getCode());
    ArgumentCaptor<V1Job> workflowJobCaptor = ArgumentCaptor.forClass(V1Job.class);
    verify(batchApi).createNamespacedJob(eq(NAMESPACE), workflowJobCaptor.capture());
    assertEquals(
        List.of("python", "run_automation.py"),
        workflowJobCaptor
            .getValue()
            .getSpec()
            .getTemplate()
            .getSpec()
            .getContainers()
            .get(0)
            .getCommand());

    reset(batchApi, createJobRequest);
    when(batchApi.createNamespacedJob(eq(NAMESPACE), any())).thenReturn(createJobRequest);
    when(createJobRequest.execute()).thenReturn(new V1Job());

    App application = createTestApplication("Query Runner");
    PipelineServiceClientResponse applicationResponse = client.runApplicationFlow(application);

    assertEquals(200, applicationResponse.getCode());
    ArgumentCaptor<V1Job> applicationJobCaptor = ArgumentCaptor.forClass(V1Job.class);
    verify(batchApi).createNamespacedJob(eq(NAMESPACE), applicationJobCaptor.capture());
    V1Job applicationJob = applicationJobCaptor.getValue();
    assertEquals(
        List.of("python", "-m", "metadata.applications.runner"),
        applicationJob.getSpec().getTemplate().getSpec().getContainers().get(0).getCommand());
    assertEquals(
        "query-runner", applicationJob.getMetadata().getLabels().get("app.kubernetes.io/app-name"));
  }

  @Test
  void testRunAutomationAndApplicationFlowsSurfaceApiFailures() throws Exception {
    when(batchApi.createNamespacedJob(eq(NAMESPACE), any())).thenReturn(createJobRequest);
    when(createJobRequest.execute()).thenThrow(new ApiException(500, "job create failed"));

    assertThrows(
        IngestionPipelineDeploymentException.class,
        () -> client.runAutomationsWorkflow(createTestWorkflow("Nightly Cleanup")));

    reset(batchApi, createJobRequest);
    when(batchApi.createNamespacedJob(eq(NAMESPACE), any())).thenReturn(createJobRequest);
    when(createJobRequest.execute()).thenThrow(new ApiException(500, "job create failed"));

    assertThrows(
        IngestionPipelineDeploymentException.class,
        () -> client.runApplicationFlow(createTestApplication("Query Runner")));
  }

  @Test
  void testDeployPipelineWithOMJobOperatorCreatesCronOMJob() throws Exception {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");

    when(coreApi.readNamespacedConfigMap(any(), eq(NAMESPACE))).thenReturn(readConfigMapRequest);
    when(readConfigMapRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.createNamespacedConfigMap(eq(NAMESPACE), any()))
        .thenReturn(createConfigMapRequest);
    when(createConfigMapRequest.execute()).thenReturn(new V1ConfigMap());

    when(coreApi.readNamespacedSecret(any(), eq(NAMESPACE))).thenReturn(readSecretRequest);
    when(readSecretRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.createNamespacedSecret(eq(NAMESPACE), any())).thenReturn(createSecretRequest);
    when(createSecretRequest.execute()).thenReturn(new V1Secret());

    when(customObjectsApi.getNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("cronomjobs"),
            eq("om-cronomjob-test-pipeline")))
        .thenReturn(getCustomObjectRequest);
    when(getCustomObjectRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(customObjectsApi.createNamespacedCustomObject(
            eq("pipelines.openmetadata.org"), eq("v1"), eq(NAMESPACE), eq("cronomjobs"), any()))
        .thenReturn(createCustomObjectRequest);
    when(createCustomObjectRequest.execute()).thenReturn(Map.of("status", "created"));

    PipelineServiceClientResponse response = clientWithOMJob.deployPipeline(pipeline, testService);

    assertEquals(200, response.getCode());
    assertEquals(Boolean.TRUE, pipeline.getDeployed());
    ArgumentCaptor<Object> cronOMJobCaptor = ArgumentCaptor.forClass(Object.class);
    verify(customObjectsApi)
        .createNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("cronomjobs"),
            cronOMJobCaptor.capture());

    @SuppressWarnings("unchecked")
    Map<String, Object> cronOMJob = (Map<String, Object>) cronOMJobCaptor.getValue();
    @SuppressWarnings("unchecked")
    Map<String, Object> metadata = (Map<String, Object>) cronOMJob.get("metadata");
    assertEquals("om-cronomjob-test-pipeline", metadata.get("name"));
  }

  @Test
  void testDeployPipelineWithOMJobOperatorPreservesResourceVersionOnUpdate() throws Exception {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");

    V1ConfigMap existingConfigMap =
        new V1ConfigMap()
            .metadata(new V1ObjectMeta().name("om-config-test-pipeline").resourceVersion("12345"));
    when(coreApi.readNamespacedConfigMap(any(), eq(NAMESPACE))).thenReturn(readConfigMapRequest);
    when(readConfigMapRequest.execute()).thenReturn(existingConfigMap);
    when(coreApi.replaceNamespacedConfigMap(any(), eq(NAMESPACE), any()))
        .thenReturn(replaceConfigMapRequest);
    when(replaceConfigMapRequest.execute()).thenReturn(new V1ConfigMap());

    V1Secret existingSecret =
        new V1Secret()
            .metadata(new V1ObjectMeta().name("om-secret-test-pipeline").resourceVersion("67890"));
    when(coreApi.readNamespacedSecret(any(), eq(NAMESPACE))).thenReturn(readSecretRequest);
    when(readSecretRequest.execute()).thenReturn(existingSecret);
    when(coreApi.replaceNamespacedSecret(any(), eq(NAMESPACE), any()))
        .thenReturn(replaceSecretRequest);
    when(replaceSecretRequest.execute()).thenReturn(new V1Secret());

    when(customObjectsApi.getNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("cronomjobs"),
            eq("om-cronomjob-test-pipeline")))
        .thenReturn(getCustomObjectRequest);
    when(getCustomObjectRequest.execute())
        .thenReturn(Map.of("metadata", Map.of("resourceVersion", "99999")));
    when(customObjectsApi.replaceNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("cronomjobs"),
            eq("om-cronomjob-test-pipeline"),
            any()))
        .thenReturn(replaceCustomObjectRequest);
    when(replaceCustomObjectRequest.execute()).thenReturn(Map.of("status", "updated"));

    PipelineServiceClientResponse response = clientWithOMJob.deployPipeline(pipeline, testService);

    assertEquals(200, response.getCode());
    ArgumentCaptor<Object> cronOMJobCaptor = ArgumentCaptor.forClass(Object.class);
    verify(customObjectsApi)
        .replaceNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("cronomjobs"),
            eq("om-cronomjob-test-pipeline"),
            cronOMJobCaptor.capture());

    @SuppressWarnings("unchecked")
    Map<String, Object> cronOMJob = (Map<String, Object>) cronOMJobCaptor.getValue();
    @SuppressWarnings("unchecked")
    Map<String, Object> metadata = (Map<String, Object>) cronOMJob.get("metadata");
    assertEquals("99999", metadata.get("resourceVersion"));
  }

  @Test
  void testRunPipelineWithOMJobOperatorCreatesMainAndExitPods() throws Exception {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    when(customObjectsApi.createNamespacedCustomObject(
            eq("pipelines.openmetadata.org"), eq("v1"), eq(NAMESPACE), eq("omjobs"), any()))
        .thenReturn(createCustomObjectRequest);
    when(createCustomObjectRequest.execute()).thenReturn(Map.of("status", "created"));

    PipelineServiceClientResponse response = clientWithOMJob.runPipeline(pipeline, testService);

    assertEquals(200, response.getCode());
    ArgumentCaptor<Object> omJobCaptor = ArgumentCaptor.forClass(Object.class);
    verify(customObjectsApi)
        .createNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("omjobs"),
            omJobCaptor.capture());

    @SuppressWarnings("unchecked")
    Map<String, Object> omJob = (Map<String, Object>) omJobCaptor.getValue();
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) omJob.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpec = (Map<String, Object>) spec.get("mainPodSpec");
    @SuppressWarnings("unchecked")
    Map<String, Object> exitHandlerSpec = (Map<String, Object>) spec.get("exitHandlerSpec");
    assertEquals(List.of("python", "main.py"), mainPodSpec.get("command"));
    assertEquals(List.of("python", "exit_handler.py"), exitHandlerSpec.get("command"));
  }

  @Test
  void testRunApplicationFlowWithOMJobOperatorCreatesApplicationPods() throws Exception {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    App application = createTestApplication("Query Runner");

    when(customObjectsApi.createNamespacedCustomObject(
            eq("pipelines.openmetadata.org"), eq("v1"), eq(NAMESPACE), eq("omjobs"), any()))
        .thenReturn(createCustomObjectRequest);
    when(createCustomObjectRequest.execute()).thenReturn(Map.of("status", "created"));

    PipelineServiceClientResponse response = clientWithOMJob.runApplicationFlow(application);

    assertEquals(200, response.getCode());
    ArgumentCaptor<Object> omJobCaptor = ArgumentCaptor.forClass(Object.class);
    verify(customObjectsApi)
        .createNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("omjobs"),
            omJobCaptor.capture());

    @SuppressWarnings("unchecked")
    Map<String, Object> omJob = (Map<String, Object>) omJobCaptor.getValue();
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) omJob.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpec = (Map<String, Object>) spec.get("mainPodSpec");
    @SuppressWarnings("unchecked")
    Map<String, Object> exitHandlerSpec = (Map<String, Object>) spec.get("exitHandlerSpec");
    assertEquals(
        List.of("python", "-m", "metadata.applications.runner"), mainPodSpec.get("command"));
    assertEquals(List.of("sh", "-c", "exit 0"), exitHandlerSpec.get("command"));
  }

  @Test
  void testToggleIngestionWithOMJobOperatorUpdatesSuspendFlagWithoutMutatingSource()
      throws Exception {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");
    pipeline.setEnabled(true);

    Map<String, Object> originalSpec = Map.of("suspend", false);
    Map<String, Object> originalCronOMJob =
        Map.of("metadata", Map.of("name", "omjob"), "spec", originalSpec);

    when(customObjectsApi.getNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("cronomjobs"),
            eq("om-cronomjob-test-pipeline")))
        .thenReturn(getCustomObjectRequest);
    when(getCustomObjectRequest.execute()).thenReturn(originalCronOMJob);
    when(customObjectsApi.replaceNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("cronomjobs"),
            eq("om-cronomjob-test-pipeline"),
            any()))
        .thenReturn(replaceCustomObjectRequest);
    when(replaceCustomObjectRequest.execute()).thenReturn(Map.of("status", "updated"));

    PipelineServiceClientResponse response = clientWithOMJob.toggleIngestion(pipeline);

    assertEquals(200, response.getCode());
    assertNotEquals(Boolean.TRUE, pipeline.getEnabled());
    assertEquals(false, originalSpec.get("suspend"));

    ArgumentCaptor<Object> cronOMJobCaptor = ArgumentCaptor.forClass(Object.class);
    verify(customObjectsApi)
        .replaceNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("cronomjobs"),
            eq("om-cronomjob-test-pipeline"),
            cronOMJobCaptor.capture());

    @SuppressWarnings("unchecked")
    Map<String, Object> replacedCronOMJob = (Map<String, Object>) cronOMJobCaptor.getValue();
    @SuppressWarnings("unchecked")
    Map<String, Object> replacedSpec = (Map<String, Object>) replacedCronOMJob.get("spec");
    assertEquals(true, replacedSpec.get("suspend"));
  }

  @Test
  void testKillIngestionWithOMJobOperatorDeletesValidCustomObjectsOnly() throws Exception {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", null);

    when(customObjectsApi.listNamespacedCustomObject(
            eq("pipelines.openmetadata.org"), eq("v1"), eq(NAMESPACE), eq("omjobs")))
        .thenReturn(listCustomObjectsRequest);
    when(listCustomObjectsRequest.labelSelector(eq("app.kubernetes.io/pipeline=test-pipeline")))
        .thenReturn(listCustomObjectsRequest);
    when(listCustomObjectsRequest.execute())
        .thenReturn(
            Map.of(
                "items",
                List.of(
                    Map.of(),
                    Map.of("metadata", Map.of()),
                    Map.of("metadata", Map.of("name", "om-job-test-pipeline-1")))));
    when(customObjectsApi.deleteNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("omjobs"),
            eq("om-job-test-pipeline-1")))
        .thenReturn(deleteCustomObjectRequest);
    when(deleteCustomObjectRequest.execute()).thenReturn(Map.of("status", "deleted"));

    PipelineServiceClientResponse response = clientWithOMJob.killIngestion(pipeline);

    assertEquals(200, response.getCode());
    assertTrue(response.getReason().contains("1 running job"));
    verify(customObjectsApi)
        .deleteNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("omjobs"),
            eq("om-job-test-pipeline-1"));
  }

  @Test
  void testGetIngestionBotTokenReturnsJwtFromBotUserAuthentication() throws Exception {
    BotRepository botRepository = org.mockito.Mockito.mock(BotRepository.class);
    UserRepository userRepository = org.mockito.Mockito.mock(UserRepository.class);
    Bot bot = new Bot();
    bot.setBotUser(new EntityReference().withFullyQualifiedName("ingestion-bot"));

    org.openmetadata.schema.entity.teams.User botUser =
        new org.openmetadata.schema.entity.teams.User();
    AuthenticationMechanism authenticationMechanism = new AuthenticationMechanism();
    authenticationMechanism.setAuthType(AuthenticationMechanism.AuthType.JWT);
    authenticationMechanism.setConfig(new JWTAuthMechanism().withJWTToken("ingestion-token"));
    botUser.setAuthenticationMechanism(authenticationMechanism);

    try (MockedStatic<Entity> entity = org.mockito.Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      when(botRepository.getByName(
              eq(null), eq(Entity.INGESTION_BOT_NAME), any(EntityUtil.Fields.class)))
          .thenReturn(bot);
      when(userRepository.getByName(eq(null), eq("ingestion-bot"), any(EntityUtil.Fields.class)))
          .thenReturn(botUser);

      String token = invokePrivate(client, "getIngestionBotToken", new Class<?>[0]);

      assertEquals("ingestion-token", token);
    }
  }

  @Test
  void testGetIngestionBotTokenReturnsNullWhenBotUserUsesNonJwtAuth() throws Exception {
    BotRepository botRepository = org.mockito.Mockito.mock(BotRepository.class);
    UserRepository userRepository = org.mockito.Mockito.mock(UserRepository.class);
    Bot bot = new Bot();
    bot.setBotUser(new EntityReference().withFullyQualifiedName("ingestion-bot"));

    org.openmetadata.schema.entity.teams.User botUser =
        new org.openmetadata.schema.entity.teams.User();
    AuthenticationMechanism authenticationMechanism = new AuthenticationMechanism();
    authenticationMechanism.setAuthType(AuthenticationMechanism.AuthType.BASIC);
    botUser.setAuthenticationMechanism(authenticationMechanism);

    try (MockedStatic<Entity> entity = org.mockito.Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      when(botRepository.getByName(
              eq(null), eq(Entity.INGESTION_BOT_NAME), any(EntityUtil.Fields.class)))
          .thenReturn(bot);
      when(userRepository.getByName(eq(null), eq("ingestion-bot"), any(EntityUtil.Fields.class)))
          .thenReturn(botUser);

      String token = invokePrivate(client, "getIngestionBotToken", new Class<?>[0]);

      assertNull(token);
    }
  }

  @Test
  void testGetIngestionBotTokenReturnsNullWhenBotEntityIsMissing() throws Exception {
    BotRepository botRepository = org.mockito.Mockito.mock(BotRepository.class);
    UserRepository userRepository = org.mockito.Mockito.mock(UserRepository.class);

    try (MockedStatic<Entity> entity = org.mockito.Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      when(botRepository.getByName(
              eq(null), eq(Entity.INGESTION_BOT_NAME), any(EntityUtil.Fields.class)))
          .thenReturn(null);

      String token = invokePrivate(client, "getIngestionBotToken", new Class<?>[0]);

      assertNull(token);
    }
  }

  @Test
  void testCreateDefaultServerConnectionUsesBotJwtToken() throws Exception {
    BotRepository botRepository = org.mockito.Mockito.mock(BotRepository.class);
    UserRepository userRepository = org.mockito.Mockito.mock(UserRepository.class);
    Bot bot = new Bot();
    bot.setBotUser(new EntityReference().withFullyQualifiedName("ingestion-bot"));

    org.openmetadata.schema.entity.teams.User botUser =
        new org.openmetadata.schema.entity.teams.User();
    AuthenticationMechanism authenticationMechanism = new AuthenticationMechanism();
    authenticationMechanism.setAuthType(AuthenticationMechanism.AuthType.JWT);
    authenticationMechanism.setConfig(new JWTAuthMechanism().withJWTToken("ingestion-token"));
    botUser.setAuthenticationMechanism(authenticationMechanism);

    try (MockedStatic<Entity> entity = org.mockito.Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.BOT)).thenReturn(botRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.USER)).thenReturn(userRepository);
      when(botRepository.getByName(
              eq(null), eq(Entity.INGESTION_BOT_NAME), any(EntityUtil.Fields.class)))
          .thenReturn(bot);
      when(userRepository.getByName(eq(null), eq("ingestion-bot"), any(EntityUtil.Fields.class)))
          .thenReturn(botUser);

      OpenMetadataConnection connection =
          invokePrivate(client, "createDefaultServerConnection", new Class<?>[0]);

      assertEquals("http://localhost:8585/api", connection.getHostPort());
      assertEquals(AuthProvider.OPENMETADATA, connection.getAuthProvider());
      assertEquals("ingestion-token", connection.getSecurityConfig().getJwtToken());
    }
  }

  @Test
  void testValidateNamespaceExistsAllowsAccessibleNamespace() {
    when(coreApi.readNamespace(eq(NAMESPACE))).thenReturn(readNamespaceRequest);

    assertDoesNotThrow(() -> invokePrivate(client, "validateNamespaceExists", new Class<?>[0]));
  }

  @Test
  void testValidateNamespaceExistsFailsFastForMissingNamespace() throws Exception {
    when(coreApi.readNamespace(eq(NAMESPACE))).thenReturn(readNamespaceRequest);
    when(readNamespaceRequest.execute()).thenThrow(new ApiException(404, "Not found"));

    Exception exception =
        assertThrows(
            Exception.class,
            () -> invokePrivate(client, "validateNamespaceExists", new Class<?>[0]));

    assertTrue(exception.getMessage().contains(NAMESPACE));
  }

  @Test
  void testValidateNamespaceExistsIgnoresUnreadableNamespaceChecks() throws Exception {
    when(coreApi.readNamespace(eq(NAMESPACE))).thenReturn(readNamespaceRequest);
    when(readNamespaceRequest.execute()).thenThrow(new ApiException(403, "Forbidden"));

    assertDoesNotThrow(() -> invokePrivate(client, "validateNamespaceExists", new Class<?>[0]));
  }

  @Test
  void testBuildDetailedErrorMessageExtractsK8sMessageAndHint() throws Exception {
    ApiException exception =
        new ApiException(
            403,
            "Forbidden",
            Map.of(),
            "{\"kind\":\"Status\",\"message\":\"rbac denied for deployment\"}");

    String detailedMessage =
        invokePrivate(
            client,
            "buildDetailedErrorMessage",
            new Class<?>[] {String.class, String.class, ApiException.class},
            "deploy",
            "test-pipeline",
            exception);

    assertTrue(detailedMessage.contains("rbac denied for deployment"));
    assertTrue(detailedMessage.contains("lacks permissions"));
    assertTrue(detailedMessage.contains(NAMESPACE));
  }

  @Test
  void testBuildDetailedErrorMessageFallsBackToExceptionMessageWhenBodyMissing() throws Exception {
    ApiException exception = new ApiException(500, "Internal Server Error");

    String detailedMessage =
        invokePrivate(
            client,
            "buildDetailedErrorMessage",
            new Class<?>[] {String.class, String.class, ApiException.class},
            "deploy",
            "test-pipeline",
            exception);

    assertTrue(detailedMessage.contains("Internal Server Error"));
    assertFalse(detailedMessage.contains("lacks permissions"));
  }

  @Test
  void testDeleteResourceHelpersIgnoreNotFoundErrors() throws Exception {
    when(batchApi.deleteNamespacedCronJob(eq("missing-cron"), eq(NAMESPACE)))
        .thenReturn(deleteCronJobRequest);
    when(deleteCronJobRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(customObjectsApi.deleteNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("cronomjobs"),
            eq("missing-cron-omjob")))
        .thenReturn(deleteCustomObjectRequest);
    when(deleteCustomObjectRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.deleteNamespacedSecret(eq("missing-secret"), eq(NAMESPACE)))
        .thenReturn(deleteSecretRequest);
    when(deleteSecretRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.deleteNamespacedConfigMap(eq("missing-config"), eq(NAMESPACE)))
        .thenReturn(deleteConfigMapRequest);
    when(deleteConfigMapRequest.execute()).thenThrow(new ApiException(404, "Not found"));

    assertDoesNotThrow(
        () ->
            invokePrivate(
                client, "deleteCronJobIfExists", new Class<?>[] {String.class}, "missing-cron"));
    assertDoesNotThrow(
        () ->
            invokePrivate(
                client,
                "deleteCronOMJobIfExists",
                new Class<?>[] {String.class},
                "missing-cron-omjob"));
    assertDoesNotThrow(
        () ->
            invokePrivate(
                client, "deleteSecretIfExists", new Class<?>[] {String.class}, "missing-secret"));
    assertDoesNotThrow(
        () ->
            invokePrivate(
                client,
                "deleteConfigMapIfExists",
                new Class<?>[] {String.class},
                "missing-config"));
  }

  @Test
  void testDeleteResourceHelpersRethrowUnexpectedErrors() throws Exception {
    when(batchApi.deleteNamespacedCronJob(eq("failing-cron"), eq(NAMESPACE)))
        .thenReturn(deleteCronJobRequest);
    when(deleteCronJobRequest.execute()).thenThrow(new ApiException(500, "cron failure"));
    when(customObjectsApi.deleteNamespacedCustomObject(
            eq("pipelines.openmetadata.org"),
            eq("v1"),
            eq(NAMESPACE),
            eq("cronomjobs"),
            eq("failing-cron-omjob")))
        .thenReturn(deleteCustomObjectRequest);
    when(deleteCustomObjectRequest.execute()).thenThrow(new ApiException(500, "omjob failure"));
    when(coreApi.deleteNamespacedSecret(eq("failing-secret"), eq(NAMESPACE)))
        .thenReturn(deleteSecretRequest);
    when(deleteSecretRequest.execute()).thenThrow(new ApiException(500, "secret failure"));
    when(coreApi.deleteNamespacedConfigMap(eq("failing-config"), eq(NAMESPACE)))
        .thenReturn(deleteConfigMapRequest);
    when(deleteConfigMapRequest.execute()).thenThrow(new ApiException(500, "config failure"));

    assertThrows(
        ApiException.class,
        () ->
            invokePrivate(
                client, "deleteCronJobIfExists", new Class<?>[] {String.class}, "failing-cron"));
    assertThrows(
        ApiException.class,
        () ->
            invokePrivate(
                client,
                "deleteCronOMJobIfExists",
                new Class<?>[] {String.class},
                "failing-cron-omjob"));
    assertThrows(
        ApiException.class,
        () ->
            invokePrivate(
                client, "deleteSecretIfExists", new Class<?>[] {String.class}, "failing-secret"));
    assertThrows(
        ApiException.class,
        () ->
            invokePrivate(
                client,
                "deleteConfigMapIfExists",
                new Class<?>[] {String.class},
                "failing-config"));
  }

  private void resetAllMocks() {
    reset(
        batchApi,
        coreApi,
        customObjectsApi,
        readConfigMapRequest,
        createConfigMapRequest,
        readSecretRequest,
        createSecretRequest,
        readCronJobRequest,
        createCronJobRequest,
        getCustomObjectRequest,
        createCustomObjectRequest,
        replaceCustomObjectRequest,
        listCustomObjectsRequest,
        deleteCustomObjectRequest);
  }

  private void setupDeploymentMocks() throws ApiException {
    when(coreApi.readNamespacedConfigMap(any(), eq(NAMESPACE))).thenReturn(readConfigMapRequest);
    when(readConfigMapRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.createNamespacedConfigMap(eq(NAMESPACE), any()))
        .thenReturn(createConfigMapRequest);
    when(createConfigMapRequest.execute()).thenReturn(new V1ConfigMap());

    when(coreApi.readNamespacedSecret(any(), eq(NAMESPACE))).thenReturn(readSecretRequest);
    when(readSecretRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(coreApi.createNamespacedSecret(eq(NAMESPACE), any())).thenReturn(createSecretRequest);
    when(createSecretRequest.execute()).thenReturn(new V1Secret());

    when(batchApi.readNamespacedCronJob(any(), eq(NAMESPACE))).thenReturn(readCronJobRequest);
    when(readCronJobRequest.execute()).thenThrow(new ApiException(404, "Not found"));
    when(batchApi.createNamespacedCronJob(eq(NAMESPACE), any())).thenReturn(createCronJobRequest);
    when(createCronJobRequest.execute()).thenReturn(new V1CronJob());
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

    // Add dummy OpenMetadata server connection for unit tests
    OpenMetadataConnection serverConnection = new OpenMetadataConnection();
    serverConnection.setHostPort("http://localhost:8585");
    serverConnection.setAuthProvider(AuthProvider.OPENMETADATA);

    OpenMetadataJWTClientConfig jwtConfig = new OpenMetadataJWTClientConfig();
    jwtConfig.setJwtToken("test-jwt-token");
    serverConnection.setSecurityConfig(jwtConfig);

    pipeline.setOpenMetadataServerConnection(serverConnection);

    return pipeline;
  }

  private K8sPipelineClient createClientWithExtraEnvVars() {
    Parameters params = new Parameters();
    params.setAdditionalProperty("namespace", NAMESPACE);
    params.setAdditionalProperty("inCluster", "false");
    params.setAdditionalProperty("skipInit", "true");
    params.setAdditionalProperty("ingestionImage", "openmetadata/ingestion:test");
    params.setAdditionalProperty("serviceAccountName", "test-sa");
    params.setAdditionalProperty("extraEnvVars", List.of("FOO:bar", "BAZ:qux"));

    PipelineServiceClientConfiguration config = new PipelineServiceClientConfiguration();
    config.setEnabled(true);
    config.setMetadataApiEndpoint("http://localhost:8585/api");
    config.setParameters(params);

    K8sPipelineClient clientWithExtraEnvs = new K8sPipelineClient(config);
    clientWithExtraEnvs.setBatchApi(batchApi);
    clientWithExtraEnvs.setCoreApi(coreApi);
    return clientWithExtraEnvs;
  }

  private K8sPipelineClient createClientWithUseOMJobOperator(boolean enabled) {
    Parameters params = new Parameters();
    params.setAdditionalProperty("namespace", NAMESPACE);
    params.setAdditionalProperty("inCluster", "false");
    params.setAdditionalProperty("skipInit", "true");
    params.setAdditionalProperty("ingestionImage", "openmetadata/ingestion:test");
    params.setAdditionalProperty("serviceAccountName", "test-sa");
    params.setAdditionalProperty("useOMJobOperator", Boolean.toString(enabled));

    PipelineServiceClientConfiguration config = new PipelineServiceClientConfiguration();
    config.setEnabled(true);
    config.setMetadataApiEndpoint("http://localhost:8585/api");
    config.setParameters(params);

    K8sPipelineClient clientWithOMJob = new K8sPipelineClient(config);
    clientWithOMJob.setBatchApi(batchApi);
    clientWithOMJob.setCoreApi(coreApi);
    setField(clientWithOMJob, "customObjectsApi", customObjectsApi);
    return clientWithOMJob;
  }

  @Test
  void testSanitizeName_RemovesTrailingHyphensAfterTruncation() {
    // Test case 1: Name that becomes 53 chars and ends with hyphen after truncation
    String longNameWithHyphen = "update-logger-level-for-test-pipeline-with-very-long-name-suffix-";
    String sanitized = client.sanitizeName(longNameWithHyphen);

    // Should be truncated to 53 chars and NOT end with hyphen
    assertTrue(sanitized.length() <= 53, "Sanitized name should be <= 53 chars");
    assertFalse(sanitized.endsWith("-"), "Sanitized name should not end with hyphen");
    assertTrue(
        sanitized.matches("^[a-z0-9][a-z0-9-]*[a-z0-9]$"),
        "Sanitized name should match K8s DNS-1123 format");
  }

  @Test
  void testSanitizeName_HandlesShortNames() {
    String shortName = "test-pipeline";
    String sanitized = client.sanitizeName(shortName);

    assertEquals("test-pipeline", sanitized, "Short names should not be modified");
  }

  @Test
  void testSanitizeName_HandlesSpecialCharacters() {
    String nameWithSpecialChars = "test_pipeline.config@2024";
    String sanitized = client.sanitizeName(nameWithSpecialChars);

    assertEquals("test-pipeline-config-2024", sanitized, "Special chars should be replaced");
    assertFalse(sanitized.endsWith("-"), "Should not end with hyphen");
  }

  @Test
  void testSanitizeName_HandlesUppercase() {
    String uppercaseName = "TEST-PIPELINE-NAME";
    String sanitized = client.sanitizeName(uppercaseName);

    assertEquals("test-pipeline-name", sanitized, "Should be converted to lowercase");
  }

  @Test
  void testSanitizeName_EnsuresMaxLength() {
    // Create a name longer than 53 chars that ends with alphanumeric
    String veryLongName = "a".repeat(60);
    String sanitized = client.sanitizeName(veryLongName);

    assertTrue(sanitized.length() <= 53, "Should truncate to max 53 chars");
    assertEquals(53, sanitized.length(), "Should use full 53 chars when possible");
  }

  @Test
  void testSanitizeName_WithPrefixFitsK8sLimit() {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    String longName = "a".repeat(80);
    IngestionPipeline pipeline = createTestPipeline(longName, "0 * * * *");

    CronOMJob cronOMJob = clientWithOMJob.buildCronOMJob(pipeline);

    assertTrue(
        cronOMJob.getMetadata().getName().length() <= 63,
        "CronOMJob name should fit Kubernetes limits");

    List<V1EnvVar> env = cronOMJob.getSpec().getOmJobSpec().getMainPodSpec().getEnv();
    Map<String, V1EnvVar> envMap =
        env.stream().collect(Collectors.toMap(V1EnvVar::getName, v -> v));
    V1EnvVar configEnv = envMap.get("config");

    assertNotNull(configEnv);
    assertNotNull(configEnv.getValueFrom());
    assertNotNull(configEnv.getValueFrom().getConfigMapKeyRef());
    assertTrue(
        configEnv.getValueFrom().getConfigMapKeyRef().getName().length() <= 63,
        "ConfigMap name should fit Kubernetes limits");
  }

  private static Map<String, String> toEnvMap(List<V1EnvVar> envVars) {
    return envVars.stream()
        .collect(Collectors.toMap(V1EnvVar::getName, V1EnvVar::getValue, (a, b) -> b));
  }

  private static V1Pod pod(
      String name,
      OffsetDateTime createdAt,
      Map<String, String> labels,
      List<String> containerNames) {
    List<V1Container> containers =
        containerNames.stream()
            .map(containerName -> new V1Container().name(containerName))
            .toList();
    return new V1Pod()
        .metadata(new V1ObjectMeta().name(name).labels(labels).creationTimestamp(createdAt))
        .spec(new V1PodSpec().containers(containers));
  }

  private static Workflow createTestWorkflow(String name) {
    Workflow workflow = new Workflow();
    workflow.setId(UUID.randomUUID());
    workflow.setName(name);
    return workflow;
  }

  private static App createTestApplication(String name) {
    App application = new App();
    application.setId(UUID.randomUUID());
    application.setName(name);
    return application;
  }

  private ServiceEntityInterface createTestService() {
    DatabaseService service = new DatabaseService();
    service.setId(UUID.randomUUID());
    service.setName("test-database-service");
    service.setFullyQualifiedName("test-database-service");
    service.setServiceType(CreateDatabaseService.DatabaseServiceType.Mysql);

    return service;
  }

  private static void setField(Object target, String fieldName, Object value) {
    try {
      Field field = K8sPipelineClient.class.getDeclaredField(fieldName);
      field.setAccessible(true);
      field.set(target, value);
    } catch (ReflectiveOperationException e) {
      throw new RuntimeException(e);
    }
  }

  @SuppressWarnings("unchecked")
  private static <T> T invokePrivate(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = K8sPipelineClient.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    try {
      return (T) method.invoke(target, args);
    } catch (InvocationTargetException e) {
      if (e.getCause() instanceof Exception exception) {
        throw exception;
      }
      if (e.getCause() instanceof Error error) {
        throw error;
      }
      throw new RuntimeException(e.getCause());
    }
  }
}
