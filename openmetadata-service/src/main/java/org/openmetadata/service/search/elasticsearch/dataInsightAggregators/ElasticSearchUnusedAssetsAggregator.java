package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import es.co.elastic.clients.elasticsearch.core.search.Hit;
import es.co.elastic.clients.elasticsearch.core.search.HitsMetadata;
import es.co.elastic.clients.elasticsearch.core.search.TotalHits;
import es.co.elastic.clients.json.JsonData;
import java.util.List;
import org.openmetadata.service.dataInsight.UnusedAssetsAggregator;

public class ElasticSearchUnusedAssetsAggregator
    extends UnusedAssetsAggregator<List<Hit<JsonData>>, Hit<JsonData>, TotalHits> {
  private final HitsMetadata<JsonData> hitsMetadata;

  public ElasticSearchUnusedAssetsAggregator(HitsMetadata<JsonData> hitsMetadata) {
    super(hitsMetadata.hits());
    this.hitsMetadata = hitsMetadata;
  }

  @Override
  protected Object getDataFromSource(Hit<JsonData> hit) {
    return hit.source().toJson().asJsonObject().get("data");
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
