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

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.it.search.shape.EntityCases;
import org.openmetadata.it.search.shape.EntityShapeProfile;
import org.openmetadata.it.search.shape.PlannedCase;
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeContext;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.service.Entity;

public final class SearchIndexShapeProfile implements EntityShapeProfile {

  @Override
  public String entityType() {
    return Entity.SEARCH_INDEX;
  }

  @Override
  public EntityInterface minimal(final ShapeContext ctx) {
    return new SearchIndex()
        .withId(ctx.id())
        .withName("index")
        .withFullyQualifiedName("shapeCanary.search." + ctx.unique("index"))
        .withFields(List.of(field("f0")));
  }

  @Override
  public List<PlannedCase> entitySpecificCases(final ShapeContext ctx) {
    return new EntityCases(entityType(), this::minimal, ctx)
        .add("fields.count", Rung.of("1k", 1_000), this::fields)
        .add("fields.count", Rung.of("10k", 10_000), this::fields)
        .add("fields.count", Rung.of("50k", 50_000), this::fields)
        .build();
  }

  private EntityInterface fields(final EntityInterface entity, final Rung rung) {
    final SearchIndex index = (SearchIndex) entity;
    final List<SearchIndexField> fields = new ArrayList<>(rung.magnitude());
    for (int i = 0; i < rung.magnitude(); i++) {
      fields.add(field("f_" + i));
    }
    index.setFields(fields);
    return index;
  }

  private static SearchIndexField field(final String name) {
    return new SearchIndexField().withName(name).withDataType(SearchIndexDataType.TEXT);
  }
}
