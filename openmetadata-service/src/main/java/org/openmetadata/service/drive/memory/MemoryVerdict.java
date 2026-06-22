/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive.memory;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Anti-corruption DTO for a single ontology verdict as returned by the LLM. All fields are raw
 * Strings for leniency; callers validate and promote to domain types. See {@link MemoryAction}
 * for the expected {@code action} values.
 *
 * <p>{@code relatedTermFqns} lets the agent connect a term to other terms (typically the sibling
 * concepts surfaced from the same source document) so derivation produces a connected ontology
 * rather than disconnected units. It applies only to the term axis; it is ignored for metrics.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MemoryVerdict(
    @JsonProperty("action") String action,
    @JsonProperty("targetFqn") String targetFqn,
    @JsonProperty("newGlossaryName") String newGlossaryName,
    @JsonProperty("newGlossaryDescription") String newGlossaryDescription,
    @JsonProperty("name") String name,
    @JsonProperty("displayName") String displayName,
    @JsonProperty("description") String description,
    @JsonProperty("metricType") String metricType,
    @JsonProperty("unitOfMeasurement") String unitOfMeasurement,
    @JsonProperty("metricExpressionCode") String metricExpressionCode,
    @JsonProperty("relatedTermFqns") List<String> relatedTermFqns) {

  /** Backward-compatible constructor for call sites that predate {@code relatedTermFqns}. */
  public MemoryVerdict(
      String action,
      String targetFqn,
      String newGlossaryName,
      String newGlossaryDescription,
      String name,
      String displayName,
      String description,
      String metricType,
      String unitOfMeasurement,
      String metricExpressionCode) {
    this(
        action,
        targetFqn,
        newGlossaryName,
        newGlossaryDescription,
        name,
        displayName,
        description,
        metricType,
        unitOfMeasurement,
        metricExpressionCode,
        null);
  }
}
