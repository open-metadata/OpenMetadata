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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;

class KpiRepositoryTest {

  @Test
  void latestResultUsesMostRecentBucketNotFirst() {
    DataInsightCustomChartResult partialLeadingBucket =
        new DataInsightCustomChartResult().withCount(0.0).withDay(1784160000000.0);
    DataInsightCustomChartResult mostRecentFullDay =
        new DataInsightCustomChartResult().withCount(0.6804130832728905).withDay(1784246400000.0);
    DataInsightCustomChartResultList resultList =
        new DataInsightCustomChartResultList()
            .withResults(List.of(partialLeadingBucket, mostRecentFullDay));

    DataInsightCustomChartResult latest = KpiRepository.getMostRecentResult(resultList);

    assertEquals(0.6804130832728905, latest.getCount(), 0.0);
    assertEquals(1784246400000.0, latest.getDay(), 0.0);
  }

  @Test
  void latestResultReturnsNullWhenNoBuckets() {
    assertNull(
        KpiRepository.getMostRecentResult(
            new DataInsightCustomChartResultList().withResults(List.of())));
    assertNull(KpiRepository.getMostRecentResult(null));
  }
}
