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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.operator.fixtures.ServerShapedOMJobs.NAMESPACE;
import static org.openmetadata.operator.fixtures.ServerShapedOMJobs.SERVER_POD_LABELS;
import static org.openmetadata.operator.fixtures.ServerShapedOMJobs.serverShapedOMJob;

import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.PodBuilder;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.operator.fixtures.InMemoryKubernetes;
import org.openmetadata.operator.model.OMJobResource;

/**
 * Pod lookup and cleanup against an API server that evaluates label selectors, using OMJobs
 * shaped like the server's. The OMJob status never records pod names here, so the by-name
 * fallbacks cannot hide a selector that misses.
 */
class PodManagerLabelSelectionTest {

  private InMemoryKubernetes kubernetes;
  private PodManager podManager;

  @BeforeEach
  void setUp() {
    kubernetes = InMemoryKubernetes.start();
    podManager = new PodManager(kubernetes.client());
  }

  @AfterEach
  void tearDown() {
    kubernetes.close();
  }

  @Test
  void testDeletePodsRemovesPodsCarryingServerLabels() {
    OMJobResource omJob = createPodsFor("om-cronomjob-mysql-metadata-1792052520");

    List<String> deleted = podManager.deletePods(omJob);

    assertEquals(
        Set.of(
            "om-cronomjob-mysql-metadata-1792052520-main",
            "om-cronomjob-mysql-metadata-1792052520-exit"),
        Set.copyOf(deleted));
    assertEquals(List.of(), kubernetes.podNames(NAMESPACE));
  }

  @Test
  void testDeletePodsReturnsEmptyWhenAlreadyCleaned() {
    OMJobResource omJob = serverShapedOMJob("om-cronomjob-mysql-metadata-1792052520");
    omJob.getStatus().setMainPodName("om-cronomjob-mysql-metadata-1792052520-main");
    omJob.getStatus().setExitHandlerPodName("om-cronomjob-mysql-metadata-1792052520-exit");

    assertEquals(List.of(), podManager.deletePods(omJob));
  }

  @Test
  void testDeletePodsDeletesRecordedPodWhenLabelsDoNotMatch() {
    OMJobResource omJob = serverShapedOMJob("om-job-mysql-metadata-1a2b3c4d");
    String podName = "om-job-mysql-metadata-1a2b3c4d-main";
    kubernetes
        .client()
        .pods()
        .inNamespace(NAMESPACE)
        .resource(podWithoutOperatorLabels(podName))
        .create();
    omJob.getStatus().setMainPodName(podName);

    assertEquals(List.of(podName), podManager.deletePods(omJob));
    assertEquals(List.of(), kubernetes.podNames(NAMESPACE));
  }

  @Test
  void testFindsPodsByLabelWithoutRecordedNames() {
    OMJobResource omJob = createPodsFor("om-job-mysql-metadata-1a2b3c4d");

    Optional<String> mainPod =
        podManager.findMainPod(omJob).map(pod -> pod.getMetadata().getName());
    Optional<String> exitPod =
        podManager.findExitHandlerPod(omJob).map(pod -> pod.getMetadata().getName());

    assertEquals(Optional.of("om-job-mysql-metadata-1a2b3c4d-main"), mainPod);
    assertEquals(Optional.of("om-job-mysql-metadata-1a2b3c4d-exit"), exitPod);
  }

  @Test
  void testDeletePodsLeavesOtherOMJobPodsUntouched() {
    OMJobResource expired = createPodsFor("om-cronomjob-mysql-metadata-1792052520");
    createPodsFor("om-cronomjob-mysql-metadata-1792052640");

    podManager.deletePods(expired);

    assertEquals(
        List.of(
            "om-cronomjob-mysql-metadata-1792052640-exit",
            "om-cronomjob-mysql-metadata-1792052640-main"),
        kubernetes.podNames(NAMESPACE));
  }

  private Pod podWithoutOperatorLabels(String podName) {
    return new PodBuilder()
        .withNewMetadata()
        .withName(podName)
        .withNamespace(NAMESPACE)
        .withLabels(SERVER_POD_LABELS)
        .endMetadata()
        .withNewSpec()
        .addNewContainer()
        .withName("main")
        .withImage("openmetadata/ingestion:test")
        .endContainer()
        .endSpec()
        .build();
  }

  private OMJobResource createPodsFor(String omJobName) {
    OMJobResource omJob = serverShapedOMJob(omJobName);
    podManager.createMainPod(omJob);
    podManager.createExitHandlerPod(omJob);
    assertTrue(kubernetes.podNames(NAMESPACE).contains(omJobName + "-main"));
    return omJob;
  }
}
