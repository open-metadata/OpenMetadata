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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.openapi.models.V1LocalObjectReference;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.sdk.exception.PipelineServiceClientException;

@Slf4j
@Getter
public class K8sPipelineClientConfig {

  // Config keys
  private static final String NAMESPACE_KEY = "namespace";
  private static final String INGESTION_IMAGE_KEY = "ingestionImage";
  private static final String IMAGE_PULL_POLICY_KEY = "imagePullPolicy";
  private static final String IMAGE_PULL_SECRETS_KEY = "imagePullSecrets";
  private static final String SERVICE_ACCOUNT_KEY = "serviceAccountName";
  private static final String RESOURCES_KEY = "resources";
  private static final String TTL_SECONDS_KEY = "ttlSecondsAfterFinished";
  private static final String ACTIVE_DEADLINE_KEY = "activeDeadlineSeconds";
  private static final String BACKOFF_LIMIT_KEY = "backoffLimit";
  private static final String SUCCESS_HISTORY_KEY = "successfulJobsHistoryLimit";
  private static final String FAILED_HISTORY_KEY = "failedJobsHistoryLimit";
  private static final String NODE_SELECTOR_KEY = "nodeSelector";
  private static final String RUN_AS_USER_KEY = "runAsUser";
  private static final String RUN_AS_GROUP_KEY = "runAsGroup";
  private static final String FS_GROUP_KEY = "fsGroup";
  private static final String RUN_AS_NON_ROOT_KEY = "runAsNonRoot";
  private static final String EXTRA_ENV_VARS_KEY = "extraEnvVars";
  private static final String POD_ANNOTATIONS_KEY = "podAnnotations";
  private static final String STARTING_DEADLINE_SECONDS_KEY = "startingDeadlineSeconds";
  private static final String SKIP_INIT_KEY = "skipInit";

  // Default resources configuration
  private static final String DEFAULT_REQUESTS_CPU = "500m";
  private static final String DEFAULT_REQUESTS_MEMORY = "1Gi";
  private static final String DEFAULT_LIMITS_CPU = "2";
  private static final String DEFAULT_LIMITS_MEMORY = "4Gi";

  // Configuration fields
  private final String namespace;
  private final String ingestionImage;
  private final String imagePullPolicy;
  private final List<V1LocalObjectReference> imagePullSecrets;
  private final String serviceAccountName;
  private final K8sResources.ResourcesConfiguration resources;
  private final int ttlSecondsAfterFinished;
  private final long activeDeadlineSeconds;
  private final int backoffLimit;
  private final int successfulJobsHistoryLimit;
  private final int failedJobsHistoryLimit;
  private final Map<String, String> nodeSelector;

  // Security context configuration
  private final Long runAsUser;
  private final Long runAsGroup;
  private final Long fsGroup;
  private final boolean runAsNonRoot;

  // Extra configuration
  private final Map<String, String> extraEnvVars;
  private final Map<String, String> podAnnotations;
  private final int startingDeadlineSeconds;
  private final boolean skipInit;

  public K8sPipelineClientConfig(Map<String, Object> params) {
    if (params == null) {
      params = new HashMap<>();
    }

    this.namespace = getStringParam(params, NAMESPACE_KEY, "openmetadata-pipelines");
    this.ingestionImage =
        getStringParam(
            params, INGESTION_IMAGE_KEY, "docker.getcollate.io/openmetadata/ingestion:latest");
    this.imagePullPolicy = getStringParam(params, IMAGE_PULL_POLICY_KEY, "IfNotPresent");
    this.imagePullSecrets =
        parseImagePullSecrets(getStringParam(params, IMAGE_PULL_SECRETS_KEY, ""));
    this.serviceAccountName = getStringParam(params, SERVICE_ACCOUNT_KEY, "openmetadata-ingestion");

    // Parse resources configuration
    LinkedHashMap<String, LinkedHashMap<String, String>> rawResources =
        parseLinkedHashMapSafely(params.get(RESOURCES_KEY));
    this.resources = parseResourcesConfiguration(rawResources);

    this.ttlSecondsAfterFinished = getIntParam(params, TTL_SECONDS_KEY, 604800); // 1 week
    this.activeDeadlineSeconds = getIntParam(params, ACTIVE_DEADLINE_KEY, 7200);
    this.backoffLimit = getIntParam(params, BACKOFF_LIMIT_KEY, 3);
    this.successfulJobsHistoryLimit = getIntParam(params, SUCCESS_HISTORY_KEY, 3);
    this.failedJobsHistoryLimit = getIntParam(params, FAILED_HISTORY_KEY, 3);
    this.nodeSelector = parseNodeSelector(getStringParam(params, NODE_SELECTOR_KEY, ""));

    // Security context - default to running as non-root user 1000
    this.runAsUser = getLongParam(params, RUN_AS_USER_KEY, 1000L);
    this.runAsGroup = getLongParam(params, RUN_AS_GROUP_KEY, 1000L);
    this.fsGroup = getLongParam(params, FS_GROUP_KEY, 1000L);
    this.runAsNonRoot = Boolean.parseBoolean(getStringParam(params, RUN_AS_NON_ROOT_KEY, "true"));

    // Extra configuration - parse as list like Argo does
    List<String> rawExtraEnvs = parseListSafely(params.get(EXTRA_ENV_VARS_KEY));
    this.extraEnvVars = getConfigMap(rawExtraEnvs, ":");
    this.podAnnotations = parseKeyValuePairs(getStringParam(params, POD_ANNOTATIONS_KEY, ""));
    // Default to 0 seconds - prevents CronJobs from trying to catch up any missed executions
    // This eliminates duplicate executions when AutoPilot deploys pipelines
    this.startingDeadlineSeconds = getIntParam(params, STARTING_DEADLINE_SECONDS_KEY, 60);
    this.skipInit = Boolean.parseBoolean(getStringParam(params, SKIP_INIT_KEY, "false"));

    // Validate configuration
    validateConfiguration();

    LOG.info(
        "K8sPipelineClientConfig initialized - namespace: {}, image: {}",
        namespace,
        ingestionImage);
  }

