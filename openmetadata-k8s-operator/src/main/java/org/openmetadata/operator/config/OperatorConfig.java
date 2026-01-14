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

package org.openmetadata.operator.config;

/**
 * Configuration for the OMJob operator.
 *
 * This reads configuration from environment variables and provides
 * defaults for operator behavior.
 */
public class OperatorConfig {

  // Environment variable names
  private static final String ENV_OPERATOR_NAMESPACE = "OPERATOR_NAMESPACE";
  private static final String ENV_LOG_LEVEL = "LOG_LEVEL";
  private static final String ENV_RECONCILIATION_THREADS = "RECONCILIATION_THREADS";
  private static final String ENV_HEALTH_CHECK_PORT = "HEALTH_CHECK_PORT";
  private static final String ENV_METRICS_PORT = "METRICS_PORT";
  private static final String ENV_POLLING_INTERVAL_SECONDS = "POLLING_INTERVAL_SECONDS";
  private static final String ENV_REQUEUE_DELAY_SECONDS = "REQUEUE_DELAY_SECONDS";

  // Default values
  private static final String DEFAULT_LOG_LEVEL = "INFO";
  private static final int DEFAULT_RECONCILIATION_THREADS = 5;
  private static final int DEFAULT_HEALTH_CHECK_PORT = 8080;
  private static final int DEFAULT_METRICS_PORT = 8081;
  private static final int DEFAULT_POLLING_INTERVAL_SECONDS = 10;
  private static final int DEFAULT_REQUEUE_DELAY_SECONDS = 30;

  private final String operatorNamespace;
  private final String logLevel;
  private final int reconciliationThreads;
  private final int healthCheckPort;
  private final int metricsPort;
  private final int pollingIntervalSeconds;
  private final int requeueDelaySeconds;

  public OperatorConfig() {
    this.operatorNamespace = getEnvOrDefault(ENV_OPERATOR_NAMESPACE, "default");
    this.logLevel = getEnvOrDefault(ENV_LOG_LEVEL, DEFAULT_LOG_LEVEL);
    this.reconciliationThreads =
        getIntEnvOrDefault(ENV_RECONCILIATION_THREADS, DEFAULT_RECONCILIATION_THREADS);
    this.healthCheckPort = getIntEnvOrDefault(ENV_HEALTH_CHECK_PORT, DEFAULT_HEALTH_CHECK_PORT);
    this.metricsPort = getIntEnvOrDefault(ENV_METRICS_PORT, DEFAULT_METRICS_PORT);
    this.pollingIntervalSeconds =
        getIntEnvOrDefault(ENV_POLLING_INTERVAL_SECONDS, DEFAULT_POLLING_INTERVAL_SECONDS);
    this.requeueDelaySeconds =
        getIntEnvOrDefault(ENV_REQUEUE_DELAY_SECONDS, DEFAULT_REQUEUE_DELAY_SECONDS);
  }

  // Getters

  public String getOperatorNamespace() {
    return operatorNamespace;
  }

  public String getLogLevel() {
    return logLevel;
  }

  public int getReconciliationThreads() {
    return reconciliationThreads;
  }

  public int getHealthCheckPort() {
    return healthCheckPort;
  }

  public int getMetricsPort() {
    return metricsPort;
  }

  public int getPollingIntervalSeconds() {
    return pollingIntervalSeconds;
  }

  public int getRequeueDelaySeconds() {
    return requeueDelaySeconds;
  }

  // Utility methods

  private static String getEnvOrDefault(String envName, String defaultValue) {
    String value = System.getenv(envName);
    return value != null ? value : defaultValue;
  }

  private static int getIntEnvOrDefault(String envName, int defaultValue) {
    String value = System.getenv(envName);
    if (value != null) {
      try {
        return Integer.parseInt(value);
      } catch (NumberFormatException e) {
        // Log warning and use default
        System.err.printf(
            "Invalid integer value for %s: %s, using default: %d%n", envName, value, defaultValue);
      }
    }
    return defaultValue;
  }

  @Override
  public String toString() {
    return String.format(
        "OperatorConfig{"
            + "operatorNamespace='%s', "
            + "logLevel='%s', "
            + "reconciliationThreads=%d, "
            + "healthCheckPort=%d, "
            + "metricsPort=%d, "
            + "pollingIntervalSeconds=%d, "
            + "requeueDelaySeconds=%d"
            + "}",
        operatorNamespace,
        logLevel,
        reconciliationThreads,
        healthCheckPort,
        metricsPort,
        pollingIntervalSeconds,
        requeueDelaySeconds);
  }
}
