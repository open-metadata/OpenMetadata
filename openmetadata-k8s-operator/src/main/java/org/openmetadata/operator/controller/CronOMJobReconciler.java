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

import com.cronutils.model.Cron;
import com.cronutils.model.CronType;
import com.cronutils.model.definition.CronDefinitionBuilder;
import com.cronutils.model.time.ExecutionTime;
import com.cronutils.parser.CronParser;
import io.fabric8.kubernetes.api.model.ObjectMeta;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientException;
import io.javaoperatorsdk.operator.api.reconciler.Context;
import io.javaoperatorsdk.operator.api.reconciler.ControllerConfiguration;
import io.javaoperatorsdk.operator.api.reconciler.ErrorStatusHandler;
import io.javaoperatorsdk.operator.api.reconciler.ErrorStatusUpdateControl;
import io.javaoperatorsdk.operator.api.reconciler.Reconciler;
import io.javaoperatorsdk.operator.api.reconciler.UpdateControl;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.operator.config.OperatorConfig;
import org.openmetadata.operator.model.CronOMJobResource;
import org.openmetadata.operator.model.CronOMJobSpec;
import org.openmetadata.operator.model.CronOMJobStatus;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.model.OMJobSpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ControllerConfiguration(name = "cronomjob-controller")
public class CronOMJobReconciler
    implements Reconciler<CronOMJobResource>, ErrorStatusHandler<CronOMJobResource> {

  private static final Logger LOG = LoggerFactory.getLogger(CronOMJobReconciler.class);
  private final Duration defaultRequeue;
  private final OperatorConfig config;

  private final CronParser cronParser =
      new CronParser(CronDefinitionBuilder.instanceDefinitionFor(CronType.UNIX));

  public CronOMJobReconciler() {
    this(new OperatorConfig());
  }

  public CronOMJobReconciler(OperatorConfig config) {
    this.config = config;
    // For CronOMJob, default requeue is 1 minute or the configured requeue delay, whichever is
    // larger
    this.defaultRequeue = Duration.ofSeconds(Math.max(60, config.getRequeueDelaySeconds()));
    LOG.info(
        "CronOMJobReconciler configured with default requeue: {} seconds",
        defaultRequeue.getSeconds());
  }

  @Override
  public UpdateControl<CronOMJobResource> reconcile(
      CronOMJobResource cronOMJob, Context<CronOMJobResource> context) {
    String name = cronOMJob.getMetadata().getName();
    String namespace = cronOMJob.getMetadata().getNamespace();

    try {
      if (cronOMJob.getStatus() == null) {
        cronOMJob.setStatus(new CronOMJobStatus());
      }

      CronOMJobSpec spec = cronOMJob.getSpec();
      if (spec == null || spec.getSchedule() == null || spec.getSchedule().isBlank()) {
        cronOMJob.getStatus().setMessage("Missing schedule");
        return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(defaultRequeue);
      }
      if (spec.getOmJobSpec() == null) {
        cronOMJob.getStatus().setMessage("Missing OMJob template");
        return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(defaultRequeue);
      }

      if (Boolean.TRUE.equals(spec.getSuspend())) {
        cronOMJob.getStatus().setMessage("Suspended");
        return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(defaultRequeue);
      }

      Cron cron = cronParser.parse(spec.getSchedule());
      ExecutionTime executionTime = ExecutionTime.forCron(cron);

      ZoneId zoneId = ZoneId.of(spec.getTimeZone() != null ? spec.getTimeZone() : "UTC");
      ZonedDateTime now = ZonedDateTime.now(zoneId);

      Optional<ZonedDateTime> lastExecution = executionTime.lastExecution(now);
      Optional<ZonedDateTime> nextExecution = executionTime.nextExecution(now);

      Duration requeueAfter =
          nextExecution
              .map(
                  next ->
                      Duration.between(now, next).isNegative()
                          ? defaultRequeue
                          : Duration.between(now, next))
              .orElse(defaultRequeue);

      if (lastExecution.isEmpty()) {
        cronOMJob.getStatus().setMessage("No execution time found");
        return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(requeueAfter);
      }

      Instant scheduledTime = lastExecution.get().toInstant();
      Instant lastScheduleTime = cronOMJob.getStatus().getLastScheduleTime();

      if (lastScheduleTime != null && !lastScheduleTime.isBefore(scheduledTime)) {
        return UpdateControl.<CronOMJobResource>noUpdate().rescheduleAfter(requeueAfter);
      }

      Integer startingDeadlineSeconds = spec.getStartingDeadlineSeconds();
      if (startingDeadlineSeconds != null && startingDeadlineSeconds > 0) {
        long delaySeconds = Duration.between(scheduledTime, now.toInstant()).getSeconds();
        if (delaySeconds > startingDeadlineSeconds) {
          cronOMJob.getStatus().setLastScheduleTime(scheduledTime);
          cronOMJob.getStatus().setMessage("Missed schedule");
          return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(requeueAfter);
        }
      }

      OMJobResource omJob = buildOMJob(cronOMJob, scheduledTime);
      KubernetesClient client = context.getClient();
      try {
        client.resources(OMJobResource.class).inNamespace(namespace).resource(omJob).create();
        cronOMJob.getStatus().setLastScheduleTime(scheduledTime);
        cronOMJob.getStatus().setLastOMJobName(omJob.getMetadata().getName());
        cronOMJob.getStatus().setMessage("Created OMJob");
        return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(requeueAfter);
      } catch (KubernetesClientException e) {
        if (e.getCode() == 409) {
          cronOMJob.getStatus().setLastScheduleTime(scheduledTime);
          cronOMJob.getStatus().setLastOMJobName(omJob.getMetadata().getName());
          cronOMJob.getStatus().setMessage("OMJob already exists");
          return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(requeueAfter);
        }
        throw e;
      }

    } catch (Exception e) {
      LOG.error("Error reconciling CronOMJob {}: {}", name, e.getMessage(), e);
      if (cronOMJob.getStatus() != null) {
        cronOMJob.getStatus().setMessage("Reconciliation error: " + e.getMessage());
      }
      return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(defaultRequeue);
    }
  }

  private OMJobResource buildOMJob(CronOMJobResource cronOMJob, Instant scheduledTime) {
    String baseName = cronOMJob.getMetadata().getName();
    String name = baseName + "-" + scheduledTime.getEpochSecond();
    if (name.length() > 253) {
      name = name.substring(0, 253);
    }

    final String finalName = name; // Make final for use in lambda

    // Generate unique run ID for this execution
    String runId = UUID.randomUUID().toString();

    ObjectMeta metadata =
        new ObjectMetaBuilder()
            .withName(name)
            .withNamespace(cronOMJob.getMetadata().getNamespace())
            .withLabels(cronOMJob.getMetadata().getLabels())
            .withAnnotations(cronOMJob.getMetadata().getAnnotations())
            .build();

    // Add run ID to labels for tracking
    if (metadata.getLabels() != null) {
      metadata.getLabels().put("app.kubernetes.io/run-id", runId);
    }

    OMJobResource omJob = new OMJobResource();
    omJob.setMetadata(metadata);

    // Deep copy the spec and update pipelineRunId
    OMJobSpec spec = deepCopyOMJobSpec(cronOMJob.getSpec().getOmJobSpec(), runId, name);

    // Log env vars for debugging
    if (spec != null && spec.getMainPodSpec() != null && spec.getMainPodSpec().getEnv() != null) {
      LOG.info(
          "Building OMJob {} from CronOMJob: {} env vars found",
          finalName,
          spec.getMainPodSpec().getEnv().size());
      spec.getMainPodSpec()
          .getEnv()
          .forEach(
              env -> {
                if ("config".equals(env.getName())) {
                  LOG.info(
                      "Config env var in OMJob {}: value={}, valueFrom={}",
                      finalName,
                      env.getValue(),
                      env.getValueFrom());
                  if (env.getValueFrom() != null) {
                    LOG.info("  Has valueFrom object");
                    if (env.getValueFrom().getConfigMapKeyRef() != null) {
                      LOG.info(
                          "    ConfigMapKeyRef - Name: {}, Key: {}",
                          env.getValueFrom().getConfigMapKeyRef().getName(),
                          env.getValueFrom().getConfigMapKeyRef().getKey());
                    } else {
                      LOG.warn("    ConfigMapKeyRef is null despite valueFrom being present");
                    }
                    if (env.getValueFrom().getSecretKeyRef() != null) {
                      LOG.info("    Has SecretKeyRef");
                    }
                    if (env.getValueFrom().getFieldRef() != null) {
                      LOG.info("    Has FieldRef");
                    }
                    if (env.getValueFrom().getResourceFieldRef() != null) {
                      LOG.info("    Has ResourceFieldRef");
                    }
                  }
                }
              });
    }

    omJob.setSpec(spec);
    return omJob;
  }

  private OMJobSpec deepCopyOMJobSpec(OMJobSpec source, String runId, String jobName) {
    if (source == null) {
      return null;
    }

    OMJobSpec copy = new OMJobSpec();
    copy.setMainPodSpec(deepCopyPodSpec(source.getMainPodSpec(), runId, jobName));
    copy.setExitHandlerSpec(deepCopyPodSpec(source.getExitHandlerSpec(), runId, jobName));
    copy.setTtlSecondsAfterFinished(source.getTtlSecondsAfterFinished());
    return copy;
  }

  private OMJobSpec.OMJobPodSpec deepCopyPodSpec(
      OMJobSpec.OMJobPodSpec source, String runId, String jobName) {
    if (source == null) {
      return null;
    }

    OMJobSpec.OMJobPodSpec copy = new OMJobSpec.OMJobPodSpec();
    copy.setImage(source.getImage());
    copy.setImagePullPolicy(source.getImagePullPolicy());
    copy.setImagePullSecrets(
        source.getImagePullSecrets() != null
            ? new ArrayList<>(source.getImagePullSecrets())
            : null);
    copy.setServiceAccountName(source.getServiceAccountName());
    copy.setCommand(source.getCommand() != null ? new ArrayList<>(source.getCommand()) : null);

    // Deep copy environment variables to preserve valueFrom references
    if (source.getEnv() != null) {
      List<io.fabric8.kubernetes.api.model.EnvVar> copiedEnvVars = new ArrayList<>();
      for (io.fabric8.kubernetes.api.model.EnvVar sourceEnv : source.getEnv()) {
        io.fabric8.kubernetes.api.model.EnvVarBuilder envBuilder =
            new io.fabric8.kubernetes.api.model.EnvVarBuilder();
        envBuilder.withName(sourceEnv.getName());

        // Replace placeholders with runtime values
        if ("pipelineRunId".equals(sourceEnv.getName())
            && "{{ omjob.uid }}".equals(sourceEnv.getValue())) {
          envBuilder.withValue(runId);
        } else if ("jobName".equals(sourceEnv.getName())
            && "{{ omjob.name }}".equals(sourceEnv.getValue())) {
          envBuilder.withValue(jobName);
        } else {
          envBuilder.withValue(sourceEnv.getValue());
        }

        // Preserve valueFrom if it exists
        if (sourceEnv.getValueFrom() != null) {
          io.fabric8.kubernetes.api.model.EnvVarSourceBuilder valueFromBuilder =
              new io.fabric8.kubernetes.api.model.EnvVarSourceBuilder();

          if (sourceEnv.getValueFrom().getConfigMapKeyRef() != null) {
            valueFromBuilder.withConfigMapKeyRef(
                new io.fabric8.kubernetes.api.model.ConfigMapKeySelectorBuilder()
                    .withName(sourceEnv.getValueFrom().getConfigMapKeyRef().getName())
                    .withKey(sourceEnv.getValueFrom().getConfigMapKeyRef().getKey())
                    .withOptional(sourceEnv.getValueFrom().getConfigMapKeyRef().getOptional())
                    .build());
          }

          if (sourceEnv.getValueFrom().getSecretKeyRef() != null) {
            valueFromBuilder.withSecretKeyRef(
                new io.fabric8.kubernetes.api.model.SecretKeySelectorBuilder()
                    .withName(sourceEnv.getValueFrom().getSecretKeyRef().getName())
                    .withKey(sourceEnv.getValueFrom().getSecretKeyRef().getKey())
                    .withOptional(sourceEnv.getValueFrom().getSecretKeyRef().getOptional())
                    .build());
          }

          if (sourceEnv.getValueFrom().getFieldRef() != null) {
            valueFromBuilder.withFieldRef(
                new io.fabric8.kubernetes.api.model.ObjectFieldSelectorBuilder()
                    .withApiVersion(sourceEnv.getValueFrom().getFieldRef().getApiVersion())
                    .withFieldPath(sourceEnv.getValueFrom().getFieldRef().getFieldPath())
                    .build());
          }

          if (sourceEnv.getValueFrom().getResourceFieldRef() != null) {
            valueFromBuilder.withResourceFieldRef(
                new io.fabric8.kubernetes.api.model.ResourceFieldSelectorBuilder()
                    .withContainerName(
                        sourceEnv.getValueFrom().getResourceFieldRef().getContainerName())
                    .withDivisor(sourceEnv.getValueFrom().getResourceFieldRef().getDivisor())
                    .withResource(sourceEnv.getValueFrom().getResourceFieldRef().getResource())
                    .build());
          }

          envBuilder.withValueFrom(valueFromBuilder.build());
        }

        copiedEnvVars.add(envBuilder.build());
      }
      copy.setEnv(copiedEnvVars);
    } else {
      copy.setEnv(null);
    }

    copy.setResources(source.getResources());
    copy.setNodeSelector(
        source.getNodeSelector() != null ? new HashMap<>(source.getNodeSelector()) : null);
    copy.setSecurityContext(source.getSecurityContext());
    copy.setLabels(source.getLabels() != null ? new HashMap<>(source.getLabels()) : null);
    copy.setAnnotations(
        source.getAnnotations() != null ? new HashMap<>(source.getAnnotations()) : null);
    return copy;
  }

  @Override
  public ErrorStatusUpdateControl<CronOMJobResource> updateErrorStatus(
      CronOMJobResource resource, Context<CronOMJobResource> context, Exception e) {
    CronOMJobStatus status =
        resource.getStatus() != null ? resource.getStatus() : new CronOMJobStatus();
    status.setMessage("Error: " + e.getMessage());
    resource.setStatus(status);
    return ErrorStatusUpdateControl.updateStatus(resource);
  }
}
