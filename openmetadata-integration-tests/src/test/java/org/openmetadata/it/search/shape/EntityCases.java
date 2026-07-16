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
package org.openmetadata.it.search.shape;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;

public final class EntityCases {
  private final String entityType;
  private final Function<ShapeContext, EntityInterface> minimal;
  private final ShapeContext ctx;
  private final List<PlannedCase> cases = new ArrayList<>();

  public EntityCases(
      final String entityType,
      final Function<ShapeContext, EntityInterface> minimal,
      final ShapeContext ctx) {
    this.entityType = entityType;
    this.minimal = minimal;
    this.ctx = ctx;
  }

  public EntityCases add(
      final String dimension,
      final Rung rung,
      final BiFunction<EntityInterface, Rung, EntityInterface> apply) {
    cases.add(
        new PlannedCase(
            entityType, dimension, rung, () -> apply.apply(minimal.apply(ctx), rung), null));
    return this;
  }

  public List<PlannedCase> build() {
    return List.copyOf(cases);
  }
}
