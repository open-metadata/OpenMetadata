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
import org.openmetadata.schema.api.data.ApplyOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyChangeSetCommand;
import org.openmetadata.schema.api.data.UpdateOntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

/** Typed SDK client for durable Ontology Studio authoring sessions. */
public final class OntologyChangeSetService extends EntityServiceBase<OntologyChangeSet> {
  public OntologyChangeSetService(final HttpClient httpClient) {
    super(httpClient, "/v1/ontologyChangeSets");
  }

  public OntologyChangeSet create(final CreateOntologyChangeSet request)
      throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, OntologyChangeSet.class);
  }

  public OntologyChangeSet replaceOperations(final UUID id, final UpdateOntologyChangeSet request)
      throws OpenMetadataException {
    return execute(HttpMethod.PUT, id, "/operations", request);
  }

  public OntologyChangeSet undo(final UUID id, final OntologyChangeSetCommand request)
      throws OpenMetadataException {
    return execute(HttpMethod.POST, id, "/undo", request);
  }

  public OntologyChangeSet redo(final UUID id, final OntologyChangeSetCommand request)
      throws OpenMetadataException {
    return execute(HttpMethod.POST, id, "/redo", request);
  }

  public OntologyChangeSet submit(final UUID id, final OntologyChangeSetCommand request)
      throws OpenMetadataException {
    return execute(HttpMethod.POST, id, "/submit", request);
  }

  public OntologyChangeSet apply(final UUID id, final ApplyOntologyChangeSet request)
      throws OpenMetadataException {
    return execute(HttpMethod.POST, id, "/apply", request);
  }

  public OntologyChangeSet discard(final UUID id, final OntologyChangeSetCommand request)
      throws OpenMetadataException {
    return execute(HttpMethod.POST, id, "/discard", request);
  }

  private <RequestT> OntologyChangeSet execute(
      final HttpMethod method, final UUID id, final String action, final RequestT request)
      throws OpenMetadataException {
    return httpClient.execute(
        method, basePath + "/" + id + action, request, OntologyChangeSet.class);
  }

  @Override
  protected Class<OntologyChangeSet> getEntityClass() {
    return OntologyChangeSet.class;
  }
}