  public void validateConfiguration() {
    List<String> errors = new ArrayList<>();

    // Validate image format
    if (StringUtils.isBlank(ingestionImage)) {
      errors.add("ingestionImage cannot be blank");
    } else if (!ingestionImage.matches("^[a-zA-Z0-9][a-zA-Z0-9._/-]*:[a-zA-Z0-9._-]+$")
        && !ingestionImage.matches("^[a-zA-Z0-9][a-zA-Z0-9._/-]*$")) {
      LOG.warn("ingestionImage '{}' may not be a valid container image reference", ingestionImage);
    }

    // Validate namespace format
    if (StringUtils.isBlank(namespace)) {
      errors.add("namespace cannot be blank");
    } else if (!namespace.matches("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")) {
      errors.add(
          String.format(
              "namespace '%s' is invalid - must be lowercase alphanumeric with hyphens",
              namespace));
    }

    // Validate resource quantities
    try {
      new Quantity(resources.requests().cpu()).getNumber();
      new Quantity(resources.requests().memory()).getNumber();
      new Quantity(resources.limits().cpu()).getNumber();
      new Quantity(resources.limits().memory()).getNumber();
    } catch (Exception e) {
      errors.add("Invalid resource quantity format: " + e.getMessage());
    }

    // Validate numeric ranges
    if (ttlSecondsAfterFinished < 0) {
      errors.add("ttlSecondsAfterFinished must be non-negative");
    }
    if (activeDeadlineSeconds <= 0) {
      errors.add("activeDeadlineSeconds must be positive");
    }
    if (backoffLimit < 0) {
      errors.add("backoffLimit must be non-negative");
    }
    if (startingDeadlineSeconds < 0) {
      errors.add(
          "startingDeadlineSeconds must be non-negative (0 = no catch-up, >0 = catch-up window)");
    }

    if (!errors.isEmpty()) {
      throw new PipelineServiceClientException(
          "Invalid K8sPipelineClient configuration: " + String.join("; ", errors));
    }
  }

  private String getStringParam(Map<String, Object> params, String key, String defaultValue) {
    Object value = params.get(key);
    if (value == null) {
      return defaultValue;
    }
    return value.toString();
  }

  private int getIntParam(Map<String, Object> params, String key, int defaultValue) {
    Object value = params.get(key);
    if (value == null) {
      return defaultValue;
    }
    try {
      return Integer.parseInt(value.toString());
    } catch (NumberFormatException e) {
      return defaultValue;
    }
  }

  private Long getLongParam(Map<String, Object> params, String key, Long defaultValue) {
    Object value = params.get(key);
    if (value == null) {
      return defaultValue;
    }
    try {
      return Long.parseLong(value.toString());
    } catch (NumberFormatException e) {
      return defaultValue;
    }
  }

