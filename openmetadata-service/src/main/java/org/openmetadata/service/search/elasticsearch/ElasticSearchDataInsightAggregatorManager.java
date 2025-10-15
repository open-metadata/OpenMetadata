package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.mapping.Property;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.indices.GetMappingResponse;
import es.co.elastic.clients.json.JsonData;
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
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchDynamicChartAggregatorFactory;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchDynamicChartAggregatorInterface;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchLineChartAggregator;

@Slf4j
public class ElasticSearchDataInsightAggregatorManager implements DataInsightAggregatorClient {
  private final ElasticsearchClient client;
  private final boolean isClientAvailable;

  public ElasticSearchDataInsightAggregatorManager(ElasticsearchClient client) {
    this.client = client;
    this.isClientAvailable = client != null;
  }

  @Override
  public DataInsightCustomChartResultList buildDIChart(
      @NotNull DataInsightCustomChart diChart, long start, long end, boolean live)
      throws IOException {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot build DI chart.");
      return null;
    }

    ElasticSearchDynamicChartAggregatorInterface aggregator =
        ElasticSearchDynamicChartAggregatorFactory.getAggregator(diChart);
    if (aggregator != null) {
      List<FormulaHolder> formulas = new ArrayList<>();
      Map<String, ElasticSearchLineChartAggregator.MetricFormulaHolder> metricFormulaHolder =
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
      LOG.error("ElasticSearch client is not available. Cannot fetch DI chart fields.");
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
      String prefix,
      List<Map<String, String>> fieldList,
      String entityType) {

    if (properties == null) {
      return;
    }

    for (Map.Entry<String, Property> entry : properties.entrySet()) {
      String fieldKey = entry.getKey();
      Property property = entry.getValue();

      if (property._kind() == null) {
        continue;
      }

      String type = property._kind().name().toLowerCase();
      String baseFieldName = prefix.isEmpty() ? fieldKey : prefix + "." + fieldKey;
      String adjustedFieldName = baseFieldName;

      if ("text".equals(type)) {
        if (property.isText()
            && property.text().fields() != null
            && property.text().fields().containsKey("keyword")) {
          adjustedFieldName = baseFieldName + ".keyword";
        }
      }

      String displayName = WordUtils.capitalize(baseFieldName.replace(".", " "));

      final String finalFieldName = adjustedFieldName;

      // Only add non-object/nested leaf fields
      if (!"object".equals(type) && !"nested".equals(type)) {
        if (fieldList.stream().noneMatch(e -> e.get("name").equals(finalFieldName))) {
          Map<String, String> fieldMap = new HashMap<>();
          fieldMap.put("name", finalFieldName);
          fieldMap.put("displayName", displayName);
          fieldMap.put("type", type);
          fieldMap.put("entityType", entityType);
          fieldList.add(fieldMap);
        }
      }

      // Recursively process nested or object fields
      if (property.isObject() && property.object().properties() != null) {
        getFieldNames(property.object().properties(), baseFieldName, fieldList, entityType);
      } else if (property.isNested() && property.nested().properties() != null) {
        getFieldNames(property.nested().properties(), baseFieldName, fieldList, entityType);
      }
    }
  }
}
