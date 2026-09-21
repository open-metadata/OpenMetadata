/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.Set;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.service.exception.OntologyAiProviderException;

final class OntologyAiOutputValidator {
  private static final String ENTITY_LINK_SEPARATOR = "::";
  private static final int MAX_ENTITY_NAME_LENGTH = 256;

  private OntologyAiOutputValidator() {}

  static void requireCompletion(final OntologyAiCompletionGateway.Completion<?> completion) {
    if (completion == null || completion.items() == null) {
      throw invalid("completion payload is missing");
    }
    modelId(completion);
  }

  static String modelId(final OntologyAiCompletionGateway.Completion<?> completion) {
    if (completion == null || isBlank(completion.modelId())) {
      throw invalid("model identifier is missing");
    }
    return completion.modelId();
  }

  static void requireText(final String value, final String fieldName) {
    if (isBlank(value)) {
      throw invalid(fieldName + " is required");
    }
  }

  static String requireEntityName(final String name) {
    requireText(name, "domain concept name");
    if (name.length() > MAX_ENTITY_NAME_LENGTH || name.contains(ENTITY_LINK_SEPARATOR)) {
      throw invalid("domain concept name is not a valid entity name");
    }
    return name;
  }

  static void requireConfidence(final double confidence) {
    if (!Double.isFinite(confidence) || confidence < 0D || confidence > 1D) {
      throw invalid("confidence must be between 0 and 1");
    }
  }

  static <T> void requireAllowedId(final T id, final Set<T> allowed, final String fieldName) {
    if (id == null || !allowed.contains(id)) {
      throw invalid(fieldName + " identifier was not supplied in the request");
    }
  }

  static URI requireAbsoluteIri(final String value, final String fieldName) {
    requireText(value, fieldName);
    final URI iri = parseIri(value, fieldName);
    if (!iri.isAbsolute()) {
      throw invalid(fieldName + " must be absolute");
    }
    return iri;
  }

  static URI optionalAbsoluteIri(final String value, final String fieldName) {
    final URI iri = isBlank(value) ? null : requireAbsoluteIri(value, fieldName);
    return iri;
  }

  static ConceptMapping.ConceptMappingType mappingType(final String value) {
    final ConceptMapping.ConceptMappingType type;
    try {
      type = ConceptMapping.ConceptMappingType.fromValue(value);
    } catch (IllegalArgumentException exception) {
      throw new OntologyAiProviderException(
          "Ontology AI provider returned an unsupported mapping type", exception);
    }
    return type;
  }

  static OntologyAiProviderException invalid(final String reason) {
    return new OntologyAiProviderException(
        "Ontology AI provider returned invalid output: " + reason);
  }

  private static URI parseIri(final String value, final String fieldName) {
    final URI iri;
    try {
      iri = URI.create(value);
    } catch (IllegalArgumentException exception) {
      throw new OntologyAiProviderException(
          "Ontology AI provider returned an invalid " + fieldName, exception);
    }
    return iri;
  }

  private static boolean isBlank(final String value) {
    return nullOrEmpty(value) || value.isBlank();
  }
}
