/*
 *  Copyright 2022 Collate
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

package org.openmetadata.service.workflows.searchIndex;

import java.util.Set;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import os.org.opensearch.action.bulk.BulkItemResponse;
import os.org.opensearch.action.bulk.BulkResponse;

public class ReindexingUtil {
  private ReindexingUtil() {
    /*unused*/
  }

  public static final String ENTITY_TYPE_KEY = "entityType";

  public static void getUpdatedStats(StepStats stats, int currentSuccess, int currentFailed) {
    stats.setSuccessRecords(stats.getSuccessRecords() + currentSuccess);
    stats.setFailedRecords(stats.getFailedRecords() + currentFailed);
  }

  public static boolean isDataInsightIndex(String entityType) {
    return Entity.getSearchRepository().getDataInsightReports().contains(entityType);
  }

  public static int getTotalRequestToProcess(Set<String> entities, CollectionDAO dao) {
    int total = 0;
    for (String entityType : entities) {
      if (!isDataInsightIndex(entityType)) {
        EntityRepository<?> repository = Entity.getEntityRepository(entityType);
        total += repository.getDao().listTotalCount();
      } else {
        total += dao.reportDataTimeSeriesDao().listCount(entityType);
      }
    }
    return total;
  }

  public static int getSuccessFromBulkResponse(BulkResponse response) {
    int success = 0;
    for (BulkItemResponse bulkItemResponse : response) {
      if (!bulkItemResponse.isFailed()) {
        success++;
      }
    }
    return success;
  }

  public static int getSuccessFromBulkResponseEs(es.org.elasticsearch.action.bulk.BulkResponse response) {
    int success = 0;
    for (es.org.elasticsearch.action.bulk.BulkItemResponse bulkItemResponse : response) {
      if (!bulkItemResponse.isFailed()) {
        success++;
      }
    }
    return success;
  }
}
