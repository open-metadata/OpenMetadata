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

package org.openmetadata.operator.unit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import io.fabric8.kubernetes.api.model.ObjectMeta;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.javaoperatorsdk.operator.api.reconciler.Context;
import io.javaoperatorsdk.operator.api.reconciler.UpdateControl;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.operator.controller.CronOMJobReconciler;
import org.openmetadata.operator.model.CronOMJobResource;
import org.openmetadata.operator.model.CronOMJobSpec;
import org.openmetadata.operator.model.CronOMJobStatus;
import org.openmetadata.operator.model.OMJobSpec;

@ExtendWith(MockitoExtension.class)
class CronOMJobReconcilerTest {

  @Mock private Context<CronOMJobResource> context;
  @Mock private KubernetesClient client;

  private CronOMJobReconciler reconciler;
  private CronOMJobResource cronOMJob;

  @BeforeEach
  void setUp() {
    reconciler = new CronOMJobReconciler();
    cronOMJob = createTestCronOMJob("test-cronjob", "0 * * * *");
    when(context.getClient()).thenReturn(client);
  }

  @Test
  void testReconcileWithMissingSchedule() {
    cronOMJob.getSpec().setSchedule(null);

    UpdateControl<CronOMJobResource> result = reconciler.reconcile(cronOMJob, context);

    assertNotNull(result);
    assertEquals("Missing schedule", cronOMJob.getStatus().getMessage());
  }

  @Test
  void testReconcileWithMissingOMJobSpec() {
    cronOMJob.getSpec().setOmJobSpec(null);

    UpdateControl<CronOMJobResource> result = reconciler.reconcile(cronOMJob, context);

    assertNotNull(result);
    assertEquals("Missing OMJob template", cronOMJob.getStatus().getMessage());
  }

  @Test
  void testReconcileWithSuspended() {
    cronOMJob.getSpec().setSuspend(true);

    UpdateControl<CronOMJobResource> result = reconciler.reconcile(cronOMJob, context);

    assertNotNull(result);
    assertEquals("Suspended", cronOMJob.getStatus().getMessage());
  }

  @Test
  void testReconcileWithInvalidSchedule() {
    cronOMJob.getSpec().setSchedule("invalid cron");

    UpdateControl<CronOMJobResource> result = reconciler.reconcile(cronOMJob, context);

    assertNotNull(result);
    assertTrue(cronOMJob.getStatus().getMessage().contains("Reconciliation error"));
  }

  @Test
  void testReconcileWithStartingDeadlineExceeded() {
    cronOMJob.getSpec().setStartingDeadlineSeconds(1);
    cronOMJob.setStatus(new CronOMJobStatus());
    // Set last schedule to an hour ago - well past deadline
    cronOMJob.getStatus().setLastScheduleTime(Instant.now().minusSeconds(3600));

    UpdateControl<CronOMJobResource> result = reconciler.reconcile(cronOMJob, context);

    assertNotNull(result);
    // Should still reconcile but may skip due to deadline
  }

  @Test
  void testReconcileWithDifferentTimeZone() {
    cronOMJob.getSpec().setTimeZone("America/New_York");

    UpdateControl<CronOMJobResource> result = reconciler.reconcile(cronOMJob, context);

    assertNotNull(result);
    assertNotNull(cronOMJob.getStatus());
  }

  @Test
  void testUpdateErrorStatus() {
    Exception error = new RuntimeException("Test error");

    var result = reconciler.updateErrorStatus(cronOMJob, context, error);

    assertNotNull(result);
    assertNotNull(cronOMJob.getStatus());
    assertEquals("Error: Test error", cronOMJob.getStatus().getMessage());
  }

  @Test
  void testReconcileWithBlankSchedule() {
    cronOMJob.getSpec().setSchedule("   ");

    UpdateControl<CronOMJobResource> result = reconciler.reconcile(cronOMJob, context);

    assertNotNull(result);
    assertEquals("Missing schedule", cronOMJob.getStatus().getMessage());
  }

  @Test
  void testReconcileWithNullSpec() {
    cronOMJob.setSpec(null);

    UpdateControl<CronOMJobResource> result = reconciler.reconcile(cronOMJob, context);

    assertNotNull(result);
    assertEquals("Missing schedule", cronOMJob.getStatus().getMessage());
  }

  private CronOMJobResource createTestCronOMJob(String name, String schedule) {
    CronOMJobResource cronOMJob = new CronOMJobResource();

    ObjectMeta metadata = new ObjectMeta();
    metadata.setName(name);
    metadata.setNamespace("test-namespace");
    metadata.setLabels(Map.of("app", "test"));
    cronOMJob.setMetadata(metadata);

    CronOMJobSpec spec = new CronOMJobSpec();
    spec.setSchedule(schedule);
    spec.setTimeZone("UTC");
    spec.setStartingDeadlineSeconds(300);

    OMJobSpec omJobSpec = new OMJobSpec();
    OMJobSpec.OMJobPodSpec mainPodSpec = new OMJobSpec.OMJobPodSpec();
    mainPodSpec.setImage("test-image:latest");
    omJobSpec.setMainPodSpec(mainPodSpec);

    OMJobSpec.OMJobPodSpec exitHandlerSpec = new OMJobSpec.OMJobPodSpec();
    exitHandlerSpec.setImage("test-image:latest");
    omJobSpec.setExitHandlerSpec(exitHandlerSpec);

    spec.setOmJobSpec(omJobSpec);
    cronOMJob.setSpec(spec);

    return cronOMJob;
  }
}
