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

import org.openmetadata.schema.api.data.CreateRelationshipType;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

/** Typed SDK client for governed ontology relationship types. */
public final class RelationshipTypeService extends EntityServiceBase<RelationshipType> {
  public RelationshipTypeService(final HttpClient httpClient) {
    super(httpClient, "/v1/relationshipTypes");
  }

  public RelationshipType create(final CreateRelationshipType request)
      throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, RelationshipType.class);
  }

  public RelationshipType upsert(final CreateRelationshipType request)
      throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath, request, RelationshipType.class);
  }

  public void delete(final String id, final boolean hardDelete) throws OpenMetadataException {
    final RequestOptions options =
        RequestOptions.builder().queryParam("hardDelete", Boolean.toString(hardDelete)).build();
    httpClient.execute(HttpMethod.DELETE, basePath + "/" + id, null, Void.class, options);
  }

  @Override
  protected Class<RelationshipType> getEntityClass() {
    return RelationshipType.class;
  }
}
