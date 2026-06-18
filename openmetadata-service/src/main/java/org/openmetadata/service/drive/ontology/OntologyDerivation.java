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

package org.openmetadata.service.drive.ontology;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Anti-corruption DTO for the full ontology derivation response produced by the LLM. Mirrors
 * {@link org.openmetadata.service.llm.KnowledgePill}: intentionally narrow, tolerant of unknown
 * fields, and kept separate from the entity model. The caller promotes validated fields into
 * trusted domain objects.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OntologyDerivation(
    @JsonProperty("termVerdict") OntologyVerdict termVerdict,
    @JsonProperty("metricVerdict") OntologyVerdict metricVerdict) {}
