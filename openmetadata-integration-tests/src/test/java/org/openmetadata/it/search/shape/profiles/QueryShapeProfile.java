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

import java.util.List;
import org.openmetadata.it.search.shape.EntityCases;
import org.openmetadata.it.search.shape.EntityShapeProfile;
import org.openmetadata.it.search.shape.PlannedCase;
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeContext;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.service.Entity;

public final class QueryShapeProfile implements EntityShapeProfile {

  @Override
  public String entityType() {
    return Entity.QUERY;
  }

  @Override
  public EntityInterface minimal(final ShapeContext ctx) {
    return new Query()
        .withId(ctx.id())
        .withName("query")
        .withFullyQualifiedName("shapeCanary.query." + ctx.unique("query"))
        .withQuery("SELECT 1");
  }

  @Override
  public List<PlannedCase> entitySpecificCases(final ShapeContext ctx) {
    return new EntityCases(entityType(), this::minimal, ctx)
        .add("queryText.size", Rung.of("1MB", 1_000_000), this::queryText)
        .add("queryText.size", Rung.of("16MB", 16_000_000), this::queryText)
        .build();
  }

  private EntityInterface queryText(final EntityInterface entity, final Rung rung) {
    final Query query = (Query) entity;
    query.setQuery("SELECT " + "a".repeat(rung.magnitude()));
    return query;
  }
}