  private List<V1LocalObjectReference> parseImagePullSecrets(String secrets) {
    if (StringUtils.isBlank(secrets)) {
      return new ArrayList<>();
    }
    return java.util.Arrays.stream(secrets.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .map(s -> new V1LocalObjectReference().name(s))
        .collect(Collectors.toList());
  }

  private Map<String, String> parseNodeSelector(String nodeSelectorStr) {
    return parseKeyValuePairs(nodeSelectorStr);
  }

  private Map<String, String> parseKeyValuePairs(String pairsStr) {
    Map<String, String> result = new HashMap<>();
    if (StringUtils.isBlank(pairsStr)) {
      return result;
    }
    // Expected format: key1=value1,key2=value2
    for (String pair : pairsStr.split(",")) {
      String[] kv = pair.split("=", 2);
      if (kv.length == 2) {
        result.put(kv[0].trim(), kv[1].trim());
      }
    }
    return result;
  }

  @SuppressWarnings("unchecked")
  private static LinkedHashMap<String, LinkedHashMap<String, String>> parseLinkedHashMapSafely(
      Object value) {
    if (value == null) {
      return new LinkedHashMap<>();
    }
    try {
      if (value instanceof LinkedHashMap) {
        return (LinkedHashMap<String, LinkedHashMap<String, String>>) value;
      } else if (value instanceof Map) {
        LinkedHashMap<String, LinkedHashMap<String, String>> result = new LinkedHashMap<>();
        Map<?, ?> rawMap = (Map<?, ?>) value;
        for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
          if (entry.getKey() != null && entry.getValue() instanceof Map) {
            String key = entry.getKey().toString();
            Map<?, ?> nestedMap = (Map<?, ?>) entry.getValue();
            LinkedHashMap<String, String> nestedResult = new LinkedHashMap<>();
            for (Map.Entry<?, ?> nestedEntry : nestedMap.entrySet()) {
              if (nestedEntry.getKey() != null && nestedEntry.getValue() != null) {
                nestedResult.put(
                    nestedEntry.getKey().toString(), nestedEntry.getValue().toString());
              }
            }
            result.put(key, nestedResult);
          }
        }
        return result;
      } else {
        LOG.warn("Expected Map but got {}, using empty map", value.getClass());
        return new LinkedHashMap<>();
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse map value [{}], using empty map: {}", value, e.getMessage());
      return new LinkedHashMap<>();
    }
  }

  private K8sResources.ResourcesConfiguration parseResourcesConfiguration(
      LinkedHashMap<String, LinkedHashMap<String, String>> rawResources) {
    // Provide defaults if no resources configuration is provided
    LinkedHashMap<String, String> requests = rawResources.get("requests");
    LinkedHashMap<String, String> limits = rawResources.get("limits");

    if (requests == null) {
      requests = new LinkedHashMap<>();
    }
    if (limits == null) {
      limits = new LinkedHashMap<>();
    }

    K8sResources.ResourcesInternalConfiguration requestsConfig =
        new K8sResources.ResourcesInternalConfiguration(
            requests.getOrDefault("cpu", DEFAULT_REQUESTS_CPU),
            requests.getOrDefault("memory", DEFAULT_REQUESTS_MEMORY));

    K8sResources.ResourcesInternalConfiguration limitsConfig =
        new K8sResources.ResourcesInternalConfiguration(
            limits.getOrDefault("cpu", DEFAULT_LIMITS_CPU),
            limits.getOrDefault("memory", DEFAULT_LIMITS_MEMORY));

    return new K8sResources.ResourcesConfiguration(limitsConfig, requestsConfig);
  }

  @SuppressWarnings("unchecked")
  private static List<String> parseListSafely(Object value) {
    if (value == null) {
      return List.of();
    }
    try {
      if (value instanceof List) {
        List<?> rawList = (List<?>) value;
        return rawList.stream()
            .filter(Objects::nonNull)
            .map(Object::toString)
            .filter(s -> !nullOrEmpty(s))
            .collect(Collectors.toList());
      } else if (value instanceof String) {
        // Handle case where Parameters serializes Lists to comma-separated strings
        String strValue = (String) value;
        if (strValue.trim().isEmpty()) {
          return List.of();
        }
        return Arrays.stream(strValue.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toList());
      } else {
        LOG.warn("Expected List or String but got {}, using empty list", value.getClass());
        return List.of();
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse list value [{}], using empty list: {}", value, e.getMessage());
      return List.of();
    }
  }

  private static Map<String, String> getConfigMap(List<String> rawMap, String separator) {
    Map<String, String> map = new HashMap<>();
    if (nullOrEmpty(rawMap)) {
      return map;
    }
    rawMap.forEach(
        keyValue -> {
          try {
            // Split with limit=2 to handle values containing the separator (e.g., URLs with colons)
            String[] parts = keyValue.split(separator, 2);
            map.put(parts[0], parts[1]);
          } catch (Exception e) {
            LOG.error(
                String.format(
                    "Could not extract config map [%s] due to [%s]", keyValue, e.getMessage()));
          }
        });
    return map;
  }

  // Convenience methods to get K8s Quantity objects for backward compatibility
  public Map<String, Quantity> getResourceRequests() {
    Map<String, Quantity> requests = new HashMap<>();
    requests.put("cpu", new Quantity(resources.requests().cpu()));
    requests.put("memory", new Quantity(resources.requests().memory()));
    return requests;
  }

  public Map<String, Quantity> getResourceLimits() {
    Map<String, Quantity> limits = new HashMap<>();
    limits.put("cpu", new Quantity(resources.limits().cpu()));
    limits.put("memory", new Quantity(resources.limits().memory()));
    return limits;
  }

  public boolean isSkipInit() {
    return skipInit;
  }

  public Map<String, String> getExtraEnvVars() {
    return extraEnvVars;
  }
}
