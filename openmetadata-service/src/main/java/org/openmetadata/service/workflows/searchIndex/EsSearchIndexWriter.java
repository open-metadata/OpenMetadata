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

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getSuccessFromBulkResponse;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.exception.WriterException;
import org.openmetadata.service.workflows.interfaces.Sink;

@Slf4j
public class EsSearchIndexWriter implements Sink<BulkRequest, BulkResponse> {
  private final StepStats stats = new StepStats();
  private final RestHighLevelClient client;

  EsSearchIndexWriter(RestHighLevelClient client) {
    this.client = client;
  }

  @Override
  public BulkResponse write(BulkRequest data, Map<String, Object> contextData) throws WriterException {
    LOG.debug("[EsSearchIndexWriter] Processing a Batch of Size: {}", data.numberOfActions());
    try {
      BulkResponse response = client.bulk(data, RequestOptions.DEFAULT);
      int currentSuccess = getSuccessFromBulkResponse(response);
      int currentFailed = response.getItems().length - currentSuccess;

      // Update Stats
      LOG.debug(
          "[EsSearchIndexWriter] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          data.numberOfActions(),
          currentSuccess,
          currentFailed);
      updateStats(currentSuccess, currentFailed);

      return response;
    } catch (Exception e) {
      LOG.debug(
          "[EsSearchIndexWriter] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          data.numberOfActions(),
          0,
          data.numberOfActions());
      updateStats(0, data.numberOfActions());
      throw new WriterException("[EsSearchIndexWriter] Batch encountered Exception. Failing Completely", e);
    }
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }
}
