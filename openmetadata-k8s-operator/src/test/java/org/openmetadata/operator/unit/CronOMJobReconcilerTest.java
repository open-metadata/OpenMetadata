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
import io.fabric8.kubernetes.api.model.Toleration;
import io.fabric8.kubernetes.api.model.TolerationBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.MixedOperation;
import io.fabric8.kubernetes.client.dsl.NamespaceableResource;
import io.fabric8.kubernetes.client.dsl.Resource;
import io.javaoperatorsdk.operator.api.reconciler.Context;
import io.javaoperatorsdk.operator.api.reconciler.UpdateControl;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.operator.controller.CronOMJobReconciler;
import org.openmetadata.operator.model.CronOMJobResource;
import org.openmetadata.operator.model.CronOMJobSpec;
import org.openmetadata.operator.model.CronOMJobStatus;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.model.OMJobSpec;

@ExtendWith(MockitoExtension.class)
class CronOMJobReconcilerTest {

  @Mock private Context<CronOMJobResource> context;
  @Mock private KubernetesClient client;
  @Mock private MixedOperation mixedOp;
  @Mock private NamespaceableResource namespaceable;
  @Mock private Resource resource;

  private CronOMJobReconciler reconciler;
  private CronOMJobResource cronOMJob;

  @SuppressWarnings("unchecked")
  @BeforeEach
  void setUp() {
    reconciler = new CronOMJobReconciler();
    cronOMJob = createTestCronOMJob("test-cronjob", "0 * * * *");

    // Stub the client chain so tests that reach the happy path
    // (time-dependent) don't NPE. Lenient because most tests
    // return early before calling context.getClient().
    lenient().when(context.getClient()).thenReturn(client);
    lenient().when(client.resources(any(Class.class))).thenReturn(mixedOp);
    lenient().when(mixedOp.inNamespace(any())).thenReturn(mixedOp);
    lenient().when(mixedOp.resource(any())).thenReturn(namespaceable);
    lenient().when(namespaceable.create()).thenReturn(null);
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

  @Test
  @SuppressWarnings("unchecked")
  void testReconcilePropagatesTolerationsFromCronOMJobToScheduledOMJob() {
    List<Toleration> tolerations =
        List.of(
            new TolerationBuilder()
                .withKey("dedicated")
                .withOperator("Equal")
                .withValue("ingestion")
                .withEffect("NoSchedule")
                .build(),
            new TolerationBuilder()
                .withKey("gpu")
                .withOperator("Exists")
                .withEffect("NoExecute")
                .withTolerationSeconds(300L)
                .build());

    cronOMJob.getSpec().getOmJobSpec().getMainPodSpec().setTolerations(tolerations);
    cronOMJob.getSpec().getOmJobSpec().getExitHandlerSpec().setTolerations(tolerations);

    cronOMJob.getSpec().setSchedule("* * * * *");
    cronOMJob.getSpec().setStartingDeadlineSeconds(86400);

    reconciler.reconcile(cronOMJob, context);

    ArgumentCaptor<OMJobResource> captor = ArgumentCaptor.forClass(OMJobResource.class);
    verify(mixedOp).resource(captor.capture());
    OMJobResource scheduled = captor.getValue();

    assertNotNull(scheduled.getSpec(), "Scheduled OMJob spec must not be null");
    assertNotNull(
        scheduled.getSpec().getMainPodSpec().getTolerations(),
        "Main pod tolerations must be propagated from CronOMJob template");
    assertEquals(2, scheduled.getSpec().getMainPodSpec().getTolerations().size());
    assertEquals(
        "dedicated", scheduled.getSpec().getMainPodSpec().getTolerations().get(0).getKey());
    assertEquals(
        "NoSchedule", scheduled.getSpec().getMainPodSpec().getTolerations().get(0).getEffect());
    assertEquals("gpu", scheduled.getSpec().getMainPodSpec().getTolerations().get(1).getKey());
    assertEquals(
        Long.valueOf(300L),
        scheduled.getSpec().getMainPodSpec().getTolerations().get(1).getTolerationSeconds());

    assertNotNull(
        scheduled.getSpec().getExitHandlerSpec().getTolerations(),
        "Exit handler tolerations must be propagated from CronOMJob template");
    assertEquals(2, scheduled.getSpec().getExitHandlerSpec().getTolerations().size());
  }

  @Test
  @SuppressWarnings("unchecked")
  void testReconcileLeavesTolerationsNullWhenSourceHasNone() {
    cronOMJob.getSpec().getOmJobSpec().getMainPodSpec().setTolerations(null);
    cronOMJob.getSpec().getOmJobSpec().getExitHandlerSpec().setTolerations(null);

    cronOMJob.getSpec().setSchedule("* * * * *");
    cronOMJob.getSpec().setStartingDeadlineSeconds(86400);

    reconciler.reconcile(cronOMJob, context);

    ArgumentCaptor<OMJobResource> captor = ArgumentCaptor.forClass(OMJobResource.class);
    verify(mixedOp).resource(captor.capture());
    OMJobResource scheduled = captor.getValue();

    assertNull(
        scheduled.getSpec().getMainPodSpec().getTolerations(),
        "Main pod tolerations must remain null when CronOMJob has none");
    assertNull(
        scheduled.getSpec().getExitHandlerSpec().getTolerations(),
        "Exit handler tolerations must remain null when CronOMJob has none");
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
