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

import org.openmetadata.schema.api.data.OntologyDomainDraftRequest;
import org.openmetadata.schema.api.data.OntologyDomainDraftResult;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionList;
import org.openmetadata.schema.api.data.OntologyMappingSuggestionRequest;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryRequest;
import org.openmetadata.schema.api.data.OntologyNaturalLanguageQueryResult;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionList;
import org.openmetadata.schema.api.data.OntologyRelationshipSuggestionRequest;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/** Typed SDK client for optional, review-gated Ontology Studio AI proposals. */
public final class OntologyAiService {
  private static final String BASE_PATH = "/v1/ontology/ai";
  private final HttpClient httpClient;

  public OntologyAiService(final HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public OntologyRelationshipSuggestionList suggestRelationships(
      final OntologyRelationshipSuggestionRequest request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        BASE_PATH + "/relationships/suggestions",
        request,
        OntologyRelationshipSuggestionList.class);
  }

  public OntologyMappingSuggestionList suggestMappings(
      final OntologyMappingSuggestionRequest request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        BASE_PATH + "/mappings/suggestions",
        request,
        OntologyMappingSuggestionList.class);
  }

  public OntologyNaturalLanguageQueryResult generateSparql(
      final OntologyNaturalLanguageQueryRequest request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, BASE_PATH + "/sparql", request, OntologyNaturalLanguageQueryResult.class);
  }

  public OntologyDomainDraftResult generateDomainDraft(final OntologyDomainDraftRequest request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, BASE_PATH + "/drafts", request, OntologyDomainDraftResult.class);
  }
}
