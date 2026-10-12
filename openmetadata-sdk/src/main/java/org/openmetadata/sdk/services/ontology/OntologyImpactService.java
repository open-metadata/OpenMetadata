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

import java.util.UUID;
import org.openmetadata.schema.api.data.DeleteOntologyResource;
import org.openmetadata.schema.api.data.OntologyDeleteResult;
import org.openmetadata.schema.api.data.OntologyImpactReport;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

public final class OntologyImpactService {
  private static final String BASE_PATH = "/v1/ontology/impacts/glossaryTerms/";
  private static final String DELETE_PATH = "/delete";
  private final HttpClient httpClient;

  public OntologyImpactService(final HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public OntologyImpactReport previewGlossaryTermDelete(final UUID termId)
      throws OpenMetadataException {
    return httpClient.execute(HttpMethod.GET, deletePath(termId), null, OntologyImpactReport.class);
  }

  public OntologyDeleteResult deleteGlossaryTerm(
      final UUID termId, final DeleteOntologyResource request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, deletePath(termId), request, OntologyDeleteResult.class);
  }

  private static String deletePath(final UUID termId) {
    return BASE_PATH + termId + DELETE_PATH;
  }
}
