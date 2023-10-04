package org.openmetadata.service.search.elasticsearch;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.lucene.search.TotalHits;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.SearchHits;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.UnusedAssets;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.dataInsight.DataInsightAggregatorInterface;

// TODO: refactor this class and the interface in https://github.com/open-metadata/OpenMetadata/issues/13401
@Slf4j
public class EsUnusedAssetsAggregator extends DataInsightAggregatorInterface {
  final ObjectMapper mapper = new ObjectMapper();

  public EsUnusedAssetsAggregator(SearchHits hits, DataInsightChartResult.DataInsightChartType dataInsightChartType) {
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
    for (SearchHit hit : this.hitsEs) {
      try {
        HashMap<String, Object> data = (HashMap<String, Object>) hit.getSourceAsMap().get("data");
        Long lastAccessed =
            (Long)
                ((HashMap<String, Object>) ((HashMap<String, Object>) data.get("lifeCycle")).get("accessed"))
                    .get("timestamp");
        Double sizeInByte = (Double) data.get("sizeInByte");
        EntityReference entityReference = mapper.convertValue(data.get("entity"), EntityReference.class);
        UnusedAssets unusedAssets =
            new UnusedAssets().withEntity(entityReference).withLastAccessedAt(lastAccessed).withSizeInBytes(sizeInByte);
        dataList.add(unusedAssets);
      } catch (Exception e) {
        LOG.error("Error while parsing hits for UnusedData chart from ES", e);
      }
    }
    return dataList;
  }
}
