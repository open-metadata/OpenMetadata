/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.search.shape.profiles;

import org.openmetadata.it.search.shape.EntityShapeProfile;
import org.openmetadata.it.search.shape.ShapeContext;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.service.Entity;

public final class ApiCollectionShapeProfile implements EntityShapeProfile {

  @Override
  public String entityType() {
    return Entity.API_COLLECTION;
  }

  @Override
  public EntityInterface minimal(final ShapeContext ctx) {
    return new APICollection()
        .withId(ctx.id())
        .withName("apiCollection")
        .withFullyQualifiedName("shapeCanary.api." + ctx.unique("apiCollection"));
  }
}
