package org.openmetadata.service.dataInsight;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.analytics.RawCostAnalysisReportData;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.UnusedAssets;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

@Slf4j
public abstract class UnusedAssetsAggregator<H extends Iterable<S>, S, T>
    implements DataInsightAggregatorInterface {
  private final H hits;

  protected UnusedAssetsAggregator(H hits) {
    this.hits = hits;
  }

  @Override
  public DataInsightChartResult process(DataInsightChartResult.DataInsightChartType chartType) {
    List<Object> data = this.aggregate();
    return new DataInsightChartResult()
        .withData(data)
        .withChartType(chartType)
        .withTotal(computeTotalHits(hits));
  }

  @Override
  public List<Object> aggregate() {
    List<Object> data = new ArrayList<>();
    ObjectMapper mapper = new ObjectMapper();
    for (S hit : this.hits) {
      try {
        Object dataObject = getDataFromSource(hit);
        RawCostAnalysisReportData rawCostAnalysisReportData =
            JsonUtils.readValue(
                mapper.writeValueAsString(dataObject), RawCostAnalysisReportData.class);
        EntityReference entityReference = rawCostAnalysisReportData.getEntity();
        Long lastAccessed = rawCostAnalysisReportData.getLifeCycle().getAccessed().getTimestamp();
        Double sizeInByte = rawCostAnalysisReportData.getSizeInByte();
        UnusedAssets unusedAssets =
            new UnusedAssets()
                .withEntity(entityReference)
                .withLastAccessedAt(lastAccessed)
                .withSizeInBytes(sizeInByte);
        data.add(unusedAssets);
      } catch (Exception e) {
        LOG.error("Error while parsing hits for UnusedData chart from ES", e);
      }
    }
    return data;
  }

  protected abstract Object getDataFromSource(S hit);

  protected abstract T totalHits(H hits);

  protected abstract Long getTotalHitsValue(T totalHits);

  private Integer computeTotalHits(H hits) {
    Long result = null;
    T totalHits = totalHits(hits);
    if (totalHits != null) {
      result = getTotalHitsValue(totalHits);
    }

    return result != null ? result.intValue() : null;
  }
}
