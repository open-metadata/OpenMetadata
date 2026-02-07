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
import io.kubernetes.client.openapi.models.V1ConfigMap;
import io.kubernetes.client.openapi.models.V1CronJob;
import io.kubernetes.client.openapi.models.V1CronJobSpec;
import io.kubernetes.client.openapi.models.V1EnvVar;
import io.kubernetes.client.openapi.models.V1EnvVarSource;
import io.kubernetes.client.openapi.models.V1Job;
import io.kubernetes.client.openapi.models.V1JobList;
import io.kubernetes.client.openapi.models.V1JobStatus;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1PodSpec;
import io.kubernetes.client.openapi.models.V1Secret;
import io.kubernetes.client.openapi.models.V1Status;
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
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.Parameters;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.exception.IngestionPipelineDeploymentException;

@ExtendWith(MockitoExtension.class)
class K8sPipelineClientTest {

  @Mock private BatchV1Api batchApi;
  @Mock private CoreV1Api coreApi;
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
  @Mock private CoreV1Api.APIdeleteNamespacedConfigMapRequest deleteConfigMapRequest;
  @Mock private CoreV1Api.APIdeleteNamespacedSecretRequest deleteSecretRequest;
  @Mock private CoreV1Api.APIlistNamespacedPodRequest listPodRequest;

  private K8sPipelineClient client;
  private ServiceEntityInterface testService;
  private static final String NAMESPACE = "openmetadata-pipelines";

  @BeforeEach
  void setUp() throws Exception {
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
    assertEquals(1, cronOMJob.getSpec().getFailedJobsHistoryLimit());
  }

  @Test
  void testBuildCronOMJobWithStartingDeadline() {
    K8sPipelineClient clientWithOMJob = createClientWithUseOMJobOperator(true);
    IngestionPipeline pipeline = createTestPipeline("test-pipeline", "0 * * * *");

    CronOMJob cronOMJob = clientWithOMJob.buildCronOMJob(pipeline);

    assertNotNull(cronOMJob.getSpec().getStartingDeadlineSeconds());
    assertEquals(300, cronOMJob.getSpec().getStartingDeadlineSeconds());
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

  private void resetAllMocks() {
    reset(
        batchApi,
        coreApi,
        readConfigMapRequest,
        createConfigMapRequest,
        readSecretRequest,
        createSecretRequest,
        readCronJobRequest,
        createCronJobRequest);
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
    // Test that with common prefixes (om-config-, om-cronjob-) total stays under 63
    String longName = "a".repeat(60);
    String sanitized = client.sanitizeName(longName);

    String withConfigPrefix = "om-config-" + sanitized; // 10 chars prefix
    String withCronjobPrefix = "om-cronjob-" + sanitized; // 11 chars prefix

    assertTrue(
        withConfigPrefix.length() <= 63,
        "With om-config- prefix should be <= 63 chars, was: " + withConfigPrefix.length());
    assertTrue(
        withCronjobPrefix.length() <= 63,
        "With om-cronjob- prefix should be <= 63 chars, was: " + withCronjobPrefix.length());
  }

  private static Map<String, String> toEnvMap(List<V1EnvVar> envVars) {
    return envVars.stream()
        .collect(Collectors.toMap(V1EnvVar::getName, V1EnvVar::getValue, (a, b) -> b));
  }

  private ServiceEntityInterface createTestService() {
    DatabaseService service = new DatabaseService();
    service.setId(UUID.randomUUID());
    service.setName("test-database-service");
    service.setFullyQualifiedName("test-database-service");
    service.setServiceType(CreateDatabaseService.DatabaseServiceType.Mysql);

    return service;
  }
}
