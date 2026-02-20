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

package org.openmetadata.operator.util;

import io.fabric8.kubernetes.api.model.EnvVar;
import io.fabric8.kubernetes.api.model.EnvVarBuilder;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Utility class for handling environment variable conversions and sanitization.
 * Ensures compatibility between K8s API representations and Fabric8 client requirements.
 */
public final class EnvVarUtils {

  private static final Logger LOG = LoggerFactory.getLogger(EnvVarUtils.class);

  private EnvVarUtils() {
    // Utility class
  }

  /**
   * Sanitize environment variables by removing or fixing invalid valueFrom fields.
   *
   * Fabric8 Kubernetes client requires that valueFrom must either be:
   * - null (not present)
   * - contain valid references (configMapKeyRef, secretKeyRef, fieldRef, or resourceFieldRef)
   *
   * Empty valueFrom objects ({}) cause pod creation failures.
   *
   * @param envVars List of environment variables to sanitize
   * @return Sanitized list of environment variables safe for pod creation
   */
  public static List<EnvVar> sanitizeEnvVars(List<EnvVar> envVars) {
    if (envVars == null) {
      return null;
    }

    List<EnvVar> sanitized = new ArrayList<>();
    for (EnvVar envVar : envVars) {
      sanitized.add(sanitizeEnvVar(envVar));
    }
    return sanitized;
  }

  /**
   * Sanitize a single environment variable.
   *
   * @param envVar Environment variable to sanitize
   * @return Sanitized environment variable
   */
  private static EnvVar sanitizeEnvVar(EnvVar envVar) {
    if (envVar == null) {
      return null;
    }

    // Check if valueFrom is empty (no valid references)
    if (hasEmptyValueFrom(envVar)) {
      LOG.debug("Removing empty valueFrom from env var: {}", envVar.getName());
      // Create new EnvVar without valueFrom
      return new EnvVarBuilder().withName(envVar.getName()).withValue(envVar.getValue()).build();
    }

    // Return as-is if valid
    return envVar;
  }

  /**
   * Check if an environment variable has an empty valueFrom field.
   *
   * @param envVar Environment variable to check
   * @return true if valueFrom exists but has no valid references
   */
  private static boolean hasEmptyValueFrom(EnvVar envVar) {
    if (envVar.getValueFrom() == null) {
      return false;
    }

    // Check if all reference fields are null
    return envVar.getValueFrom().getConfigMapKeyRef() == null
        && envVar.getValueFrom().getSecretKeyRef() == null
        && envVar.getValueFrom().getFieldRef() == null
        && envVar.getValueFrom().getResourceFieldRef() == null;
  }

  /**
   * Validate that environment variables are properly configured.
   *
   * @param envVars List of environment variables to validate
   * @return true if all variables are valid
   */
  public static boolean validateEnvVars(List<EnvVar> envVars) {
    if (envVars == null) {
      return true;
    }

    for (EnvVar envVar : envVars) {
      if (!validateEnvVar(envVar)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Validate a single environment variable.
   *
   * @param envVar Environment variable to validate
   * @return true if variable is valid
   */
  private static boolean validateEnvVar(EnvVar envVar) {
    if (envVar == null || envVar.getName() == null || envVar.getName().isEmpty()) {
      LOG.error("Invalid env var: missing name");
      return false;
    }

    // Must have either value or valueFrom, not both
    if (envVar.getValue() != null && envVar.getValueFrom() != null) {
      LOG.error("Invalid env var {}: cannot have both value and valueFrom", envVar.getName());
      return false;
    }

    // If valueFrom exists, it must have at least one valid reference
    if (envVar.getValueFrom() != null && hasEmptyValueFrom(envVar)) {
      LOG.error("Invalid env var {}: empty valueFrom", envVar.getName());
      return false;
    }

    return true;
  }
}
