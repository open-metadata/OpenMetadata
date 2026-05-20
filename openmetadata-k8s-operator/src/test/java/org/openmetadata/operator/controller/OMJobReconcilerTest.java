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

package org.openmetadata.operator.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.PodBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.javaoperatorsdk.operator.api.reconciler.Context;
import io.javaoperatorsdk.operator.api.reconciler.UpdateControl;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.operator.config.OperatorConfig;
import org.openmetadata.operator.model.OMJobPhase;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.model.OMJobSpec;
import org.openmetadata.operator.model.OMJobStatus;
import org.openmetadata.operator.service.EventPublisher;
import org.openmetadata.operator.service.PodManager;

@ExtendWith(MockitoExtension.class)
class OMJobReconcilerTest {

  @Mock private KubernetesClient kubernetesClient;
  @Mock private Context<OMJobResource> context;
  @Mock private PodManager podManager;
  @Mock private EventPublisher eventPublisher;

  private OMJobReconciler reconciler;

  @BeforeEach
  void setUp() throws Exception {
    OperatorConfig config = new OperatorConfig();
    reconciler = new OMJobReconciler(config);

    lenient().when(context.getClient()).thenReturn(kubernetesClient);

    // Inject mocks via reflection since the reconciler lazily initializes them
    var podManagerField = OMJobReconciler.class.getDeclaredField("podManager");
    podManagerField.setAccessible(true);
    podManagerField.set(reconciler, podManager);

    var eventPublisherField = OMJobReconciler.class.getDeclaredField("eventPublisher");
    eventPublisherField.setAccessible(true);
    eventPublisherField.set(reconciler, eventPublisher);
  }

  @Test
  void testExitHandlerRunningDoesNotRecreateWhenPodFound() {
    OMJobResource omJob = createOMJobInPhase(OMJobPhase.EXIT_HANDLER_RUNNING);
    omJob.getStatus().setExitHandlerPodName("test-omjob-exit");

    Pod exitPod =
        new PodBuilder()
            .withNewMetadata()
            .withName("test-omjob-exit")
            .endMetadata()
            .withNewStatus()
            .withPhase("Running")
            .endStatus()
            .build();

    when(podManager.findExitHandlerPod(omJob)).thenReturn(Optional.of(exitPod));
    when(podManager.isPodCompleted(exitPod)).thenReturn(false);

    UpdateControl<OMJobResource> result = reconciler.reconcile(omJob, context);

    // Should NOT attempt to create an exit handler pod
    verify(podManager, never()).createExitHandlerPod(any());
    // Should reschedule for monitoring
    assertTrue(result.getScheduleDelay().isPresent());
  }

  @Test
  void testExitHandlerRunningCreatesOnlyOnce() {
    OMJobResource omJob = createOMJobInPhase(OMJobPhase.EXIT_HANDLER_RUNNING);

    Pod exitPod =
        new PodBuilder().withNewMetadata().withName("test-omjob-exit").endMetadata().build();

    // First call: pod not found, so create it
    when(podManager.findExitHandlerPod(omJob)).thenReturn(Optional.empty());
    when(podManager.createExitHandlerPod(omJob)).thenReturn(exitPod);

    UpdateControl<OMJobResource> result = reconciler.reconcile(omJob, context);

    verify(podManager, times(1)).createExitHandlerPod(omJob);
    assertEquals("test-omjob-exit", omJob.getStatus().getExitHandlerPodName());
    assertTrue(result.getScheduleDelay().isPresent());
  }

  @Test
  void testTerminalPhaseReschedulesWhenTtlNotExpired() {
    OMJobResource omJob = createOMJobInPhase(OMJobPhase.SUCCEEDED);
    omJob.getSpec().setTtlSecondsAfterFinished(3600);
    // Set completion time to just now
    omJob.getStatus().setCompletionTime(Instant.now());

    UpdateControl<OMJobResource> result = reconciler.reconcile(omJob, context);

    // Should reschedule to check when TTL expires
    assertTrue(result.getScheduleDelay().isPresent());
    // Should NOT delete pods yet
    verify(podManager, never()).deletePods(any());
  }

  @Test
  void testTerminalPhaseDeletesPodsWhenTtlExpired() {
    OMJobResource omJob = createOMJobInPhase(OMJobPhase.SUCCEEDED);
    omJob.getSpec().setTtlSecondsAfterFinished(10);
    // Set completion time to 20 seconds ago
    omJob.getStatus().setCompletionTime(Instant.now().minusSeconds(20));

    UpdateControl<OMJobResource> result = reconciler.reconcile(omJob, context);

    // Should delete pods
    verify(podManager, times(1)).deletePods(omJob);
    // Should NOT reschedule
    assertFalse(result.getScheduleDelay().isPresent());
  }

  @Test
  void testTerminalPhaseNoRescheduleWithoutTtl() {
    OMJobResource omJob = createOMJobInPhase(OMJobPhase.SUCCEEDED);
    omJob.getSpec().setTtlSecondsAfterFinished(null);

    UpdateControl<OMJobResource> result = reconciler.reconcile(omJob, context);

    // No TTL configured - no reschedule, no deletion
    assertFalse(result.getScheduleDelay().isPresent());
    verify(podManager, never()).deletePods(any());
  }

