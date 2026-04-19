package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors;

import org.openmetadata.service.search.opensearch.OsUtils;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;

public class DataInsightsOpenSearchProcessor
    extends AbstractDataInsightsBulkProcessor<BulkOperation> {

  public DataInsightsOpenSearchProcessor(int total) {
    super(total);
  }

  @Override
  protected BulkOperation buildIndexOperation(String index, String entityId, String docJson) {
    return BulkOperation.of(
        b -> b.index(i -> i.index(index).id(entityId).document(OsUtils.toJsonData(docJson))));
  }
}
