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

package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.metrics.MetricResource;
import org.openmetadata.service.util.EntityUtil.Fields;

public class MetricRepository extends EntityRepository<Metric> {
  public MetricRepository() {
    super(
        MetricResource.COLLECTION_PATH,
        Entity.METRICS,
        Metric.class,
        Entity.getCollectionDAO().metricDAO(),
        "",
        "");
  }

  @Override
  public void setFullyQualifiedName(Metric metric) {
    metric.setFullyQualifiedName(metric.getName());
  }

  @Override
  public void setFields(Metric metrics, Fields fields) {}

  @Override
  public void clearFields(Metric metrics, Fields fields) {}

  @Override
  public void prepare(Metric metrics, boolean update) {}

  @Override
  public void storeEntity(Metric metric, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    store(metric, update);
  }

  @Override
  public void storeRelationships(Metric metric) {}
}
