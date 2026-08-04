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

package org.openmetadata.sdk.services.ontology;

import org.openmetadata.schema.api.data.OntologyInferenceExplanation;
import org.openmetadata.schema.api.data.OntologyInferenceExplanationRequest;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/** Typed client for scoped materialized-inference explanations. */
public final class OntologyReasoningService {
  private static final String EXPLANATIONS_PATH = "/v1/ontology/reasoning/explanations";
  private final HttpClient httpClient;

  public OntologyReasoningService(final HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public OntologyInferenceExplanation explain(final OntologyInferenceExplanationRequest request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, EXPLANATIONS_PATH, request, OntologyInferenceExplanation.class);
  }
}
