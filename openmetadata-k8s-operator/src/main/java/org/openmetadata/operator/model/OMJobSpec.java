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

import com.fasterxml.jackson.annotation.JsonProperty;
import io.fabric8.kubernetes.api.model.EnvVar;
import io.fabric8.kubernetes.api.model.LocalObjectReference;
import io.fabric8.kubernetes.api.model.PodSecurityContext;
import io.fabric8.kubernetes.api.model.ResourceRequirements;
import java.util.List;
import java.util.Map;

/**
 * Specification for OMJob custom resource.
 *
 * This mirrors the structure from K8sPipelineClient but uses Fabric8 types
 * for better Kubernetes integration.
 */
public class OMJobSpec {

  @JsonProperty("mainPodSpec")
  private OMJobPodSpec mainPodSpec;

  @JsonProperty("exitHandlerSpec")
  private OMJobPodSpec exitHandlerSpec;

  @JsonProperty("ttlSecondsAfterFinished")
  private Integer ttlSecondsAfterFinished;

  // Constructors
  public OMJobSpec() {}

  public OMJobSpec(
      OMJobPodSpec mainPodSpec, OMJobPodSpec exitHandlerSpec, Integer ttlSecondsAfterFinished) {
    this.mainPodSpec = mainPodSpec;
    this.exitHandlerSpec = exitHandlerSpec;
    this.ttlSecondsAfterFinished = ttlSecondsAfterFinished;
  }

  // Getters and setters
  public OMJobPodSpec getMainPodSpec() {
    return mainPodSpec;
  }

  public void setMainPodSpec(OMJobPodSpec mainPodSpec) {
    this.mainPodSpec = mainPodSpec;
  }

  public OMJobPodSpec getExitHandlerSpec() {
    return exitHandlerSpec;
  }

  public void setExitHandlerSpec(OMJobPodSpec exitHandlerSpec) {
    this.exitHandlerSpec = exitHandlerSpec;
  }

  public Integer getTtlSecondsAfterFinished() {
    return ttlSecondsAfterFinished;
  }

  public void setTtlSecondsAfterFinished(Integer ttlSecondsAfterFinished) {
    this.ttlSecondsAfterFinished = ttlSecondsAfterFinished;
  }

  /**
   * Pod specification for main or exit handler pods
   */
  public static class OMJobPodSpec {

    private String image;
    private String imagePullPolicy;
    private List<LocalObjectReference> imagePullSecrets;
    private String serviceAccountName;
    private List<String> command;
    private List<EnvVar> env;
    private ResourceRequirements resources;
    private Map<String, String> nodeSelector;
    private PodSecurityContext securityContext;
    private Map<String, String> labels;
    private Map<String, String> annotations;

    // Constructors
    public OMJobPodSpec() {}

    // Getters and setters
    public String getImage() {
      return image;
    }

    public void setImage(String image) {
      this.image = image;
    }

    public String getImagePullPolicy() {
      return imagePullPolicy;
    }

    public void setImagePullPolicy(String imagePullPolicy) {
      this.imagePullPolicy = imagePullPolicy;
    }

    public List<LocalObjectReference> getImagePullSecrets() {
      return imagePullSecrets;
    }

    public void setImagePullSecrets(List<LocalObjectReference> imagePullSecrets) {
      this.imagePullSecrets = imagePullSecrets;
    }

    public String getServiceAccountName() {
      return serviceAccountName;
    }

    public void setServiceAccountName(String serviceAccountName) {
      this.serviceAccountName = serviceAccountName;
    }

    public List<String> getCommand() {
      return command;
    }

    public void setCommand(List<String> command) {
      this.command = command;
    }

    public List<EnvVar> getEnv() {
      return env;
    }

    public void setEnv(List<EnvVar> env) {
      this.env = env;
    }

    public ResourceRequirements getResources() {
      return resources;
    }

    public void setResources(ResourceRequirements resources) {
      this.resources = resources;
    }

    public Map<String, String> getNodeSelector() {
      return nodeSelector;
    }

    public void setNodeSelector(Map<String, String> nodeSelector) {
      this.nodeSelector = nodeSelector;
    }

    public PodSecurityContext getSecurityContext() {
      return securityContext;
    }

    public void setSecurityContext(PodSecurityContext securityContext) {
      this.securityContext = securityContext;
    }

    public Map<String, String> getLabels() {
      return labels;
    }

    public void setLabels(Map<String, String> labels) {
      this.labels = labels;
    }

    public Map<String, String> getAnnotations() {
      return annotations;
    }

    public void setAnnotations(Map<String, String> annotations) {
      this.annotations = annotations;
    }
  }
}
