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
import org.openmetadata.it.search.shape.Outcome;
import org.openmetadata.it.search.shape.PlannedCase;
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeContext;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.service.Entity;

public final class ContainerShapeProfile implements EntityShapeProfile {

  @Override
  public String entityType() {
    return Entity.CONTAINER;
  }

  @Override
  public EntityInterface minimal(final ShapeContext ctx) {
    return new Container()
        .withId(ctx.id())
        .withName("container")
        .withFullyQualifiedName("shapeCanary.storage." + ctx.unique("container"));
  }

  @Override
  public List<PlannedCase> entitySpecificCases(final ShapeContext ctx) {
    return new EntityCases(entityType(), this::minimal, ctx)
        .add(
            "dataModelColumns.count", Rung.of("1k", 1_000), this::dataModelColumns, e -> Outcome.OK)
        .add(
            "dataModelColumns.count",
            Rung.of("50k", 50_000),
            this::dataModelColumns,
            e -> Outcome.OK)
        .build();
  }

  private EntityInterface dataModelColumns(final EntityInterface entity, final Rung rung) {
    final Container container = (Container) entity;
    final List<Column> columns = new ArrayList<>(rung.magnitude());
    for (int i = 0; i < rung.magnitude(); i++) {
      columns.add(new Column().withName("c_" + i).withDataType(ColumnDataType.STRING));
    }
    container.setDataModel(new ContainerDataModel().withColumns(columns));
    return container;
  }
}
