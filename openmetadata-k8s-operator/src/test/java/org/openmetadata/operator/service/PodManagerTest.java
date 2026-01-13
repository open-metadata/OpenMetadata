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

package org.openmetadata.operator.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import io.fabric8.kubernetes.api.model.*;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.MixedOperation;
import io.fabric8.kubernetes.client.dsl.PodResource;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.model.OMJobSpec;

/**
 * Test suite for PodManager.
 * Focuses on ensuring proper environment variable sanitization during pod creation.
 */
@ExtendWith(MockitoExtension.class)
class PodManagerTest {

  @Mock private KubernetesClient kubernetesClient;

  @Mock private MixedOperation<Pod, PodList, PodResource> podOperations;

  @Mock private PodResource podResource;

  private PodManager podManager;

  @BeforeEach
  void setUp() {
    podManager = new PodManager(kubernetesClient);
    when(kubernetesClient.pods()).thenReturn(podOperations);
  }

  @Test
  void testCreateMainPodWithEmptyValueFromEnvVar() {
    // Setup OMJob with problematic environment variables
    OMJobResource omJob = createOMJobWithEmptyValueFrom();

    // Setup mocks
    when(podOperations.inNamespace(anyString())).thenReturn(podOperations);
    when(podOperations.resource(any(Pod.class))).thenReturn(podResource);

    Pod createdPod =
        new PodBuilder()
            .withNewMetadata()
            .withName("test-pod-main")
            .withNamespace("test-namespace")
            .endMetadata()
            .build();

    when(podResource.create()).thenReturn(createdPod);

    // Execute
    Pod result = podManager.createMainPod(omJob);

    // Verify pod was created
    assertNotNull(result);
    assertEquals("test-pod-main", result.getMetadata().getName());

    // Capture the pod that was created
    ArgumentCaptor<Pod> podCaptor = ArgumentCaptor.forClass(Pod.class);
    verify(podOperations).resource(podCaptor.capture());

    Pod capturedPod = podCaptor.getValue();
    assertNotNull(capturedPod);

    // Verify environment variables were sanitized
    Container container = capturedPod.getSpec().getContainers().get(0);
    List<EnvVar> envVars = container.getEnv();

    // Find the config env var that had empty valueFrom
    EnvVar configEnv =
        envVars.stream().filter(e -> "config".equals(e.getName())).findFirst().orElse(null);

    assertNotNull(configEnv);
    assertNull(configEnv.getValueFrom(), "Empty valueFrom should have been removed");
  }

  @Test
  void testCreateExitHandlerPodWithEnvVarSanitization() {
    // Setup OMJob
    OMJobResource omJob = createOMJobWithEmptyValueFrom();
    omJob.getStatus().setMainPodExitCode(0);

    // Setup mocks
    when(podOperations.inNamespace(anyString())).thenReturn(podOperations);
    when(podOperations.resource(any(Pod.class))).thenReturn(podResource);

    Pod createdPod =
        new PodBuilder()
            .withNewMetadata()
            .withName("test-pod-exit")
            .withNamespace("test-namespace")
            .endMetadata()
            .build();

    when(podResource.create()).thenReturn(createdPod);

    // Execute
    Pod result = podManager.createExitHandlerPod(omJob);

    // Verify pod was created
    assertNotNull(result);

    // Capture the pod
    ArgumentCaptor<Pod> podCaptor = ArgumentCaptor.forClass(Pod.class);
    verify(podOperations).resource(podCaptor.capture());

    Pod capturedPod = podCaptor.getValue();
    Container container = capturedPod.getSpec().getContainers().get(0);
    List<EnvVar> envVars = container.getEnv();

    // All env vars should be properly sanitized
    for (EnvVar envVar : envVars) {
      if (envVar.getValueFrom() != null) {
        // If valueFrom exists, it should have valid content
        assertTrue(
            envVar.getValueFrom().getConfigMapKeyRef() != null
                || envVar.getValueFrom().getSecretKeyRef() != null
                || envVar.getValueFrom().getFieldRef() != null
                || envVar.getValueFrom().getResourceFieldRef() != null,
            "valueFrom must have valid references");
      }
    }
  }

  private OMJobResource createOMJobWithEmptyValueFrom() {
    // Create environment variables including one with empty valueFrom
    List<EnvVar> envVars =
        Arrays.asList(
            new EnvVarBuilder().withName("pipelineType").withValue("metadata").build(),
            new EnvVarBuilder().withName("pipelineRunId").withValue("scheduled").build(),
            new EnvVarBuilder()
                .withName("config")
                .withValueFrom(new EnvVarSource()) // Empty valueFrom - the problem
                .build());

    OMJobSpec.OMJobPodSpec mainPodSpec = new OMJobSpec.OMJobPodSpec();
    mainPodSpec.setImage("openmetadata/ingestion:test");
    mainPodSpec.setImagePullPolicy("IfNotPresent");
    mainPodSpec.setCommand(Arrays.asList("python", "main.py"));
    mainPodSpec.setEnv(envVars);
    mainPodSpec.setServiceAccountName("test-sa");

    OMJobSpec.OMJobPodSpec exitHandlerSpec = new OMJobSpec.OMJobPodSpec();
    exitHandlerSpec.setImage("openmetadata/ingestion:test");
    exitHandlerSpec.setImagePullPolicy("IfNotPresent");
    exitHandlerSpec.setCommand(Arrays.asList("python", "exit_handler.py"));
    exitHandlerSpec.setEnv(envVars);
    exitHandlerSpec.setServiceAccountName("test-sa");

    OMJobSpec spec = new OMJobSpec();
    spec.setMainPodSpec(mainPodSpec);
    spec.setExitHandlerSpec(exitHandlerSpec);
    spec.setTtlSecondsAfterFinished(3600);

    OMJobResource omJob = new OMJobResource();
    omJob.setApiVersion("pipelines.openmetadata.org/v1");
    omJob.setKind("OMJob");

    ObjectMeta metadata =
        new ObjectMetaBuilder()
            .withName("test-omjob")
            .withNamespace("test-namespace")
            .withUid("test-uid")
            .withLabels(
                Map.of(
                    "app.kubernetes.io/name", "openmetadata",
                    "app.kubernetes.io/component", "ingestion"))
            .build();

    omJob.setMetadata(metadata);
    omJob.setSpec(spec);
    omJob.setStatus(new org.openmetadata.operator.model.OMJobStatus());

    return omJob;
  }
}
