/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.governance.workflows;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Fields whose change can trigger a governance workflow, split into a {@code common} set applicable
 * to every entity type and a {@code byEntity} map of additional fields specific to an entity type
 * (for example {@code table -> [columns]}). The effective set for an entity is the union of the two.
 *
 * <p>The definition is a data resource loaded once at class-init and fails fast if missing.
 */
public final class WorkflowTriggerFieldsRegistry {
  private static final String RESOURCE = "/json/governance/workflowTriggerFields.json";
  private static final WorkflowTriggerFieldsConfig CONFIG = load();

  private WorkflowTriggerFieldsRegistry() {}

  public record WorkflowTriggerFieldsConfig(
      @JsonProperty("common") List<String> common,
      @JsonProperty("byEntity") Map<String, List<String>> byEntity) {}

  private static WorkflowTriggerFieldsConfig load() {
    try (InputStream in = WorkflowTriggerFieldsRegistry.class.getResourceAsStream(RESOURCE)) {
      if (in == null) {
        throw new IllegalStateException(
            "Required workflow trigger fields resource not found: " + RESOURCE);
      }
      return JsonUtils.readValue(
          new String(in.readAllBytes(), StandardCharsets.UTF_8), WorkflowTriggerFieldsConfig.class);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to load " + RESOURCE, e);
    }
  }

  public static WorkflowTriggerFieldsConfig getConfig() {
    return CONFIG;
  }

  public static List<String> getCommonFields() {
    return CONFIG.common();
  }

  public static List<String> getEntityFields(String entityType) {
    return CONFIG.byEntity().getOrDefault(entityType, List.of());
  }

  public static Set<String> getEffectiveFields(String entityType) {
    Set<String> fields = new LinkedHashSet<>(CONFIG.common());
    fields.addAll(getEntityFields(entityType));
    return fields;
  }
}
