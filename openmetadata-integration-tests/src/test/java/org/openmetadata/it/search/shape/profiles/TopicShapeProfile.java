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
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.service.Entity;

public final class TopicShapeProfile implements EntityShapeProfile {

  @Override
  public String entityType() {
    return Entity.TOPIC;
  }

  @Override
  public EntityInterface minimal(final ShapeContext ctx) {
    return new Topic()
        .withId(ctx.id())
        .withName("topic")
        .withFullyQualifiedName("shapeCanary.kafka." + ctx.unique("topic"));
  }

  @Override
  public List<PlannedCase> entitySpecificCases(final ShapeContext ctx) {
    return new EntityCases(entityType(), this::minimal, ctx)
        .add("schemaFields.count", Rung.of("1k", 1_000), this::fields, e -> Outcome.OK)
        .add("schemaFields.count", Rung.of("50k", 50_000), this::fields, e -> Outcome.OK)
        .build();
  }

  private EntityInterface fields(final EntityInterface entity, final Rung rung) {
    final Topic topic = (Topic) entity;
    final List<Field> fields = new ArrayList<>(rung.magnitude());
    for (int i = 0; i < rung.magnitude(); i++) {
      fields.add(new Field().withName("f_" + i).withDataType(FieldDataType.STRING));
    }
    topic.setMessageSchema(new MessageSchema().withSchemaFields(fields));
    return topic;
  }
}
