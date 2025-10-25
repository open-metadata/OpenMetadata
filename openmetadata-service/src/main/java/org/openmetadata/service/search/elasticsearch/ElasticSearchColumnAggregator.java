/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import es.org.elasticsearch.action.search.SearchRequest;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.client.RequestOptions;
import es.org.elasticsearch.client.RestHighLevelClient;
import es.org.elasticsearch.index.query.BoolQueryBuilder;
import es.org.elasticsearch.index.query.QueryBuilders;
import es.org.elasticsearch.search.SearchHit;
import es.org.elasticsearch.search.aggregations.AggregationBuilders;
import es.org.elasticsearch.search.aggregations.bucket.composite.CompositeAggregation;
import es.org.elasticsearch.search.aggregations.bucket.composite.CompositeAggregationBuilder;
import es.org.elasticsearch.search.aggregations.bucket.composite.TermsValuesSourceBuilder;
import es.org.elasticsearch.search.aggregations.metrics.TopHits;
import es.org.elasticsearch.search.aggregations.metrics.TopHitsAggregationBuilder;
import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import es.org.elasticsearch.search.sort.SortOrder;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.ColumnAggregator;
import org.openmetadata.service.search.ColumnMetadataGrouper;
import org.openmetadata.service.search.ColumnMetadataGrouper.ColumnWithContext;

@Slf4j
public class ElasticSearchColumnAggregator implements ColumnAggregator {
  private final RestHighLevelClient client;

  private static final String[] DATA_ASSET_INDEXES =
      new String[] {
        "table_search_index",
        "dashboard_data_model_search_index",
        "topic_search_index",
        "search_entity_search_index",
        "container_search_index"
      };

  private static final String[] COLUMN_SOURCE_FIELDS =
      new String[] {
        "fullyQualifiedName",
        "entityType",
        "displayName",
        "service.name",
        "database.name",
        "databaseSchema.name",
        "columns"
      };

  public ElasticSearchColumnAggregator(RestHighLevelClient client) {
    this.client = client;
  }

  @Override
  public ColumnGridResponse aggregateColumns(ColumnAggregationRequest request) throws IOException {
    SearchSourceBuilder searchSource = buildCompositeAggregation(request);
    BoolQueryBuilder queryBuilder = buildFilters(request);
    searchSource.query(queryBuilder);

    SearchResponse response = executeSearch(searchSource);

    Map<String, List<ColumnWithContext>> columnsByName = parseAggregationResults(response);

    List<ColumnGridItem> gridItems = ColumnMetadataGrouper.groupColumns(columnsByName);

    String cursor = extractCursor(response);
    boolean hasMore = cursor != null;

    // Get accurate total counts (only needed on first request)
    int totalUniqueColumns;
    int totalOccurrences;
    if (request.getCursor() == null) {
      // First page: execute count query to get accurate totals
      Map<String, Long> totals = getTotalCounts(queryBuilder);
      totalUniqueColumns = totals.get("uniqueColumns").intValue();
      totalOccurrences = totals.get("totalOccurrences").intValue();
    } else {
      // Subsequent pages: use current page counts (will be ignored by frontend since it caches first response)
      totalUniqueColumns = columnsByName.size();
      totalOccurrences = gridItems.stream().mapToInt(ColumnGridItem::getTotalOccurrences).sum();
    }

    return buildResponse(gridItems, cursor, hasMore, totalUniqueColumns, totalOccurrences);
  }

  private SearchSourceBuilder buildCompositeAggregation(ColumnAggregationRequest request) {
    CompositeAggregationBuilder composite =
        AggregationBuilders.composite(
                "unique_columns",
                Arrays.asList(
                    new TermsValuesSourceBuilder("column_name")
                        .field("columns.name.keyword")
                        .order(SortOrder.ASC)))
            .size(request.getSize());

    if (request.getCursor() != null) {
      Map<String, Object> afterKey = decodeCursor(request.getCursor());
      composite.aggregateAfter(afterKey);
    }

    TopHitsAggregationBuilder topHits =
        AggregationBuilders.topHits("sample_docs")
            .size(100)
            .fetchSource(COLUMN_SOURCE_FIELDS, null);

    composite.subAggregation(topHits);

    SearchSourceBuilder source = new SearchSourceBuilder();
    source.aggregation(composite);
    source.size(0);

    return source;
  }

