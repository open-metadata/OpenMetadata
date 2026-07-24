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

import org.openmetadata.schema.api.data.InstallOntologyPack;
import org.openmetadata.schema.api.data.OntologyPackInstallResult;
import org.openmetadata.schema.api.data.OntologyPackList;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

public final class OntologyPackService {
  private static final String BASE_PATH = "/v1/ontologyPacks";
  private final HttpClient httpClient;

  public OntologyPackService(final HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public OntologyPackList list() throws OpenMetadataException {
    return httpClient.execute(HttpMethod.GET, BASE_PATH, null, OntologyPackList.class);
  }

  public OntologyPackManifest get(final String packId) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.GET, packPath(packId), null, OntologyPackManifest.class);
  }

  public OntologyPackInstallResult install(final String packId, final InstallOntologyPack request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, packPath(packId) + "/install", request, OntologyPackInstallResult.class);
  }

  private static String packPath(final String packId) {
    return BASE_PATH + "/" + packId;
  }
}
