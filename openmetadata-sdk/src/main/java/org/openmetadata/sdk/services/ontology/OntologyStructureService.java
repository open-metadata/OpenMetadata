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

import org.openmetadata.schema.api.data.MergeOntologyStructure;
import org.openmetadata.schema.api.data.OntologyStructuralDiff;
import org.openmetadata.schema.api.data.OntologyStructuralDiffRequest;
import org.openmetadata.schema.api.data.OntologyStructuralMergeResult;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

public final class OntologyStructureService {
  private static final String BASE_PATH = "/v1/ontology/structure";
  private final HttpClient httpClient;

  public OntologyStructureService(final HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public OntologyStructuralDiff diff(final OntologyStructuralDiffRequest request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, BASE_PATH + "/diff", request, OntologyStructuralDiff.class);
  }

  public OntologyStructuralMergeResult merge(final MergeOntologyStructure request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, BASE_PATH + "/merge", request, OntologyStructuralMergeResult.class);
  }
}
