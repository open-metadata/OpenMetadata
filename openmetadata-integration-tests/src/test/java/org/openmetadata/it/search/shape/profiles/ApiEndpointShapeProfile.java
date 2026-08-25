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
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.service.Entity;

public final class ApiEndpointShapeProfile implements EntityShapeProfile {

  @Override
  public String entityType() {
    return Entity.API_ENDPOINT;
  }

  @Override
  public EntityInterface minimal(final ShapeContext ctx) {
    return new APIEndpoint()
        .withId(ctx.id())
        .withName("endpoint")
        .withFullyQualifiedName("shapeCanary.api." + ctx.unique("endpoint"))
        .withRequestSchema(new APISchema().withSchemaFields(List.of(field("req0"))))
        .withResponseSchema(new APISchema().withSchemaFields(List.of(field("resp0"))));
  }

  @Override
  public List<PlannedCase> entitySpecificCases(final ShapeContext ctx) {
    return new EntityCases(entityType(), this::minimal, ctx)
        .add("requestSchemaFields.count", Rung.of("1k", 1_000), this::requestFields)
        .add("requestSchemaFields.count", Rung.of("50k", 50_000), this::requestFields)
        .add("responseSchemaFields.count", Rung.of("1k", 1_000), this::responseFields)
        .add("responseSchemaFields.count", Rung.of("50k", 50_000), this::responseFields)
        .build();
  }

  private EntityInterface requestFields(final EntityInterface entity, final Rung rung) {
    final APIEndpoint endpoint = (APIEndpoint) entity;
    endpoint.setRequestSchema(new APISchema().withSchemaFields(fields("req_", rung.magnitude())));
    return endpoint;
  }

  private EntityInterface responseFields(final EntityInterface entity, final Rung rung) {
    final APIEndpoint endpoint = (APIEndpoint) entity;
    endpoint.setResponseSchema(new APISchema().withSchemaFields(fields("resp_", rung.magnitude())));
    return endpoint;
  }

  private static List<Field> fields(final String prefix, final int count) {
    final List<Field> fields = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      fields.add(field(prefix + i));
    }
    return fields;
  }

  private static Field field(final String name) {
    return new Field().withName(name).withDataType(FieldDataType.STRING);
  }
}
