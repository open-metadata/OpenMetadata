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

package org.openmetadata.service.search.indexes;

import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.service.Entity;

public class MetricGroupIndex implements TaggableIndex {
  private static final String FIELD_METRIC_COUNT = "metricCount";
  private static final Set<String> EXCLUDED_FIELDS = Set.of("metrics");

  final MetricGroup metricGroup;

  public MetricGroupIndex(MetricGroup metricGroup) {
    this.metricGroup = metricGroup;
  }

  @Override
  public Object getEntity() {
    return metricGroup;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.METRIC_GROUP;
  }

  /**
   * {@code metricCount} is computed on read rather than stored, so it has to be requested
   * explicitly or it never reaches the document. The member list itself is excluded: the list page
   * loads a group's metrics on demand, so indexing an unbounded membership array would cost
   * document size for nothing.
   */
  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(TaggableIndex.super.getRequiredReindexFields());
    fields.add(FIELD_METRIC_COUNT);
    return Collections.unmodifiableSet(fields);
  }

  @Override
  public Set<String> getExcludedFields() {
    return EXCLUDED_FIELDS;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    // Null indexes as `missing` for an integer field, which breaks numeric range and sort queries
    // that assume the field is always present.
    doc.put(
        FIELD_METRIC_COUNT,
        metricGroup.getMetricCount() != null ? metricGroup.getMetricCount() : 0);
    return doc;
  }

  public static Map<String, Float> getFields() {
    return SearchIndex.getDefaultFields();
  }
}
