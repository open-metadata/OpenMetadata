package org.openmetadata.service.search.opensearch;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.lucene.search.TotalHits;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.UnusedAssets;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;
import org.opensearch.search.SearchHit;
import org.opensearch.search.SearchHits;

@Slf4j
public class OsUnusedAssetsAggregator extends DataInsightAggregatorInterface {
  public OsUnusedAssetsAggregator(SearchHits hits, DataInsightChartResult.DataInsightChartType dataInsightChartType) {
    super(hits, dataInsightChartType);
  }

  @Override
  public DataInsightChartResult process() throws ParseException {
    List<Object> data = this.aggregate();
    Long hits = null;
    TotalHits totalHits = this.hitsEs.getTotalHits();
    if (totalHits != null) {
      hits = totalHits.value;
    }
    return new DataInsightChartResult()
        .withData(data)
        .withChartType(this.dataInsightChartType)
        .withTotal(hits != null ? hits.intValue() : null);
  }

  @Override
  public List<Object> aggregate() throws ParseException {
    List<Object> dataList = new ArrayList<>();
    for (SearchHit hit : this.hitsOs) {
      try {
        HashMap<String, Object> data = (HashMap<String, Object>) hit.getSourceAsMap().get("data");
        String fqn = ((HashMap<String, String>) data.get("entity")).get("fullyQualifiedName");
        Long lastAccessed =
            (Long)
                ((HashMap<String, Object>) ((HashMap<String, Object>) data.get("lifeCycle")).get("accessed"))
                    .get("timestamp");
        Double sizeInByte = (Double) data.get("sizeInByte");
        new UnusedAssets().withFullyQualifiedName(fqn).withLastAccessedAt(lastAccessed).withSizeInBytes(sizeInByte);
        dataList.add(
            new UnusedAssets()
                .withFullyQualifiedName(fqn)
                .withLastAccessedAt(lastAccessed)
                .withSizeInBytes(sizeInByte));
      } catch (Exception e) {
        LOG.error("Error while parsing hits for UnusedData chart from ES", e);
      }
    }
    return dataList;
  }
}
