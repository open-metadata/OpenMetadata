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

import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.javaoperatorsdk.operator.api.reconciler.*;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.openmetadata.operator.model.OMJobPhase;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.model.OMJobStatus;
import org.openmetadata.operator.service.EventPublisher;
import org.openmetadata.operator.service.PodManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Main reconciler for OMJob custom resources.
 *
 * This implements the two-stage execution pattern:
 * 1. Creates and monitors main ingestion pod
 * 2. After main pod completion, creates exit handler pod
 * 3. Updates OMJob status throughout the lifecycle
 *
 * The reconciler ensures guaranteed exit handler execution for ALL
 * pod termination scenarios.
 *
 * Namespace configuration is controlled by WATCH_NAMESPACES environment variable.
 */
@ControllerConfiguration(name = "omjob-controller")
public class OMJobReconciler
    implements Reconciler<OMJobResource>, ErrorStatusHandler<OMJobResource> {

  private static final Logger LOG = LoggerFactory.getLogger(OMJobReconciler.class);

  private PodManager podManager;
  private EventPublisher eventPublisher;

  // Reconciliation intervals
  private static final Duration POLLING_INTERVAL = Duration.ofSeconds(10);
  private static final Duration REQUEUE_DELAY = Duration.ofSeconds(30);

  public OMJobReconciler() {
    // PodManager and EventPublisher will be initialized when reconciler is called
    // with the client context
  }

  @Override
  public UpdateControl<OMJobResource> reconcile(
      OMJobResource omJob, Context<OMJobResource> context) {
    String omJobName = omJob.getMetadata().getName();
    String namespace = omJob.getMetadata().getNamespace();

    // Initialize managers with client from context if not already done
    if (podManager == null) {
      KubernetesClient client = context.getClient();
      this.podManager = new PodManager(client);
      this.eventPublisher = new EventPublisher(client);
    }

    LOG.info("Reconciling OMJob: {} in namespace: {}", omJobName, namespace);

    try {
      // Initialize status if needed
      if (omJob.getStatus() == null) {
        omJob.setStatus(new OMJobStatus());
      }

      OMJobStatus status = omJob.getStatus();
      OMJobPhase currentPhase = status.getPhase();

      LOG.debug("Current phase for OMJob {}: {}", omJobName, currentPhase);

      // State machine for OMJob lifecycle
      switch (currentPhase) {
        case PENDING:
          return handlePendingPhase(omJob);

        case RUNNING:
          return handleRunningPhase(omJob);

        case EXIT_HANDLER_RUNNING:
          return handleExitHandlerRunningPhase(omJob);

        case SUCCEEDED:
        case FAILED:
          return handleTerminalPhase(omJob);

        default:
          LOG.warn("Unknown phase for OMJob {}: {}", omJobName, currentPhase);
          return UpdateControl.<OMJobResource>noUpdate();
      }

    } catch (Exception e) {
      LOG.error("Error reconciling OMJob: {}", omJobName, e);

      // Update status to failed
      omJob.getStatus().transitionTo(OMJobPhase.FAILED, "Reconciliation error: " + e.getMessage());

      eventPublisher.publishWarningEvent(
          omJob, "ReconciliationError", "Failed to reconcile OMJob: " + e.getMessage());

      return UpdateControl.updateStatus(omJob).rescheduleAfter(REQUEUE_DELAY);
    }
  }

  @Override
  public ErrorStatusUpdateControl<OMJobResource> updateErrorStatus(
      OMJobResource omJob, Context<OMJobResource> context, Exception e) {
    LOG.error("Error status update for OMJob: {}", omJob.getMetadata().getName(), e);

    // Initialize managers with client from context if not already done
    if (eventPublisher == null) {
      KubernetesClient client = context.getClient();
      this.eventPublisher = new EventPublisher(client);
    }

    omJob.getStatus().transitionTo(OMJobPhase.FAILED, "Error: " + e.getMessage());

    eventPublisher.publishWarningEvent(omJob, "ReconciliationFailed", "Failed to reconcile");

    return ErrorStatusUpdateControl.updateStatus(omJob);
  }

  // Phase handlers

  private UpdateControl<OMJobResource> handlePendingPhase(OMJobResource omJob) {
    LOG.info("Handling PENDING phase for OMJob: {}", omJob.getMetadata().getName());

    // Check if main pod already exists
    Optional<Pod> existingMainPod = podManager.findMainPod(omJob);
    if (existingMainPod.isPresent()) {
      LOG.info("Main pod already exists, transitioning to RUNNING");
      omJob.getStatus().transitionTo(OMJobPhase.RUNNING, "Main pod found");
      omJob.getStatus().setMainPodName(existingMainPod.get().getMetadata().getName());
      return UpdateControl.updateStatus(omJob).rescheduleAfter(POLLING_INTERVAL);
    }

    // Check if we already recorded the main pod name but can't find it yet (race condition)
    String recordedPodName = omJob.getStatus().getMainPodName();
    if (recordedPodName != null && !recordedPodName.isEmpty()) {
      LOG.info(
          "Main pod {} was created but not found yet, retrying in {} seconds",
          recordedPodName,
          POLLING_INTERVAL.getSeconds());
      // Stay in PENDING phase and retry
      return UpdateControl.<OMJobResource>noUpdate().rescheduleAfter(POLLING_INTERVAL);
    }

    try {
      // Create main pod
      Pod mainPod = podManager.createMainPod(omJob);

      // Update status - but stay in PENDING until we confirm the pod exists
      // This avoids the race condition where we transition to RUNNING before the pod is visible
      omJob.getStatus().setMainPodName(mainPod.getMetadata().getName());
      omJob.getStatus().setMessage("Main pod created, waiting for confirmation");

      eventPublisher.publishNormalEvent(
          omJob,
          "MainPodCreated",
          "Created main ingestion pod: " + mainPod.getMetadata().getName());

      // Stay in PENDING and check again to confirm pod exists
      return UpdateControl.updateStatus(omJob).rescheduleAfter(Duration.ofSeconds(2));

    } catch (Exception e) {
      LOG.error("Failed to create main pod for OMJob: {}", omJob.getMetadata().getName(), e);

      // If it's an "already exists" error, the pod was created, just retry
      if (e.getMessage() != null && e.getMessage().contains("already exists")) {
        LOG.info("Pod already exists, will retry to find it");
        return UpdateControl.<OMJobResource>noUpdate().rescheduleAfter(Duration.ofSeconds(2));
      }

      omJob
          .getStatus()
          .transitionTo(OMJobPhase.FAILED, "Failed to create main pod: " + e.getMessage());
      return UpdateControl.updateStatus(omJob);
    }
  }

  private UpdateControl<OMJobResource> handleRunningPhase(OMJobResource omJob) {
    LOG.info("Handling RUNNING phase for OMJob: {}", omJob.getMetadata().getName());

    // Find and check main pod status
    Optional<Pod> mainPod = podManager.findMainPod(omJob);
    if (mainPod.isEmpty()) {
      // Check how long we've been in RUNNING phase
      Instant startTime = omJob.getStatus().getStartTime();
      if (startTime != null) {
        long secondsSinceStart = Duration.between(startTime, Instant.now()).getSeconds();
        if (secondsSinceStart < 30) {
          // Pod might still be creating or there's a delay in the API
          LOG.warn(
              "Main pod not found for OMJob: {}, but only {}s since start, retrying",
              omJob.getMetadata().getName(),
              secondsSinceStart);
          return UpdateControl.<OMJobResource>noUpdate().rescheduleAfter(Duration.ofSeconds(5));
        }
      }

      LOG.error(
          "Main pod not found for OMJob: {} after timeout, transitioning to FAILED",
          omJob.getMetadata().getName());
      omJob.getStatus().transitionTo(OMJobPhase.FAILED, "Main pod not found after timeout");
      return UpdateControl.updateStatus(omJob);
    }

    Pod pod = mainPod.get();
    LOG.info(
        "Main pod {} status: Phase={}, Completed={}",
        pod.getMetadata().getName(),
        pod.getStatus() != null ? pod.getStatus().getPhase() : "null",
        podManager.isPodCompleted(pod));

    // Check if main pod has completed
    if (!podManager.isPodCompleted(pod)) {
      // Pod still running, continue monitoring
      LOG.info(
          "Main pod still running, rescheduling check in {} seconds",
          POLLING_INTERVAL.getSeconds());
      return UpdateControl.<OMJobResource>noUpdate().rescheduleAfter(POLLING_INTERVAL);
    }

    // Main pod completed - capture exit code and transition to exit handler
    Optional<Integer> exitCode = podManager.getPodExitCode(pod);
    exitCode.ifPresent(code -> omJob.getStatus().setMainPodExitCode(code));

    String message =
        String.format(
            "Main pod completed with exit code: %s",
            exitCode.map(String::valueOf).orElse("unknown"));

    omJob.getStatus().transitionTo(OMJobPhase.EXIT_HANDLER_RUNNING, message);

    eventPublisher.publishNormalEvent(omJob, "MainPodCompleted", message);

    return UpdateControl.updateStatus(omJob).rescheduleAfter(Duration.ofSeconds(1));
  }

  private UpdateControl<OMJobResource> handleExitHandlerRunningPhase(OMJobResource omJob) {
    LOG.info("Handling EXIT_HANDLER_RUNNING phase for OMJob: {}", omJob.getMetadata().getName());

    // Check if exit handler pod already exists
    Optional<Pod> existingExitPod = podManager.findExitHandlerPod(omJob);
    if (existingExitPod.isEmpty()) {
      try {
        // Create exit handler pod
        Pod exitPod = podManager.createExitHandlerPod(omJob);
        omJob.getStatus().setExitHandlerPodName(exitPod.getMetadata().getName());

        eventPublisher.publishNormalEvent(
            omJob,
            "ExitHandlerCreated",
            "Created exit handler pod: " + exitPod.getMetadata().getName());

        return UpdateControl.updateStatus(omJob).rescheduleAfter(POLLING_INTERVAL);

      } catch (Exception e) {
        LOG.error(
            "Failed to create exit handler pod for OMJob: {}", omJob.getMetadata().getName(), e);
        omJob
            .getStatus()
            .transitionTo(OMJobPhase.FAILED, "Failed to create exit handler: " + e.getMessage());
        return UpdateControl.updateStatus(omJob);
      }
    }

    Pod exitPod = existingExitPod.get();

    // Check if exit handler has completed
    if (!podManager.isPodCompleted(exitPod)) {
      // Exit handler still running
      return UpdateControl.<OMJobResource>noUpdate().rescheduleAfter(POLLING_INTERVAL);
    }

    // Exit handler completed - determine final status
    Optional<Integer> exitCode = podManager.getPodExitCode(exitPod);
    boolean success = exitCode.map(code -> code == 0).orElse(false);

    OMJobPhase finalPhase = success ? OMJobPhase.SUCCEEDED : OMJobPhase.FAILED;
    String message =
        String.format(
            "Exit handler completed with exit code: %s",
            exitCode.map(String::valueOf).orElse("unknown"));

    omJob.getStatus().transitionTo(finalPhase, message);

    String eventType = success ? "OMJobCompleted" : "OMJobFailed";
    eventPublisher.publishNormalEvent(omJob, eventType, message);

    return UpdateControl.updateStatus(omJob);
  }

  private UpdateControl<OMJobResource> handleTerminalPhase(OMJobResource omJob) {
    LOG.debug("Handling terminal phase for OMJob: {}", omJob.getMetadata().getName());

    // Check if cleanup is needed based on TTL
    if (omJob.shouldCleanup()) {
      LOG.info("TTL expired for OMJob: {}, cleaning up pods", omJob.getMetadata().getName());
      podManager.deletePods(omJob);

      eventPublisher.publishNormalEvent(
          omJob, "ResourcesCleanedUp", "Cleaned up pods due to TTL expiration");
    }

    // Terminal state - no further reconciliation needed
    return UpdateControl.<OMJobResource>noUpdate();
  }
}
