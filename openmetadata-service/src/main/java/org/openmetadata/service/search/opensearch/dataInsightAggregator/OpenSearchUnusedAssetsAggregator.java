package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import java.util.List;
import org.openmetadata.service.dataInsight.UnusedAssetsAggregator;
import org.openmetadata.service.search.opensearch.OsUtils;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.core.search.Hit;
import os.org.opensearch.client.opensearch.core.search.HitsMetadata;
import os.org.opensearch.client.opensearch.core.search.TotalHits;

public class OpenSearchUnusedAssetsAggregator
    extends UnusedAssetsAggregator<List<Hit<JsonData>>, Hit<JsonData>, TotalHits> {
  private final HitsMetadata<JsonData> hitsMetadata;

  public OpenSearchUnusedAssetsAggregator(HitsMetadata<JsonData> hitsMetadata) {
    super(hitsMetadata.hits());
    this.hitsMetadata = hitsMetadata;
  }

  @Override
  protected Object getDataFromSource(Hit<JsonData> hit) {
    return OsUtils.jsonDataToMap(hit.source()).get("data");
  }

  @Override
  protected TotalHits totalHits(List<Hit<JsonData>> hits) {
    return hitsMetadata.total();
  }

  @Override
  protected Long getTotalHitsValue(TotalHits totalHits) {
    return totalHits.value();
  }
}
