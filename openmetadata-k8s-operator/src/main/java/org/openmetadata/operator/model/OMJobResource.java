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

package org.openmetadata.operator.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.fabric8.kubernetes.api.model.Namespaced;
import io.fabric8.kubernetes.client.CustomResource;
import io.fabric8.kubernetes.model.annotation.Group;
import io.fabric8.kubernetes.model.annotation.Kind;
import io.fabric8.kubernetes.model.annotation.Plural;
import io.fabric8.kubernetes.model.annotation.Singular;
import io.fabric8.kubernetes.model.annotation.Version;

/**
 * Kubernetes Custom Resource for OMJob.
 *
 * This class represents the OMJob custom resource that the operator watches.
 * It uses the same structure as the K8sPipelineClient OMJob model but with
 * Fabric8 annotations for Kubernetes integration.
 */
@Group("pipelines.openmetadata.org")
@Version("v1")
@Kind("OMJob")
@Plural("omjobs")
@Singular("omjob")
public class OMJobResource extends CustomResource<OMJobSpec, OMJobStatus> implements Namespaced {

  public OMJobResource() {
    super();
  }

  /**
   * Get the pipeline name from labels
   */
  @JsonIgnore
  public String getPipelineName() {
    if (getMetadata() != null && getMetadata().getLabels() != null) {
      return getMetadata().getLabels().get("app.kubernetes.io/pipeline");
    }
    return null;
  }

  /**
   * Get the run ID from labels
   */
  @JsonIgnore
  public String getRunId() {
    if (getMetadata() != null && getMetadata().getLabels() != null) {
      return getMetadata().getLabels().get("app.kubernetes.io/run-id");
    }
    return null;
  }

  /**
   * Check if this OMJob is in a terminal state
   */
  @JsonIgnore
  public boolean isTerminal() {
    return getStatus() != null
        && getStatus().getPhase() != null
        && getStatus().getPhase().isTerminal();
  }

  /**
   * Check if cleanup should be performed based on TTL
   */
  @JsonIgnore
  public boolean shouldCleanup() {
    if (!isTerminal() || getStatus() == null || getStatus().getCompletionTime() == null) {
      return false;
    }

    Integer ttl = getSpec() != null ? getSpec().getTtlSecondsAfterFinished() : null;
    if (ttl == null || ttl <= 0) {
      return false;
    }

    long completionTime = getStatus().getCompletionTime().getEpochSecond();
    long currentTime = System.currentTimeMillis() / 1000;

    return (currentTime - completionTime) > ttl;
  }
}
