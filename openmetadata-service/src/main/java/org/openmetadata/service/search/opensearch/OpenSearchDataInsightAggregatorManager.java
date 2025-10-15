package org.openmetadata.service.search.opensearch;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.text.WordUtils;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.FormulaHolder;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.search.DataInsightAggregatorClient;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchDynamicChartAggregatorFactory;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchDynamicChartAggregatorInterface;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchLineChartAggregator;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.mapping.Property;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.indices.GetMappingResponse;

@Slf4j
public class OpenSearchDataInsightAggregatorManager implements DataInsightAggregatorClient {
  private final OpenSearchClient client;
  private final boolean isClientAvailable;

  public OpenSearchDataInsightAggregatorManager(OpenSearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
  }

  @Override
  public DataInsightCustomChartResultList buildDIChart(
      @NotNull DataInsightCustomChart diChart, long start, long end, boolean live)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot build DI chart.");
      return null;
    }

    OpenSearchDynamicChartAggregatorInterface aggregator =
        OpenSearchDynamicChartAggregatorFactory.getAggregator(diChart);
    if (aggregator != null) {
      List<FormulaHolder> formulas = new ArrayList<>();
      Map<String, OpenSearchLineChartAggregator.MetricFormulaHolder> metricFormulaHolder =
          new HashMap<>();
      SearchRequest searchRequest =
          aggregator.prepareSearchRequest(diChart, start, end, formulas, metricFormulaHolder, live);
      SearchResponse<JsonData> searchResponse = client.search(searchRequest, JsonData.class);
      return aggregator.processSearchResponse(
          diChart, searchResponse, formulas, metricFormulaHolder);
    }
    return null;
  }

  @Override
  public List<Map<String, String>> fetchDIChartFields() {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot fetch DI chart fields.");
      return new ArrayList<>();
    }

    List<Map<String, String>> fields = new ArrayList<>();
    for (String type : DataInsightSystemChartRepository.dataAssetTypes) {
      try {
        String indexName =
            DataInsightSystemChartRepository.getDataInsightsIndexPrefix()
                + "-"
                + type.toLowerCase();

        GetMappingResponse response = client.indices().getMapping(m -> m.index(indexName));

        response
            .result()
            .forEach(
                (index, indexMappings) -> {
                  if (indexMappings.mappings().properties() != null) {
                    getFieldNames(indexMappings.mappings().properties(), "", fields, type);
                  }
                });
      } catch (Exception e) {
        LOG.error("Failed to get mappings for type: {}", type, e);
      }
    }
    return fields;
  }

  private void getFieldNames(
      Map<String, Property> properties,
      String parent,
      List<Map<String, String>> fields,
      String entityType) {

    if (properties == null) return;

    for (Map.Entry<String, Property> entry : properties.entrySet()) {

      String fieldKey = entry.getKey();
      Property property = entry.getValue();

      if (property._kind() == null) continue;

      String type = property._kind().name().toLowerCase();
      String baseFieldName = parent.isEmpty() ? fieldKey : parent + "." + fieldKey;
      String adjustedFieldName = baseFieldName;

      // Check if it's a "text" field with a .keyword subfield
      if ("text".equals(type)) {
        if (property.isText()
            && property.text().fields() != null
            && property.text().fields().containsKey("keyword")) {
          adjustedFieldName = baseFieldName + ".keyword";
        }
      }

      String displayName = WordUtils.capitalize(baseFieldName.replace(".", " "));
      final String finalFieldName = adjustedFieldName;

      if (!"object".equals(type) && !"nested".equals(type)) {
        // Deduplicate
        if (fields.stream().noneMatch(f -> f.get("name").equals(finalFieldName))) {
          Map<String, String> fieldMap = new HashMap<>();
          fieldMap.put("name", finalFieldName);
          fieldMap.put("displayName", displayName);
          fieldMap.put("type", type);
          fieldMap.put("entityType", entityType);
          fields.add(fieldMap);
        }
      }

      // Recurse into nested/object fields
      if (property.isObject() && property.object().properties() != null) {
        getFieldNames(property.object().properties(), baseFieldName, fields, entityType);
      } else if (property.isNested() && property.nested().properties() != null) {
        getFieldNames(property.nested().properties(), baseFieldName, fields, entityType);
      }
    }
  }
}
