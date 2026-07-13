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

/**
 * Anti-corruption DTO for one typed relationship the agent proposes between the term being derived
 * and an existing term. {@code relationType} is read from the LLM as a raw string and validated by
 * {@link MemoryReconciler} against the glossary's allowed vocabulary (SKOS-style: {@code relatedTo},
 * {@code synonym}, {@code broader}/{@code narrower}, {@code partOf}/{@code hasPart}, {@code
 * calculatedFrom}/{@code usedToCalculate}, ...); an unrecognized value degrades to {@code relatedTo}
 * rather than throwing. The direction is "this term {@code relationType} targetFqn".
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MemoryRelation(
    @JsonProperty("targetFqn") String targetFqn,
    @JsonProperty("relationType") String relationType) {}
