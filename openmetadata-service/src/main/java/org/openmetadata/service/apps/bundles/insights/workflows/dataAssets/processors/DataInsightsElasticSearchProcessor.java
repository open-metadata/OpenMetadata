package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors;

import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import org.openmetadata.service.search.elasticsearch.EsUtils;

public class DataInsightsElasticSearchProcessor
    extends AbstractDataInsightsBulkProcessor<BulkOperation> {

  public DataInsightsElasticSearchProcessor(int total) {
    super(total);
  }

  @Override
  protected BulkOperation buildIndexOperation(String index, String entityId, String docJson) {
    return BulkOperation.of(
        b -> b.index(i -> i.index(index).id(entityId).document(EsUtils.toJsonData(docJson))));
  }
}
