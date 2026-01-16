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

package org.openmetadata.operator;

import io.javaoperatorsdk.operator.Operator;
import io.javaoperatorsdk.operator.api.config.ConfigurationService;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.Configuration;
import io.kubernetes.client.openapi.apis.VersionApi;
import io.kubernetes.client.util.Config;
import org.openmetadata.operator.config.OperatorConfig;
import org.openmetadata.operator.controller.CronOMJobReconciler;
import org.openmetadata.operator.controller.OMJobReconciler;
import org.openmetadata.operator.service.HealthCheckService;
import org.openmetadata.operator.service.HealthCheckService.HealthStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Main application class for the OMJob Kubernetes operator.
 *
 * This operator watches OMJob custom resources and orchestrates a two-stage
 * execution pattern:
 * 1. Creates and monitors main ingestion pod
 * 2. After main pod completion (ANY reason), creates exit handler pod
 *
 * This guarantees exit handler execution for all termination scenarios,
 * addressing limitations of Kubernetes preStop lifecycle hooks.
 */
public class OMJobOperatorApplication {

  private static final Logger LOG = LoggerFactory.getLogger(OMJobOperatorApplication.class);

  /**
   * Check K8s API connectivity by fetching the server version.
   * This is a lightweight call that verifies the API server is reachable.
   */
  private static HealthStatus checkK8sApi(VersionApi versionApi) {
    try {
      versionApi.getCode();
      return new HealthStatus(true, true, "OK");
    } catch (Exception e) {
      LOG.warn("K8s API health check failed: {}", e.getMessage());
      LOG.debug("K8s API health check exception details", e);
      return new HealthStatus(false, false, "K8s API unreachable: " + e.getMessage());
    }
  }

  public static void main(String[] args) {
    HealthCheckService healthService = null;

    try {
      LOG.info("Starting OMJob Operator...");

      // Load operator configuration
      OperatorConfig operatorConfig = new OperatorConfig();
      LOG.info("Operator configuration: {}", operatorConfig);

      // Start health check service
      healthService = new HealthCheckService(operatorConfig.getHealthCheckPort());
      healthService.start();

      // Initialize Kubernetes client
      ApiClient client = Config.defaultClient();
      Configuration.setDefaultApiClient(client);

      // Get watch namespaces from environment (comma-separated list or "ALL" for all namespaces)
      String watchNamespaces = System.getenv().getOrDefault("WATCH_NAMESPACES", "ALL");
      LOG.info("WATCH_NAMESPACES environment variable: {}", watchNamespaces);

      if (!"ALL".equals(watchNamespaces)) {
        LOG.info("Configuring operator to watch specific namespaces: {}", watchNamespaces);
      } else {
        LOG.info("Configuring operator to watch all namespaces");
      }

      // Configure operator
      // Note: Namespace watching will be implemented in a future version
      // For now, the operator watches all namespaces but logs the configuration
      ConfigurationService configuration =
          ConfigurationService.newOverriddenConfigurationService(
              overrider ->
                  overrider
                      .checkingCRDAndValidateLocalModel(false) // CRD is installed via Helm
                      .withConcurrentReconciliationThreads(
                          5) // Allow multiple concurrent reconciliations
              );

      // Create and configure operator
      Operator operator = new Operator(configuration);

      // Register OMJob reconciler with namespace configuration
      OMJobReconciler reconciler = new OMJobReconciler(operatorConfig);
      CronOMJobReconciler cronReconciler = new CronOMJobReconciler(operatorConfig);
      if (!"ALL".equals(watchNamespaces) && !watchNamespaces.isEmpty()) {
        String targetNamespace = watchNamespaces.trim();
        // Note: Java Operator SDK only supports watching a single specific namespace or all
        // namespaces
        // If multiple namespaces are provided (comma-separated), we'll use the first one
        if (targetNamespace.contains(",")) {
          targetNamespace = targetNamespace.split(",")[0].trim();
          LOG.warn(
              "Multiple namespaces specified but operator SDK only supports single namespace watching. Using first namespace: {}",
              targetNamespace);
        }
        final String namespace = targetNamespace;
        LOG.info("Registering reconciler for namespace: {}", namespace);
        operator.register(reconciler, config -> config.settingNamespace(namespace));
        operator.register(cronReconciler, config -> config.settingNamespace(namespace));
      } else {
        LOG.info("Registering reconciler for all namespaces");
        operator.register(reconciler);
        operator.register(cronReconciler);
      }

      // Start operator
      operator.start();

      // Configure K8s API health check
      VersionApi versionApi = new VersionApi(client);
      healthService.setK8sHealthCheck(() -> checkK8sApi(versionApi));

      // Mark as ready after successful startup
      healthService.setReady(true);

      LOG.info("OMJob Operator started successfully");

      if (!"ALL".equals(watchNamespaces) && !watchNamespaces.isEmpty()) {
        LOG.info("Watching for OMJob resources in namespace: {}", watchNamespaces);
      } else {
        LOG.info("Watching for OMJob resources in all namespaces...");
      }

      // Keep reference to health service for shutdown
      final HealthCheckService finalHealthService = healthService;

      // Keep operator running
      Runtime.getRuntime()
          .addShutdownHook(
              new Thread(
                  () -> {
                    LOG.info("Shutting down OMJob Operator...");
                    finalHealthService.setReady(false);
                    operator.stop();
                    finalHealthService.stop();
                    LOG.info("OMJob Operator stopped");
                  }));

      // Block main thread to keep operator alive
      Thread.currentThread().join();

    } catch (Exception e) {
      LOG.error("Failed to start OMJob Operator", e);
      if (healthService != null) {
        healthService.stop();
      }
      System.exit(1);
    }
  }
}
