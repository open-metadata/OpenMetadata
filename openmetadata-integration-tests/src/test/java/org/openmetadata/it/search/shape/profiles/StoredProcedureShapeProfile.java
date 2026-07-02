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
import org.openmetadata.schema.api.data.StoredProcedureCode;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.service.Entity;

public final class StoredProcedureShapeProfile implements EntityShapeProfile {

  @Override
  public String entityType() {
    return Entity.STORED_PROCEDURE;
  }

  @Override
  public EntityInterface minimal(final ShapeContext ctx) {
    return new StoredProcedure()
        .withId(ctx.id())
        .withName("proc")
        .withFullyQualifiedName("shapeCanary.proc." + ctx.unique("proc"))
        .withStoredProcedureCode(new StoredProcedureCode().withCode("BEGIN END"));
  }

  @Override
  public List<PlannedCase> entitySpecificCases(final ShapeContext ctx) {
    return new EntityCases(entityType(), this::minimal, ctx)
        .add("code.size", Rung.of("1MB", 1_000_000), this::code)
        .add("code.size", Rung.of("16MB", 16_000_000), this::code)
        .build();
  }

  private EntityInterface code(final EntityInterface entity, final Rung rung) {
    final StoredProcedure proc = (StoredProcedure) entity;
    proc.setStoredProcedureCode(new StoredProcedureCode().withCode("x".repeat(rung.magnitude())));
    return proc;
  }
}
