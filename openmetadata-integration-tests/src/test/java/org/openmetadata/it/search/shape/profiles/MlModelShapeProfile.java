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
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.service.Entity;

public final class MlModelShapeProfile implements EntityShapeProfile {

  @Override
  public String entityType() {
    return Entity.MLMODEL;
  }

  @Override
  public EntityInterface minimal(final ShapeContext ctx) {
    return new MlModel()
        .withId(ctx.id())
        .withName("model")
        .withFullyQualifiedName("shapeCanary.ml." + ctx.unique("model"))
        .withMlFeatures(List.of(new MlFeature().withName("f0")));
  }

  @Override
  public List<PlannedCase> entitySpecificCases(final ShapeContext ctx) {
    return new EntityCases(entityType(), this::minimal, ctx)
        .add("mlFeatures.count", Rung.of("1k", 1_000), this::features)
        .add("mlFeatures.count", Rung.of("10k", 10_000), this::features)
        .add("mlFeatures.count", Rung.of("50k", 50_000), this::features)
        .build();
  }

  private EntityInterface features(final EntityInterface entity, final Rung rung) {
    final MlModel model = (MlModel) entity;
    final List<MlFeature> features = new ArrayList<>(rung.magnitude());
    for (int i = 0; i < rung.magnitude(); i++) {
      features.add(new MlFeature().withName("f_" + i));
    }
    model.setMlFeatures(features);
    return model;
  }
}
