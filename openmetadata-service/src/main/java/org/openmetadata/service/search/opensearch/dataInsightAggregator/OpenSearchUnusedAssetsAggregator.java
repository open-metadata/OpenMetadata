package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import org.openmetadata.service.dataInsight.UnusedAssetsAggregator;
import os.org.apache.lucene.search.TotalHits;
import os.org.opensearch.search.SearchHit;
import os.org.opensearch.search.SearchHits;

public class OpenSearchUnusedAssetsAggregator extends UnusedAssetsAggregator<SearchHits, SearchHit, TotalHits> {
  public OpenSearchUnusedAssetsAggregator(SearchHits hits) {
    super(hits);
  }

  @Override
  protected Object getDataFromSource(SearchHit hit) {
    return hit.getSourceAsMap().get("data");
  }

  @Override
  protected TotalHits totalHits(SearchHits hits) {
    return hits.getTotalHits();
  }

  @Override
  protected Long getTotalHitsValue(TotalHits totalHits) {
    return totalHits.value;
  }
}
