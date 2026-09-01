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

import static org.openmetadata.service.util.EntityUtil.getEntityReference;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class MetricMapper implements EntityMapper<Metric, CreateMetric> {
  @Override
  public Metric createToEntity(CreateMetric create, String user) {
    return copy(new Metric(), create, user)
        .withExperts(
            EntityUtil.validateAndPopulateEntityReferences(
                getEntityReferences(Entity.USER, create.getExperts())))
        .withMetricExpression(create.getMetricExpression())
        .withGranularity(create.getGranularity())
        .withRelatedMetrics(getEntityReferences(Entity.METRIC, create.getRelatedMetrics()))
        .withAssets(create.getAssets())
        .withMetricType(create.getMetricType())
        .withUnitOfMeasurement(create.getUnitOfMeasurement())
        .withCustomUnitOfMeasurement(create.getCustomUnitOfMeasurement())
        .withDimensions(create.getDimensions())
        .withMeasures(create.getMeasures())
        .withFilters(create.getFilters())
        .withParent(getEntityReference(Entity.METRIC, create.getParent()))
        .withMetricGroup(getEntityReference(Entity.METRIC_GROUP, create.getMetricGroup()));
  }
}
