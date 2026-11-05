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

import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

/** Typed SDK client for governed OWL axioms and profile validation. */
public final class OntologyAxiomService extends EntityServiceBase<OntologyAxiom> {
  public OntologyAxiomService(final HttpClient httpClient) {
    super(httpClient, "/v1/ontologyAxioms");
  }

  public OntologyAxiom create(final CreateOntologyAxiom request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, OntologyAxiom.class);
  }

  public OntologyAxiom upsert(final CreateOntologyAxiom request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath, request, OntologyAxiom.class);
  }

  public OntologyProfileReport validate(final CreateOntologyAxiom request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath + "/validate", request, OntologyProfileReport.class);
  }

  @Override
  protected Class<OntologyAxiom> getEntityClass() {
    return OntologyAxiom.class;
  }
}