  private BoolQueryBuilder buildFilters(ColumnAggregationRequest request) {
    BoolQueryBuilder query = QueryBuilders.boolQuery();

    query.filter(QueryBuilders.existsQuery("columns"));

    if (request.getEntityTypes() != null && !request.getEntityTypes().isEmpty()) {
      query.filter(QueryBuilders.termsQuery("entityType", request.getEntityTypes()));
    }

    if (!nullOrEmpty(request.getServiceName())) {
      query.filter(QueryBuilders.termQuery("service.name.keyword", request.getServiceName()));
    }

    if (!nullOrEmpty(request.getDatabaseName())) {
      query.filter(QueryBuilders.termQuery("database.name.keyword", request.getDatabaseName()));
    }

    if (!nullOrEmpty(request.getSchemaName())) {
      query.filter(QueryBuilders.termQuery("databaseSchema.name.keyword", request.getSchemaName()));
    }

    if (!nullOrEmpty(request.getColumnNamePattern())) {
      query.filter(
          QueryBuilders.wildcardQuery(
              "columns.name.keyword", "*" + request.getColumnNamePattern() + "*"));
    }

    return query;
  }

  private SearchResponse executeSearch(SearchSourceBuilder searchSource) throws IOException {
    SearchRequest searchRequest = new SearchRequest(DATA_ASSET_INDEXES);
    searchRequest.source(searchSource);

    return client.search(searchRequest, RequestOptions.DEFAULT);
  }

  private Map<String, List<ColumnWithContext>> parseAggregationResults(SearchResponse response) {
    Map<String, List<ColumnWithContext>> columnsByName = new HashMap<>();

    CompositeAggregation compositeAgg = response.getAggregations().get("unique_columns");

    if (compositeAgg == null || compositeAgg.getBuckets().isEmpty()) {
      return columnsByName;
    }

    for (CompositeAggregation.Bucket bucket : compositeAgg.getBuckets()) {
      String columnName = bucket.getKey().get("column_name").toString();

      TopHits topHits = bucket.getAggregations().get("sample_docs");
      if (topHits == null || topHits.getHits() == null) {
        continue;
      }

      List<ColumnWithContext> occurrences = new ArrayList<>();

      for (SearchHit hit : topHits.getHits().getHits()) {
        try {
          Map<String, Object> sourceMap = hit.getSourceAsMap();
          String entityType = (String) sourceMap.get("entityType");
          String entityFQN = (String) sourceMap.get("fullyQualifiedName");
          String entityDisplayName = (String) sourceMap.get("displayName");

          String serviceName = extractNestedField(sourceMap, "service", "name");
          String databaseName = extractNestedField(sourceMap, "database", "name");
          String schemaName = extractNestedField(sourceMap, "databaseSchema", "name");

          @SuppressWarnings("unchecked")
          List<Map<String, Object>> columnsData =
              (List<Map<String, Object>>) sourceMap.get("columns");

          if (columnsData != null) {
            for (Map<String, Object> columnData : columnsData) {
              String colName = (String) columnData.get("name");
              if (columnName.equals(colName)) {
                Column column = parseColumn(columnData, entityFQN);

                ColumnWithContext columnCtx =
                    new ColumnWithContext(
                        column,
                        entityType,
                        entityFQN,
                        entityDisplayName,
                        serviceName,
                        databaseName,
                        schemaName);

                occurrences.add(columnCtx);
                break;
              }
            }
          }
        } catch (Exception e) {
          LOG.warn("Failed to parse column occurrence from search hit", e);
        }
      }

      if (!occurrences.isEmpty()) {
        columnsByName.put(columnName, occurrences);
      }
    }

    return columnsByName;
  }

