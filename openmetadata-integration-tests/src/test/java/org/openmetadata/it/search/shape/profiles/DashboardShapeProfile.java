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
import java.util.UUID;
import org.openmetadata.it.search.shape.EntityCases;
import org.openmetadata.it.search.shape.EntityShapeProfile;
import org.openmetadata.it.search.shape.Outcome;
import org.openmetadata.it.search.shape.PlannedCase;
import org.openmetadata.it.search.shape.Rung;
import org.openmetadata.it.search.shape.ShapeContext;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

public final class DashboardShapeProfile implements EntityShapeProfile {

  @Override
  public String entityType() {
    return Entity.DASHBOARD;
  }

  @Override
  public EntityInterface minimal(final ShapeContext ctx) {
    return new Dashboard()
        .withId(ctx.id())
        .withName("dashboard")
        .withFullyQualifiedName("shapeCanary.bi." + ctx.unique("dashboard"));
  }

  @Override
  public List<PlannedCase> entitySpecificCases(final ShapeContext ctx) {
    return new EntityCases(entityType(), this::minimal, ctx)
        .add("charts.count", Rung.of("1k", 1_000), this::charts, e -> Outcome.OK)
        .add("charts.count", Rung.of("50k", 50_000), this::charts, e -> Outcome.OK)
        .build();
  }

  private EntityInterface charts(final EntityInterface entity, final Rung rung) {
    final Dashboard dashboard = (Dashboard) entity;
    final List<EntityReference> charts = new ArrayList<>(rung.magnitude());
    for (int i = 0; i < rung.magnitude(); i++) {
      charts.add(
          new EntityReference().withId(UUID.randomUUID()).withType("chart").withName("chart_" + i));
    }
    dashboard.setCharts(charts);
    return dashboard;
  }
}
