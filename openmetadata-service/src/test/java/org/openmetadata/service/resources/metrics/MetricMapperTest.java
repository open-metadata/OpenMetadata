/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.metrics;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Answers.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateMetricGroup;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class MetricMapperTest {

  @Test
  void metricMapperCarriesParentAndGroupReferences() {
    Metric metric =
        new MetricMapper()
            .createToEntity(
                new CreateMetric()
                    .withName("netRevenue")
                    .withParent("revenue")
                    .withMetricGroup("profitability"),
                "admin");

    assertNotNull(metric.getParent());
    assertEquals(Entity.METRIC, metric.getParent().getType());
    assertEquals("revenue", metric.getParent().getFullyQualifiedName());
    assertNotNull(metric.getMetricGroup());
    assertEquals(Entity.METRIC_GROUP, metric.getMetricGroup().getType());
    assertEquals("profitability", metric.getMetricGroup().getFullyQualifiedName());
  }

  @Test
  void metricMapperPreservesDeprecatedCreateAssets() {
    EntityReference table =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TABLE)
            .withFullyQualifiedName("service.database.schema.orders");

    Metric metric =
        new MetricMapper()
            .createToEntity(
                new CreateMetric().withName("orderCount").withAssets(List.of(table)), "admin");

    assertEquals(List.of(table), metric.getAssets());
  }

  @Test
  void metricMapperResolvesExpertsAsUserReferences() {
    UUID expertId = UUID.randomUUID();
    EntityReference resolved =
        new EntityReference()
            .withId(expertId)
            .withType(Entity.USER)
            .withName("metricExpert")
            .withFullyQualifiedName("metricExpert");
    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity
          .when(
              () ->
                  Entity.getEntityReferenceByName(
                      org.mockito.ArgumentMatchers.eq(Entity.USER),
                      org.mockito.ArgumentMatchers.eq("metricExpert"),
                      org.mockito.ArgumentMatchers.eq(
                          org.openmetadata.schema.type.Include.NON_DELETED)))
          .thenReturn(resolved);
      entity
          .when(
              () ->
                  Entity.getEntityReference(
                      org.mockito.ArgumentMatchers.any(EntityReference.class),
                      org.mockito.ArgumentMatchers.eq(org.openmetadata.schema.type.Include.ALL)))
          .thenReturn(resolved);

      Metric metric =
          new MetricMapper()
              .createToEntity(
                  new CreateMetric().withName("netRevenue").withExperts(List.of("metricExpert")),
                  "admin");

      assertEquals(1, metric.getExperts().size());
      assertEquals(expertId, metric.getExperts().getFirst().getId());
      assertEquals(Entity.USER, metric.getExperts().getFirst().getType());
    }
  }

  @Test
  void metricGroupMapperCreatesTypedMetricReferences() {
    MetricGroup group =
        new MetricGroupMapper()
            .createToEntity(
                new CreateMetricGroup()
                    .withName("profitability")
                    .withMetrics(List.of("grossMargin", "netRevenue")),
                "admin");

    assertEquals(2, group.getMetrics().size());
    assertEquals(Entity.METRIC, group.getMetrics().getFirst().getType());
    assertEquals("grossMargin", group.getMetrics().getFirst().getFullyQualifiedName());
  }

  @Test
  void metricGroupMapperPreservesMetadataAndTreatsOmittedMembersAsUnset() {
    MetricGroup group =
        new MetricGroupMapper()
            .createToEntity(
                new CreateMetricGroup()
                    .withName("profitability")
                    .withDisplayName("Profitability Metrics")
                    .withDescription("Metrics for profit performance"),
                "alice");

    assertEquals("profitability", group.getName());
    assertEquals("Profitability Metrics", group.getDisplayName());
    assertEquals("alice", group.getUpdatedBy());
    assertNull(group.getMetrics());
  }
}
