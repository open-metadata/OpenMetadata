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

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.SortOrder;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.CompositeAggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.CompositeAggregationSource;
import es.co.elastic.clients.elasticsearch._types.aggregations.CompositeBucket;
import es.co.elastic.clients.elasticsearch._types.aggregations.TopHitsAggregate;
import es.co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.core.search.Hit;
import es.co.elastic.clients.json.JsonData;
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
  private final ElasticsearchClient client;

  private static final List<String> DATA_ASSET_INDEXES =
      Arrays.asList(
          "table_search_index",
          "dashboard_data_model_search_index",
          "topic_search_index",
          "search_entity_search_index",
          "container_search_index");

  private static final List<String> COLUMN_SOURCE_FIELDS =
      Arrays.asList(
          "fullyQualifiedName",
          "entityType",
          "displayName",
          "service.name",
          "database.name",
          "databaseSchema.name",
          "columns");

  public ElasticSearchColumnAggregator(ElasticsearchClient client) {
    this.client = client;
  }

  @Override
  public ColumnGridResponse aggregateColumns(ColumnAggregationRequest request) throws IOException {
    Query query = buildFilters(request);
    SearchResponse<JsonData> response = executeSearch(request, query);

    Map<String, List<ColumnWithContext>> columnsByName = parseAggregationResults(response);

    List<ColumnGridItem> gridItems = ColumnMetadataGrouper.groupColumns(columnsByName);

    String cursor = extractCursor(response);
    boolean hasMore = cursor != null;

    int totalUniqueColumns;
    int totalOccurrences;
    if (request.getCursor() == null) {
      Map<String, Long> totals = getTotalCounts(query);
      totalUniqueColumns = totals.get("uniqueColumns").intValue();
      totalOccurrences = totals.get("totalOccurrences").intValue();
    } else {
      totalUniqueColumns = columnsByName.size();
      totalOccurrences = gridItems.stream().mapToInt(ColumnGridItem::getTotalOccurrences).sum();
    }

    return buildResponse(gridItems, cursor, hasMore, totalUniqueColumns, totalOccurrences);
  }

  private Query buildFilters(ColumnAggregationRequest request) {
    BoolQuery.Builder boolBuilder = new BoolQuery.Builder();

    boolBuilder.filter(Query.of(q -> q.exists(e -> e.field("columns"))));

    if (request.getEntityTypes() != null && !request.getEntityTypes().isEmpty()) {
      List<FieldValue> entityTypeValues =
          request.getEntityTypes().stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(
              q -> q.terms(t -> t.field("entityType").terms(tv -> tv.value(entityTypeValues)))));
    }

    if (!nullOrEmpty(request.getServiceName())) {
      boolBuilder.filter(
          Query.of(
              q -> q.term(t -> t.field("service.name.keyword").value(request.getServiceName()))));
    }

    if (!nullOrEmpty(request.getDatabaseName())) {
      boolBuilder.filter(
          Query.of(
              q -> q.term(t -> t.field("database.name.keyword").value(request.getDatabaseName()))));
    }

    if (!nullOrEmpty(request.getSchemaName())) {
      boolBuilder.filter(
          Query.of(
              q ->
                  q.term(
                      t -> t.field("databaseSchema.name.keyword").value(request.getSchemaName()))));
    }

    if (!nullOrEmpty(request.getColumnNamePattern())) {
      boolBuilder.filter(
          Query.of(
              q ->
                  q.wildcard(
                      w ->
                          w.field("columns.name.keyword")
                              .value("*" + request.getColumnNamePattern() + "*"))));
    }

    return Query.of(q -> q.bool(boolBuilder.build()));
  }

  private SearchResponse<JsonData> executeSearch(ColumnAggregationRequest request, Query query)
      throws IOException {
    Map<String, CompositeAggregationSource> sources = new HashMap<>();
    sources.put(
        "column_name",
        CompositeAggregationSource.of(
            cas -> cas.terms(t -> t.field("columns.name.keyword").order(SortOrder.Asc))));

    Aggregation topHitsAgg =
        Aggregation.of(
            a ->
                a.topHits(
                    th ->
                        th.size(100).source(s -> s.filter(f -> f.includes(COLUMN_SOURCE_FIELDS)))));

    Map<String, Aggregation> subAggs = new HashMap<>();
    subAggs.put("sample_docs", topHitsAgg);

    Map<String, FieldValue> afterKey =
        request.getCursor() != null ? decodeCursor(request.getCursor()) : null;

    Aggregation compositeAgg =
        Aggregation.of(
            a ->
                a.composite(
                        c -> {
                          c.sources(List.of(sources));
                          c.size(request.getSize());
                          if (afterKey != null) {
                            c.after(afterKey);
                          }
                          return c;
                        })
                    .aggregations(subAggs));

    Map<String, Aggregation> aggs = new HashMap<>();
    aggs.put("unique_columns", compositeAgg);

    SearchRequest searchRequest =
        SearchRequest.of(s -> s.index(DATA_ASSET_INDEXES).query(query).aggregations(aggs).size(0));

    return client.search(searchRequest, JsonData.class);
  }

  private Map<String, List<ColumnWithContext>> parseAggregationResults(
      SearchResponse<JsonData> response) {
    Map<String, List<ColumnWithContext>> columnsByName = new HashMap<>();

    if (response.aggregations() == null || !response.aggregations().containsKey("unique_columns")) {
      return columnsByName;
    }

    CompositeAggregate compositeAgg = response.aggregations().get("unique_columns").composite();

    if (compositeAgg == null || compositeAgg.buckets().array().isEmpty()) {
      return columnsByName;
    }

    for (CompositeBucket bucket : compositeAgg.buckets().array()) {
      String columnName = bucket.key().get("column_name").stringValue();

      if (!bucket.aggregations().containsKey("sample_docs")) {
        continue;
      }

      TopHitsAggregate topHits = bucket.aggregations().get("sample_docs").topHits();
      if (topHits == null || topHits.hits() == null || topHits.hits().hits().isEmpty()) {
        continue;
      }

      List<ColumnWithContext> occurrences = new ArrayList<>();

      for (Hit<JsonData> hit : topHits.hits().hits()) {
        try {
          JsonData source = hit.source();
          if (source == null) continue;

          JsonNode sourceNode = source.to(JsonNode.class);
          String entityType = getTextField(sourceNode, "entityType");
          String entityFQN = getTextField(sourceNode, "fullyQualifiedName");
          String entityDisplayName = getTextField(sourceNode, "displayName");

          String serviceName = getNestedField(sourceNode, "service", "name");
          String databaseName = getNestedField(sourceNode, "database", "name");
          String schemaName = getNestedField(sourceNode, "databaseSchema", "name");

          JsonNode columnsData = sourceNode.get("columns");

          if (columnsData != null && columnsData.isArray()) {
            for (JsonNode columnData : columnsData) {
              String colName = getTextField(columnData, "name");
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

  private String getTextField(JsonNode node, String field) {
    JsonNode fieldNode = node.get(field);
    return fieldNode != null && !fieldNode.isNull() ? fieldNode.asText() : null;
  }

  private String getNestedField(JsonNode source, String parent, String field) {
    JsonNode parentNode = source.get(parent);
    if (parentNode != null && !parentNode.isNull()) {
      JsonNode fieldNode = parentNode.get(field);
      return fieldNode != null && !fieldNode.isNull() ? fieldNode.asText() : null;
    }
    return null;
  }

  private Column parseColumn(JsonNode columnData, String parentFQN) {
    Column column = new Column();
    column.setName(getTextField(columnData, "name"));
    column.setDisplayName(getTextField(columnData, "displayName"));
    column.setDescription(getTextField(columnData, "description"));
    column.setDataType(parseDataType(getTextField(columnData, "dataType")));

    String columnFQN = getTextField(columnData, "fullyQualifiedName");
    if (columnFQN == null && parentFQN != null) {
      columnFQN = parentFQN + "." + column.getName();
    }
    column.setFullyQualifiedName(columnFQN);

    JsonNode tagsData = columnData.get("tags");
    if (tagsData != null && tagsData.isArray()) {
      List<TagLabel> tags = new ArrayList<>();
      for (JsonNode tagData : tagsData) {
        TagLabel tag = new TagLabel();
        tag.setTagFQN(getTextField(tagData, "tagFQN"));
        String labelType = getTextField(tagData, "labelType");
        if (labelType != null) {
          tag.setLabelType(TagLabel.LabelType.fromValue(labelType));
        }
        String source = getTextField(tagData, "source");
        if (source != null) {
          tag.setSource(TagLabel.TagSource.fromValue(source));
        }
        String state = getTextField(tagData, "state");
        if (state != null) {
          tag.setState(TagLabel.State.fromValue(state));
        }
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

  private String extractCursor(SearchResponse<JsonData> response) {
    if (response.aggregations() == null || !response.aggregations().containsKey("unique_columns")) {
      return null;
    }

    CompositeAggregate compositeAgg = response.aggregations().get("unique_columns").composite();

    if (compositeAgg == null
        || compositeAgg.afterKey() == null
        || compositeAgg.afterKey().isEmpty()) {
      return null;
    }

    return encodeCursor(compositeAgg.afterKey());
  }

  private String encodeCursor(Map<String, FieldValue> afterKey) {
    try {
      Map<String, String> stringMap = new HashMap<>();
      for (Map.Entry<String, FieldValue> entry : afterKey.entrySet()) {
        stringMap.put(entry.getKey(), entry.getValue().stringValue());
      }
      String json = JsonUtils.pojoToJson(stringMap);
      return Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      LOG.error("Failed to encode cursor", e);
      return null;
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, FieldValue> decodeCursor(String cursor) {
    try {
      byte[] decoded = Base64.getDecoder().decode(cursor);
      String json = new String(decoded, StandardCharsets.UTF_8);
      Map<String, String> stringMap = JsonUtils.readValue(json, Map.class);
      Map<String, FieldValue> result = new HashMap<>();
      for (Map.Entry<String, String> entry : stringMap.entrySet()) {
        result.put(entry.getKey(), FieldValue.of(entry.getValue()));
      }
      return result;
    } catch (Exception e) {
      LOG.error("Failed to decode cursor", e);
      return new HashMap<>();
    }
  }

  private Map<String, Long> getTotalCounts(Query query) throws IOException {
    Aggregation cardinalityAgg =
        Aggregation.of(
            a -> a.cardinality(c -> c.field("columns.name.keyword").precisionThreshold(40000)));

    Aggregation sumAgg =
        Aggregation.of(
            a ->
                a.scriptedMetric(
                    sm ->
                        sm.initScript(s -> s.inline(i -> i.source("state.total = 0")))
                            .mapScript(
                                s ->
                                    s.inline(
                                        i ->
                                            i.source(
                                                "if (doc.containsKey('columns.name.keyword')) { state.total += doc['columns.name.keyword'].size() }")))
                            .combineScript(s -> s.inline(i -> i.source("return state.total")))
                            .reduceScript(
                                s ->
                                    s.inline(
                                        i ->
                                            i.source(
                                                "long total = 0; for (state in states) { total += state } return total")))));

    Map<String, Aggregation> aggs = new HashMap<>();
    aggs.put("unique_column_names", cardinalityAgg);
    aggs.put("total_column_occurrences", sumAgg);

    SearchRequest countRequest =
        SearchRequest.of(s -> s.index(DATA_ASSET_INDEXES).query(query).aggregations(aggs).size(0));

    SearchResponse<JsonData> countResponse = client.search(countRequest, JsonData.class);

    long uniqueColumns = 0;
    long totalOccurrences = 0;

    if (countResponse.aggregations() != null) {
      if (countResponse.aggregations().containsKey("unique_column_names")) {
        uniqueColumns =
            countResponse.aggregations().get("unique_column_names").cardinality().value();
      }
      if (countResponse.aggregations().containsKey("total_column_occurrences")) {
        JsonData result =
            countResponse.aggregations().get("total_column_occurrences").scriptedMetric().value();
        if (result != null) {
          totalOccurrences = result.to(Long.class);
        }
      }
    }

    Map<String, Long> totals = new HashMap<>();
    totals.put("uniqueColumns", uniqueColumns);
    totals.put("totalOccurrences", totalOccurrences);

    return totals;
  }

  private ColumnGridResponse buildResponse(
      List<ColumnGridItem> gridItems,
      String cursor,
      boolean hasMore,
      int totalUniqueColumns,
      int totalOccurrences) {
    ColumnGridResponse response = new ColumnGridResponse();
    response.setColumns(gridItems);
    response.setTotalUniqueColumns(totalUniqueColumns);
    response.setTotalOccurrences(totalOccurrences);
    response.setCursor(cursor);

    return response;
  }
}
