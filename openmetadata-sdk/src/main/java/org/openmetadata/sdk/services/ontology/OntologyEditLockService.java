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
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.type.OntologyEditLock;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/** Typed SDK client for renewable Ontology Studio edit leases. */
public final class OntologyEditLockService {
  private static final String BASE_PATH = "/v1/ontologyEditLocks";
  private final HttpClient httpClient;

  public OntologyEditLockService(final HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public OntologyEditLock acquire(final AcquireOntologyEditLock request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, BASE_PATH + "/acquire", request, OntologyEditLock.class);
  }

  public OntologyEditLock renew(final AcquireOntologyEditLock request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, BASE_PATH + "/renew", request, OntologyEditLock.class);
  }

  public OntologyEditLock get(final String resourceType, final UUID resourceId)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.GET, resourcePath(resourceType, resourceId), null, OntologyEditLock.class);
  }

  public void release(final String resourceType, final UUID resourceId, final String sessionId)
      throws OpenMetadataException {
    final RequestOptions options =
        RequestOptions.builder().queryParam("sessionId", sessionId).build();
    httpClient.execute(
        HttpMethod.DELETE, resourcePath(resourceType, resourceId), null, Void.class, options);
  }

  private static String resourcePath(final String resourceType, final UUID resourceId) {
    return BASE_PATH + "/" + resourceType + "/" + resourceId;
  }
}
