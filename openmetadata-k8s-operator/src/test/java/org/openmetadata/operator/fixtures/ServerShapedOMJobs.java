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

package org.openmetadata.operator.fixtures;

import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.operator.model.OMJobPhase;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.model.OMJobSpec;
import org.openmetadata.operator.model.OMJobStatus;

/**
 * OMJobs shaped like the ones the OpenMetadata server creates, so tests exercise the labels real
 * pods carry instead of the operator's defaults.
 */
public final class ServerShapedOMJobs {

  public static final String NAMESPACE = "omjob-test";
  public static final int TTL_SECONDS = 60;

  /**
   * Mirrors K8sPipelineClient.buildLabels: the server puts these on the OMJob and on both pod
   * specs of every ingestion run. Its managed-by value replaces the operator's own on the pods.
   */
  public static final Map<String, String> SERVER_POD_LABELS =
      Map.of(
          "app.kubernetes.io/name", "openmetadata",
          "app.kubernetes.io/component", "ingestion",
          "app.kubernetes.io/managed-by", "openmetadata",
          "app.kubernetes.io/pipeline", "mysql-metadata",
          "app.kubernetes.io/pipeline-type", "metadata");

  private ServerShapedOMJobs() {}

  public static OMJobResource serverShapedOMJob(String name) {
    OMJobSpec spec = new OMJobSpec();
    spec.setMainPodSpec(podSpec("echo ingestion"));
    spec.setExitHandlerSpec(podSpec("echo exit handler"));
    spec.setTtlSecondsAfterFinished(TTL_SECONDS);

    OMJobResource omJob = new OMJobResource();
    omJob.setMetadata(
        new ObjectMetaBuilder()
            .withName(name)
            .withNamespace(NAMESPACE)
            .withUid(UUID.randomUUID().toString())
            .withLabels(SERVER_POD_LABELS)
            .build());
    omJob.setSpec(spec);
    omJob.setStatus(new OMJobStatus());
    return omJob;
  }

  /** A finished OMJob whose TTL ran out a few seconds ago. */
  public static OMJobResource expiredOMJob(String name) {
    OMJobResource omJob = serverShapedOMJob(name);
    omJob.getStatus().setPhase(OMJobPhase.SUCCEEDED);
    omJob.getStatus().setCompletionTime(Instant.now().minusSeconds(TTL_SECONDS + 5L));
    return omJob;
  }

  private static OMJobSpec.OMJobPodSpec podSpec(String command) {
    OMJobSpec.OMJobPodSpec podSpec = new OMJobSpec.OMJobPodSpec();
    podSpec.setImage("openmetadata/ingestion:test");
    podSpec.setImagePullPolicy("IfNotPresent");
    podSpec.setServiceAccountName("openmetadata-ingestion");
    podSpec.setCommand(List.of("sh", "-c", command));
    podSpec.setLabels(new HashMap<>(SERVER_POD_LABELS));
    return podSpec;
  }
}
