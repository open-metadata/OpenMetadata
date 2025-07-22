/*
 *  Copyright 2025 Collate
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
package org.openmetadata.service.secrets;

import com.google.common.annotations.VisibleForTesting;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.Configuration;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1Secret;
import io.kubernetes.client.util.ClientBuilder;
import io.kubernetes.client.util.Config;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.exception.SecretsManagerUpdateException;

/**
 * Kubernetes implementation of the SecretsManager.
 * This implementation stores secrets as Kubernetes Secret objects.
 */
@Slf4j
public class KubernetesSecretsManager extends ExternalSecretsManager {
  private static final String NAMESPACE = "namespace";
  private static final String KUBECONFIG_PATH = "kubeconfigPath";
  private static final String IN_CLUSTER = "inCluster";
  private static final String SKIP_INIT = "skipInit";
  private static final String DEFAULT_NAMESPACE = "default";
  private static final String SECRET_KEY = "value";

  private static KubernetesSecretsManager instance = null;
  @Getter private CoreV1Api apiClient;
  private String namespace;

  private KubernetesSecretsManager(SecretsConfig secretsConfig) {
    super(SecretsManagerProvider.KUBERNETES, secretsConfig, 100);

    // Check if we should skip initialization (for testing)
    boolean skipInit =
        Boolean.parseBoolean(
            (String)
                secretsConfig
                    .parameters()
                    .getAdditionalProperties()
                    .getOrDefault(SKIP_INIT, "false"));

    if (!skipInit) {
      initializeKubernetesClient();
    }
  }

  public static KubernetesSecretsManager getInstance(SecretsConfig secretsConfig) {
    if (instance == null) {
      instance = new KubernetesSecretsManager(secretsConfig);
    }
    return instance;
  }

  private void initializeKubernetesClient() {
    try {
      ApiClient client;

      boolean inCluster =
          Boolean.parseBoolean(
              (String)
                  getSecretsConfig()
                      .parameters()
                      .getAdditionalProperties()
                      .getOrDefault(IN_CLUSTER, "false"));

      if (inCluster) {
        client = ClientBuilder.cluster().build();
        LOG.info("Using in-cluster Kubernetes configuration");
      } else {
        String kubeconfigPath =
            (String) getSecretsConfig().parameters().getAdditionalProperties().get(KUBECONFIG_PATH);
        if (StringUtils.isNotBlank(kubeconfigPath)) {
          client = Config.fromConfig(kubeconfigPath);
          LOG.info("Using kubeconfig from path: {}", kubeconfigPath);
        } else {
          // Default to ~/.kube/config
          client = Config.defaultClient();
          LOG.info("Using default kubeconfig");
        }
      }

      Configuration.setDefaultApiClient(client);
      this.apiClient = new CoreV1Api(client);

      // Set namespace
      this.namespace =
          (String)
              getSecretsConfig()
                  .parameters()
                  .getAdditionalProperties()
                  .getOrDefault(NAMESPACE, DEFAULT_NAMESPACE);
      LOG.info("Kubernetes SecretsManager initialized with namespace: {}", namespace);

    } catch (IOException e) {
      throw new SecretsManagerException("Failed to initialize Kubernetes client", e);
    }
  }

  @Override
  protected void storeSecret(String secretName, String secretValue) {
    String k8sSecretName = sanitizeSecretName(secretName);

    try {
      V1Secret secret = new V1Secret();
      V1ObjectMeta metadata = new V1ObjectMeta();
      metadata.setName(k8sSecretName);
      metadata.setNamespace(namespace);

      Map<String, String> labels = new HashMap<>();
      labels.put("app", "openmetadata");
      labels.put("managed-by", "openmetadata-secrets-manager");
      if (getSecretsConfig().tags() != null && !getSecretsConfig().tags().isEmpty()) {
        // Convert tags list to map if needed
        getSecretsConfig()
            .tags()
            .forEach(
                tag -> {
                  String[] parts = tag.split(":", 2);
                  if (parts.length == 2) {
                    labels.put(parts[0], parts[1]);
                  }
                });
      }
      metadata.setLabels(labels);
      secret.setMetadata(metadata);

      Map<String, byte[]> data = new HashMap<>();
      data.put(SECRET_KEY, secretValue.getBytes(StandardCharsets.UTF_8));
      secret.setData(data);

      apiClient.createNamespacedSecret(namespace, secret).execute();
      LOG.debug("Created Kubernetes secret: {}", k8sSecretName);

    } catch (ApiException e) {
      throw new SecretsManagerException(
          String.format("Failed to create Kubernetes secret: %s", k8sSecretName), e);
    }
  }