  private Column parseColumn(Map<String, Object> columnData, String parentFQN) {
    Column column = new Column();
    column.setName((String) columnData.get("name"));
    column.setDisplayName((String) columnData.get("displayName"));
    column.setDescription((String) columnData.get("description"));
    column.setDataType(parseDataType((String) columnData.get("dataType")));

    String columnFQN = (String) columnData.get("fullyQualifiedName");
    if (columnFQN == null && parentFQN != null) {
      columnFQN = parentFQN + "." + column.getName();
    }
    column.setFullyQualifiedName(columnFQN);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> tagsData = (List<Map<String, Object>>) columnData.get("tags");
    if (tagsData != null) {
      List<TagLabel> tags = new ArrayList<>();
      for (Map<String, Object> tagData : tagsData) {
        TagLabel tag = new TagLabel();
        tag.setTagFQN((String) tagData.get("tagFQN"));
        tag.setLabelType(TagLabel.LabelType.fromValue((String) tagData.get("labelType")));
        tag.setSource(TagLabel.TagSource.fromValue((String) tagData.get("source")));
        tag.setState(TagLabel.State.fromValue((String) tagData.get("state")));
        tags.add(tag);
      }
      column.setTags(tags);
    }

    return column;
  }

  private ColumnDataType parseDataType(String dataType) {
    if (dataType == null) {
      return null;
    }
    try {
      return ColumnDataType.fromValue(dataType);
    } catch (Exception e) {
      LOG.warn("Unknown data type: {}", dataType);
      return null;
    }
  }

  private String extractNestedField(Map<String, Object> source, String parent, String field) {
    @SuppressWarnings("unchecked")
    Map<String, Object> parentMap = (Map<String, Object>) source.get(parent);
    if (parentMap != null) {
      return (String) parentMap.get(field);
    }
    return null;
  }

  private String extractCursor(SearchResponse response) {
    CompositeAggregation compositeAgg = response.getAggregations().get("unique_columns");

    if (compositeAgg == null || compositeAgg.afterKey() == null) {
      return null;
    }

    return encodeCursor(compositeAgg.afterKey());
  }

  private String encodeCursor(Map<String, Object> afterKey) {
    try {
      String json = JsonUtils.pojoToJson(afterKey);
      return Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      LOG.error("Failed to encode cursor", e);
      return null;
    }
  }

  private Map<String, Object> decodeCursor(String cursor) {
    try {
      byte[] decoded = Base64.getDecoder().decode(cursor);
      String json = new String(decoded, StandardCharsets.UTF_8);
      return JsonUtils.readValue(json, Map.class);
    } catch (Exception e) {
      LOG.error("Failed to decode cursor", e);
      return new HashMap<>();
    }
  }

  private Map<String, Long> getTotalCounts(BoolQueryBuilder queryBuilder) throws IOException {
    SearchSourceBuilder countSource = new SearchSourceBuilder();
    countSource.query(queryBuilder);
    countSource.size(0);

    // Cardinality aggregation to count unique column names
    countSource.aggregation(
        AggregationBuilders.cardinality("unique_column_names")
            .field("columns.name.keyword")
            .precisionThreshold(40000));

    // Script to count total occurrences (sum of array lengths)
    countSource.aggregation(
        AggregationBuilders.sum("total_column_occurrences")
            .script(
                new es.org.elasticsearch.script.Script(
                    "doc['columns.name.keyword'].size()")));

    SearchResponse countResponse = executeSearch(countSource);

    es.org.elasticsearch.search.aggregations.metrics.Cardinality uniqueColumns =
        countResponse.getAggregations().get("unique_column_names");
    es.org.elasticsearch.search.aggregations.metrics.Sum totalOccurrences =
        countResponse.getAggregations().get("total_column_occurrences");

    Map<String, Long> totals = new HashMap<>();
    totals.put("uniqueColumns", uniqueColumns.getValue());
    totals.put("totalOccurrences", (long) totalOccurrences.getValue());

    return totals;
  }

  private ColumnGridResponse buildResponse(
      List<ColumnGridItem> gridItems, String cursor, boolean hasMore, int totalUniqueColumns, int totalOccurrences) {
    ColumnGridResponse response = new ColumnGridResponse();
    response.setColumns(gridItems);
    response.setTotalUniqueColumns(totalUniqueColumns);
    response.setTotalOccurrences(totalOccurrences);
    response.setCursor(cursor);

    return response;
  }
}
