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
import java.util.Optional;
import org.openmetadata.operator.model.CronOMJobResource;
import org.openmetadata.operator.model.CronOMJobSpec;
import org.openmetadata.operator.model.CronOMJobStatus;
import org.openmetadata.operator.model.OMJobResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ControllerConfiguration(name = "cronomjob-controller")
public class CronOMJobReconciler
    implements Reconciler<CronOMJobResource>, ErrorStatusHandler<CronOMJobResource> {

  private static final Logger LOG = LoggerFactory.getLogger(CronOMJobReconciler.class);
  private static final Duration DEFAULT_REQUEUE = Duration.ofMinutes(1);

  private final CronParser cronParser =
      new CronParser(CronDefinitionBuilder.instanceDefinitionFor(CronType.UNIX));

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
        return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(DEFAULT_REQUEUE);
      }
      if (spec.getOmJobSpec() == null) {
        cronOMJob.getStatus().setMessage("Missing OMJob template");
        return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(DEFAULT_REQUEUE);
      }

      if (Boolean.TRUE.equals(spec.getSuspend())) {
        cronOMJob.getStatus().setMessage("Suspended");
        return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(DEFAULT_REQUEUE);
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
                          ? DEFAULT_REQUEUE
                          : Duration.between(now, next))
              .orElse(DEFAULT_REQUEUE);

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
      return UpdateControl.updateStatus(cronOMJob).rescheduleAfter(DEFAULT_REQUEUE);
    }
  }

  private OMJobResource buildOMJob(CronOMJobResource cronOMJob, Instant scheduledTime) {
    String baseName = cronOMJob.getMetadata().getName();
    String name = baseName + "-" + scheduledTime.getEpochSecond();
    if (name.length() > 253) {
      name = name.substring(0, 253);
    }

    ObjectMeta metadata =
        new ObjectMetaBuilder()
            .withName(name)
            .withNamespace(cronOMJob.getMetadata().getNamespace())
            .withLabels(cronOMJob.getMetadata().getLabels())
            .withAnnotations(cronOMJob.getMetadata().getAnnotations())
            .build();

    OMJobResource omJob = new OMJobResource();
    omJob.setMetadata(metadata);
    omJob.setSpec(cronOMJob.getSpec().getOmJobSpec());
    return omJob;
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