  @Override
  protected void updateSecret(String secretName, String secretValue) {
    String k8sSecretName = sanitizeSecretName(secretName);

    try {
      // Get existing secret
      V1Secret existingSecret = apiClient.readNamespacedSecret(k8sSecretName, namespace).execute();

      // Update the secret data
      Map<String, byte[]> data = new HashMap<>();
      data.put(SECRET_KEY, secretValue.getBytes(StandardCharsets.UTF_8));
      existingSecret.setData(data);

      apiClient.replaceNamespacedSecret(k8sSecretName, namespace, existingSecret).execute();
      LOG.debug("Updated Kubernetes secret: {}", k8sSecretName);

    } catch (ApiException e) {
      if (e.getCode() == 404) {
        // Secret doesn't exist, create it
        LOG.debug("Secret {} not found, creating new secret", k8sSecretName);
        storeSecret(secretName, secretValue);
      } else {
        throw new SecretsManagerUpdateException(
            String.format("Failed to update Kubernetes secret: %s", k8sSecretName), e);
      }
    }
  }

  @Override
  protected String getSecret(String secretName) {
    String k8sSecretName = sanitizeSecretName(secretName);

    try {
      V1Secret secret = apiClient.readNamespacedSecret(k8sSecretName, namespace).execute();

      if (secret.getData() != null && secret.getData().containsKey(SECRET_KEY)) {
        byte[] secretData = secret.getData().get(SECRET_KEY);
        return new String(secretData, StandardCharsets.UTF_8);
      }

      LOG.warn("Secret {} exists but has no data", k8sSecretName);
      return null;

    } catch (ApiException e) {
      if (e.getCode() == 404) {
        LOG.debug("Secret {} not found", k8sSecretName);
        return null;
      }
      throw new SecretsManagerException(
          String.format("Failed to retrieve Kubernetes secret: %s", k8sSecretName), e);
    }
  }

  @Override
  public boolean existSecret(String secretName) {
    String k8sSecretName = sanitizeSecretName(secretName);

    try {
      apiClient.readNamespacedSecret(k8sSecretName, namespace).execute();
      return true;
    } catch (ApiException e) {
      if (e.getCode() == 404) {
        return false;
      }
      throw new SecretsManagerException(
          String.format("Failed to check existence of Kubernetes secret: %s", k8sSecretName), e);
    }
  }

  @Override
  protected void deleteSecretInternal(String secretName) {
    String k8sSecretName = sanitizeSecretName(secretName);

    try {
      apiClient.deleteNamespacedSecret(k8sSecretName, namespace).execute();
      LOG.debug("Deleted Kubernetes secret: {}", k8sSecretName);
    } catch (ApiException e) {
      if (e.getCode() != 404) {
        throw new SecretsManagerException(
            String.format("Failed to delete Kubernetes secret: %s", k8sSecretName), e);
      }
      LOG.debug("Secret {} already deleted or does not exist", k8sSecretName);
    }
  }

  /**
   * Sanitize secret name to be Kubernetes compliant.
   * Kubernetes secret names must be lowercase alphanumeric or '-',
   * and must start and end with an alphanumeric character.
   */
  private String sanitizeSecretName(String secretName) {
    // Remove leading slashes
    String sanitized = secretName.replaceAll("^/+", "");
    sanitized = sanitized.replaceAll("[^a-zA-Z0-9-]", "-");
    sanitized = sanitized.toLowerCase();
    sanitized = sanitized.replaceAll("-+", "-");
    sanitized = sanitized.replaceAll("^-+|-+$", "");

    if (sanitized.length() > 253) {
      String hash = Integer.toHexString(secretName.hashCode());
      sanitized = sanitized.substring(0, 240) + "-" + hash;
    }
    if (!sanitized.matches("^[a-z0-9].*")) {
      sanitized = "om-" + sanitized;
    }
    return sanitized;
  }

  @VisibleForTesting
  void setApiClient(CoreV1Api apiClient) {
    this.apiClient = apiClient;
  }

  @VisibleForTesting
  void setNamespace(String namespace) {
    this.namespace = namespace;
  }
}
