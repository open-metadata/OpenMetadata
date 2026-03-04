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

package org.openmetadata.service.clients.pipeline.k8s;

import io.kubernetes.client.openapi.models.V1EnvVar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Utility class for common K8s Job operations.
 * Centralizes logic for converting and serializing K8s resources.
 */
public final class K8sJobUtils {

  private K8sJobUtils() {
    // Utility class
  }

  /**
   * Convert V1EnvVar objects to proper map representation for Kubernetes API.
   * This ensures proper serialization of environment variables with valueFrom fields.
   *
   * @param envVars List of V1EnvVar objects to convert
   * @return List of Maps representing the environment variables, or null if input is null
   */
  public static List<Map<String, Object>> convertEnvVarsToMap(List<V1EnvVar> envVars) {
    if (envVars == null) {
      return null;
    }
    return envVars.stream().map(K8sJobUtils::convertEnvVarToMap).toList();
  }

  /**
   * Convert a single V1EnvVar to Map representation.
   * Handles all possible valueFrom sources (configMapKeyRef, secretKeyRef, fieldRef, resourceFieldRef).
   */
  private static Map<String, Object> convertEnvVarToMap(V1EnvVar envVar) {
    Map<String, Object> envMap = new HashMap<>();
    envMap.put("name", envVar.getName());

    if (envVar.getValue() != null) {
      envMap.put("value", envVar.getValue());
    }

    if (envVar.getValueFrom() != null) {
      Map<String, Object> valueFromMap = buildValueFromMap(envVar);
      // Always include valueFrom even if empty to match K8s API expectations
      envMap.put("valueFrom", valueFromMap);
    }

    return envMap;
  }

  /**
   * Build the valueFrom map from V1EnvVarSource.
   * Only includes non-null references.
   */
  private static Map<String, Object> buildValueFromMap(V1EnvVar envVar) {
    Map<String, Object> valueFromMap = new HashMap<>();
    var valueFrom = envVar.getValueFrom();

    if (valueFrom.getConfigMapKeyRef() != null) {
      var configMapRef = valueFrom.getConfigMapKeyRef();
      Map<String, Object> configMapKeyRefMap = new HashMap<>();
      configMapKeyRefMap.put("name", configMapRef.getName());
      configMapKeyRefMap.put("key", configMapRef.getKey());
      if (configMapRef.getOptional() != null) {
        configMapKeyRefMap.put("optional", configMapRef.getOptional());
      }
      valueFromMap.put("configMapKeyRef", configMapKeyRefMap);
    }

    if (valueFrom.getSecretKeyRef() != null) {
      var secretRef = valueFrom.getSecretKeyRef();
      Map<String, Object> secretKeyRefMap = new HashMap<>();
      secretKeyRefMap.put("name", secretRef.getName());
      secretKeyRefMap.put("key", secretRef.getKey());
      if (secretRef.getOptional() != null) {
        secretKeyRefMap.put("optional", secretRef.getOptional());
      }
      valueFromMap.put("secretKeyRef", secretKeyRefMap);
    }

    if (valueFrom.getFieldRef() != null) {
      var fieldRef = valueFrom.getFieldRef();
      Map<String, Object> fieldRefMap = new HashMap<>();
      fieldRefMap.put("fieldPath", fieldRef.getFieldPath());
      if (fieldRef.getApiVersion() != null) {
        fieldRefMap.put("apiVersion", fieldRef.getApiVersion());
      }
      valueFromMap.put("fieldRef", fieldRefMap);
    }

    if (valueFrom.getResourceFieldRef() != null) {
      var resourceFieldRef = valueFrom.getResourceFieldRef();
      Map<String, Object> resourceFieldRefMap = new HashMap<>();
      resourceFieldRefMap.put("resource", resourceFieldRef.getResource());
      if (resourceFieldRef.getContainerName() != null) {
        resourceFieldRefMap.put("containerName", resourceFieldRef.getContainerName());
      }
      if (resourceFieldRef.getDivisor() != null) {
        resourceFieldRefMap.put("divisor", resourceFieldRef.getDivisor());
      }
      valueFromMap.put("resourceFieldRef", resourceFieldRefMap);
    }

    return valueFromMap;
  }

  /**
   * Build a pod spec map from OMJob.OMJobPodSpec.
   * Centralizes the pod spec building logic for reuse.
   */
  public static Map<String, Object> buildPodSpecMap(OMJob.OMJobPodSpec podSpec) {
    Map<String, Object> podSpecMap = new HashMap<>();

    podSpecMap.put("image", podSpec.getImage());
    podSpecMap.put("imagePullPolicy", podSpec.getImagePullPolicy());
    podSpecMap.put("command", podSpec.getCommand());
    podSpecMap.put("env", convertEnvVarsToMap(podSpec.getEnv()));

    if (podSpec.getServiceAccountName() != null) {
      podSpecMap.put("serviceAccountName", podSpec.getServiceAccountName());
    }
    if (podSpec.getResources() != null) {
      podSpecMap.put("resources", podSpec.getResources());
    }
    if (podSpec.getImagePullSecrets() != null && !podSpec.getImagePullSecrets().isEmpty()) {
      podSpecMap.put("imagePullSecrets", podSpec.getImagePullSecrets());
    }
    if (podSpec.getNodeSelector() != null && !podSpec.getNodeSelector().isEmpty()) {
      podSpecMap.put("nodeSelector", podSpec.getNodeSelector());
    }
    if (podSpec.getSecurityContext() != null) {
      podSpecMap.put("securityContext", podSpec.getSecurityContext());
    }
    if (podSpec.getLabels() != null && !podSpec.getLabels().isEmpty()) {
      podSpecMap.put("labels", podSpec.getLabels());
    }
    if (podSpec.getAnnotations() != null && !podSpec.getAnnotations().isEmpty()) {
      podSpecMap.put("annotations", podSpec.getAnnotations());
    }

    return podSpecMap;
  }
}
