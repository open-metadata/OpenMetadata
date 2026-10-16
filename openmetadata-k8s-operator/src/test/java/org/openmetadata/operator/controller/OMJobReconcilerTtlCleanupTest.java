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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.operator.controller.OMJobReconciler.MESSAGE_RESOURCES_CLEANED_UP;
import static org.openmetadata.operator.controller.OMJobReconciler.REASON_RESOURCES_CLEANED_UP;
import static org.openmetadata.operator.fixtures.ServerShapedOMJobs.NAMESPACE;
import static org.openmetadata.operator.fixtures.ServerShapedOMJobs.expiredOMJob;

import io.fabric8.kubernetes.api.model.Event;
import io.javaoperatorsdk.operator.api.reconciler.Context;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.operator.config.OperatorConfig;
import org.openmetadata.operator.fixtures.InMemoryKubernetes;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.service.PodManager;

/**
 * TTL cleanup end to end through the reconciler: real PodManager and EventPublisher against an
 * API server that evaluates label selectors, with OMJobs shaped like the server's.
 */
class OMJobReconcilerTtlCleanupTest {

  private InMemoryKubernetes kubernetes;
  private OMJobReconciler reconciler;
  private Context<OMJobResource> context;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    kubernetes = InMemoryKubernetes.start();
    reconciler = new OMJobReconciler(new OperatorConfig());
    context = mock(Context.class);
    when(context.getClient()).thenReturn(kubernetes.client());
  }

  @AfterEach
  void tearDown() {
    kubernetes.close();
  }

  @Test
  void testExpiredTerminalOMJobDeletesServerLabelledPods() {
    OMJobResource omJob = expiredOMJob("om-cronomjob-mysql-metadata-1792052520");
    PodManager podManager = new PodManager(kubernetes.client());
    podManager.createMainPod(omJob);
    podManager.createExitHandlerPod(omJob);

    reconciler.reconcile(omJob, context);

    assertEquals(List.of(), kubernetes.podNames(NAMESPACE));
    assertEquals(
        List.of(String.format(MESSAGE_RESOURCES_CLEANED_UP, 2)),
        kubernetes.events(NAMESPACE, REASON_RESOURCES_CLEANED_UP).stream()
            .map(Event::getMessage)
            .toList());
  }

  @Test
  void testCleanupWithNothingLeftPublishesNoEvent() {
    OMJobResource omJob = expiredOMJob("om-cronomjob-mysql-metadata-1792052520");

    reconciler.reconcile(omJob, context);

    assertEquals(List.of(), kubernetes.events(NAMESPACE, REASON_RESOURCES_CLEANED_UP));
  }
}
