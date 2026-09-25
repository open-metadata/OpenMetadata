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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import java.util.List;
import org.openmetadata.schema.api.data.CreateMetricGroup;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class MetricGroupMapper implements EntityMapper<MetricGroup, CreateMetricGroup> {
  @Override
  public MetricGroup createToEntity(CreateMetricGroup create, String user) {
    return copy(new MetricGroup(), create, user)
        .withMetrics(toMetricReferences(create.getMetrics()));
  }

  private List<EntityReference> toMetricReferences(List<String> metricFqns) {
    return nullOrEmpty(metricFqns)
        ? null
        : metricFqns.stream().map(fqn -> getEntityReference(Entity.METRIC, fqn)).toList();
  }
}
