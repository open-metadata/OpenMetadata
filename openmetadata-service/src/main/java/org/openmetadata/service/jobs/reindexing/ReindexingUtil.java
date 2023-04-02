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

package org.openmetadata.service.jobs.reindexing;

import java.util.Set;
import org.elasticsearch.action.bulk.BulkItemResponse;
import org.elasticsearch.action.bulk.BulkResponse;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.jdbi3.EntityRepository;

public class ReindexingUtil {
  public static final String ENTITY_TYPE_KEY = "entityType";

  public static void getUpdatedStats(StepStats stats, int currentSuccess, int currentFailed) {
    stats.setTotalRecords(stats.getTotalRecords() + currentSuccess + currentFailed);
    stats.setTotalSuccessRecords(stats.getTotalSuccessRecords() + currentSuccess);
    stats.setTotalFailedRecords(stats.getTotalFailedRecords() + currentFailed);
  }

  public static boolean isDataInsightIndex(String entityType) {
    return entityType.equalsIgnoreCase(ElasticSearchIndexDefinition.ENTITY_REPORT_DATA)
        || entityType.equalsIgnoreCase(ElasticSearchIndexDefinition.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA)
        || entityType.equalsIgnoreCase(ElasticSearchIndexDefinition.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA);
  }

  public static int getTotalRequestToProcess(Set<String> entities) {
    int total = 0;
    for (String entityType : entities) {
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      total += repository.dao.listTotalCount();
    }
    return total;
  }

  public static int getSuccessFromBulkResponse(BulkResponse response) {
    int success = 0;
    for (BulkItemResponse bulkItemResponse : response) {
      if (!bulkItemResponse.isFailed()) {
        success++;
      }
      ;
    }
    return success;
  }
}