  @Test
  void testTerminalPhaseNoRescheduleWithZeroTtl() {
    OMJobResource omJob = createOMJobInPhase(OMJobPhase.SUCCEEDED);
    omJob.getSpec().setTtlSecondsAfterFinished(0);

    UpdateControl<OMJobResource> result = reconciler.reconcile(omJob, context);

    assertFalse(result.getScheduleDelay().isPresent());
    verify(podManager, never()).deletePods(any());
  }

  @Test
  void testExitHandlerCompletedSchedulesTtlCleanup() {
    OMJobResource omJob = createOMJobInPhase(OMJobPhase.EXIT_HANDLER_RUNNING);
    omJob.getSpec().setTtlSecondsAfterFinished(10);

    Pod exitPod =
        new PodBuilder()
            .withNewMetadata()
            .withName("test-omjob-exit")
            .endMetadata()
            .withNewStatus()
            .withPhase("Succeeded")
            .addNewContainerStatus()
            .withNewState()
            .withNewTerminated()
            .withExitCode(0)
            .endTerminated()
            .endState()
            .endContainerStatus()
            .endStatus()
            .build();

    when(podManager.findExitHandlerPod(omJob)).thenReturn(Optional.of(exitPod));
    when(podManager.isPodCompleted(exitPod)).thenReturn(true);
    when(podManager.getPodExitCode(exitPod)).thenReturn(Optional.of(0));

    UpdateControl<OMJobResource> result = reconciler.reconcile(omJob, context);

    assertEquals(OMJobPhase.SUCCEEDED, omJob.getStatus().getPhase());
    // Must reschedule after TTL so handleTerminalPhase cleans up
    assertTrue(result.getScheduleDelay().isPresent());
    assertEquals(10000L, result.getScheduleDelay().get());
  }

  @Test
  void testExitHandlerCompletedNoRescheduleWithoutTtl() {
    OMJobResource omJob = createOMJobInPhase(OMJobPhase.EXIT_HANDLER_RUNNING);
    omJob.getSpec().setTtlSecondsAfterFinished(null);

    Pod exitPod =
        new PodBuilder()
            .withNewMetadata()
            .withName("test-omjob-exit")
            .endMetadata()
            .withNewStatus()
            .withPhase("Succeeded")
            .addNewContainerStatus()
            .withNewState()
            .withNewTerminated()
            .withExitCode(0)
            .endTerminated()
            .endState()
            .endContainerStatus()
            .endStatus()
            .build();

    when(podManager.findExitHandlerPod(omJob)).thenReturn(Optional.of(exitPod));
    when(podManager.isPodCompleted(exitPod)).thenReturn(true);
    when(podManager.getPodExitCode(exitPod)).thenReturn(Optional.of(0));

    UpdateControl<OMJobResource> result = reconciler.reconcile(omJob, context);

    assertEquals(OMJobPhase.SUCCEEDED, omJob.getStatus().getPhase());
    // No TTL - no reschedule for cleanup
    assertFalse(result.getScheduleDelay().isPresent());
  }

  @Test
  void testFailedTerminalPhaseAlsoReschedulesForTtl() {
    OMJobResource omJob = createOMJobInPhase(OMJobPhase.FAILED);
    omJob.getSpec().setTtlSecondsAfterFinished(600);
    omJob.getStatus().setCompletionTime(Instant.now());

    UpdateControl<OMJobResource> result = reconciler.reconcile(omJob, context);

    assertTrue(result.getScheduleDelay().isPresent());
    verify(podManager, never()).deletePods(any());
  }

  private OMJobResource createOMJobInPhase(OMJobPhase phase) {
    OMJobSpec.OMJobPodSpec mainPodSpec = new OMJobSpec.OMJobPodSpec();
    mainPodSpec.setImage("openmetadata/ingestion:test");

    OMJobSpec.OMJobPodSpec exitHandlerSpec = new OMJobSpec.OMJobPodSpec();
    exitHandlerSpec.setImage("openmetadata/ingestion:test");

    OMJobSpec spec = new OMJobSpec();
    spec.setMainPodSpec(mainPodSpec);
    spec.setExitHandlerSpec(exitHandlerSpec);
    spec.setTtlSecondsAfterFinished(3600);

    OMJobResource omJob = new OMJobResource();
    omJob.setApiVersion("pipelines.openmetadata.org/v1");
    omJob.setKind("OMJob");
    omJob.setMetadata(
        new ObjectMetaBuilder()
            .withName("test-omjob")
            .withNamespace("test-namespace")
            .withUid("test-uid")
            .withLabels(
                Map.of(
                    "app.kubernetes.io/name", "openmetadata",
                    "app.kubernetes.io/component", "ingestion"))
            .build());
    omJob.setSpec(spec);

    OMJobStatus status = new OMJobStatus();
    status.setPhase(phase);
    if (phase.isTerminal()) {
      status.setCompletionTime(Instant.now());
    }
    omJob.setStatus(status);

    return omJob;
  }
}
