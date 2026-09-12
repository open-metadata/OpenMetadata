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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.MetricGroup;

class MetricGroupIndexTest {

  @Test
  void buildDocumentAlwaysIndexesNumericMemberCount() {
    Map<String, Object> emptyCount =
        new MetricGroupIndex(new MetricGroup()).buildSearchIndexDocInternal(new HashMap<>());
    Map<String, Object> populatedCount =
        new MetricGroupIndex(new MetricGroup().withMetricCount(4))
            .buildSearchIndexDocInternal(new HashMap<>());

    assertEquals(0, emptyCount.get("metricCount"));
    assertEquals(4, populatedCount.get("metricCount"));
  }

  @Test
  void reindexFieldsIncludeCountAndExcludeUnboundedMembers() {
    MetricGroupIndex index = new MetricGroupIndex(new MetricGroup());

    assertTrue(index.getRequiredReindexFields().contains("metricCount"));
    assertTrue(index.getExcludedFields().contains("metrics"));
  }
}
