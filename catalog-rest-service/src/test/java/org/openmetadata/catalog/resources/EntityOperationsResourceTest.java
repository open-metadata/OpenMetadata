/*
 *  Copyright 2021 Collate
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

package org.openmetadata.catalog.resources;

import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.util.ResultList;

@Slf4j
public abstract class EntityOperationsResourceTest<T> extends EntityResourceTest<T> {
  public EntityOperationsResourceTest(
      String entityName,
      Class<T> entityClass,
      Class<? extends ResultList<T>> entityListClass,
      String collectionName,
      String fields,
      boolean supportsFollowers,
      boolean supportsOwner,
      boolean supportsTags,
      boolean supportsAuthorizedMetadataOperations) {
    super(
        entityName,
        entityClass,
        entityListClass,
        collectionName,
        fields,
        supportsFollowers,
        supportsOwner,
        supportsTags,
        supportsAuthorizedMetadataOperations);
  }

  // Override the resource path name of regular entities api/v1/<entities> to api/operations/v1/<operations>
  protected WebTarget getCollection() {
    return getOperationsResource(collectionName);
  }
}
