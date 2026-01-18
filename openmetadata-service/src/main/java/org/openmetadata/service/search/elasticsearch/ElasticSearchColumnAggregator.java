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
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
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

  /** Index configuration with field mappings for each entity type */
  private static final Map<String, IndexConfig> INDEX_CONFIGS =
      Map.of(
          "table",
          new IndexConfig("table_search_index", "columns", "columns.name.keyword"),
          "dashboardDataModel",
          new IndexConfig("dashboard_data_model_search_index", "columns", "columns.name.keyword"),
          "topic",
          new IndexConfig(
              "topic_search_index",
              "messageSchema.schemaFields",
              "messageSchema.schemaFields.name.keyword"),
          "searchIndex",
          new IndexConfig("search_entity_search_index", "fields", "fields.name.keyword"),
          "container",
          new IndexConfig(
              "container_search_index", "dataModel.columns", "dataModel.columns.name.keyword"));

  /** Simple record to hold index configuration */
  private record IndexConfig(String indexName, String columnFieldPath, String columnNameKeyword) {}

  private static final List<String> BASE_SOURCE_FIELDS =
      Arrays.asList(
          "fullyQualifiedName",
          "entityType",
          "displayName",
          "service.name",
          "database.name",
          "databaseSchema.name");

  public ElasticSearchColumnAggregator(ElasticsearchClient client) {
    this.client = client;
  }

  @Override
  public ColumnGridResponse aggregateColumns(ColumnAggregationRequest request) throws IOException {
    List<String> entityTypes = getEntityTypesForRequest(request);
    Map<String, List<ColumnWithContext>> allColumnsByName = new HashMap<>();
    long totalUniqueColumns = 0;
    long totalOccurrences = 0;
    String lastCursor = null;
    boolean hasMore = false;

    // Group entity types by their column field path to minimize queries
    Map<String, List<String>> fieldPathToEntityTypes = groupByFieldPath(entityTypes);

    for (Map.Entry<String, List<String>> entry : fieldPathToEntityTypes.entrySet()) {
      String columnNameKeyword = entry.getKey();
      List<String> groupEntityTypes = entry.getValue();

      List<String> indexes =
          groupEntityTypes.stream().map(et -> INDEX_CONFIGS.get(et).indexName()).toList();

      String columnFieldPath = INDEX_CONFIGS.get(groupEntityTypes.get(0)).columnFieldPath();

      Query query = buildFilters(request, columnNameKeyword);

      try {
        SearchResponse<JsonData> response =
            executeSearch(request, query, indexes, columnNameKeyword);

        Map<String, List<ColumnWithContext>> columnsByName =
            parseAggregationResults(response, columnFieldPath);

        // Merge results
        for (Map.Entry<String, List<ColumnWithContext>> colEntry : columnsByName.entrySet()) {
          allColumnsByName
              .computeIfAbsent(colEntry.getKey(), k -> new ArrayList<>())
              .addAll(colEntry.getValue());
        }

        String cursor = extractCursor(response);
        if (cursor != null) {
          lastCursor = cursor;
          hasMore = true;
        }

        // Get totals only on first page
        if (request.getCursor() == null) {
          Map<String, Long> totals = getTotalCounts(query, indexes, columnNameKeyword);
          totalUniqueColumns += totals.get("uniqueColumns");
          totalOccurrences += totals.get("totalOccurrences");
        }
      } catch (ElasticsearchException e) {
        if (isIndexNotFoundException(e)) {
          LOG.warn("Search index not found for indexes {}, returning empty results", indexes);
          continue;
        }
        throw e;
      }
    }

    List<ColumnGridItem> gridItems = ColumnMetadataGrouper.groupColumns(allColumnsByName);

    if (request.getCursor() != null) {
      totalUniqueColumns = allColumnsByName.size();
      totalOccurrences = gridItems.stream().mapToInt(ColumnGridItem::getTotalOccurrences).sum();
    }

    return buildResponse(
        gridItems, lastCursor, hasMore, (int) totalUniqueColumns, (int) totalOccurrences);
  }

  private boolean isIndexNotFoundException(ElasticsearchException e) {
    String message = e.getMessage();
    return message != null && message.contains("index_not_found_exception");
  }

  private String escapeWildcardPattern(String input) {
    if (input == null) {
      return null;
    }
    return input.replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?");
  }

  /** Get entity types to query - defaults to table only for performance */
  private List<String> getEntityTypesForRequest(ColumnAggregationRequest request) {
    if (request.getEntityTypes() == null || request.getEntityTypes().isEmpty()) {
      // Default to tables only for better performance on initial load
      return List.of("table");
    }
    return request.getEntityTypes().stream().filter(INDEX_CONFIGS::containsKey).toList();
  }

  /** Group entity types by their column field path to minimize queries */
  private Map<String, List<String>> groupByFieldPath(List<String> entityTypes) {
    Map<String, List<String>> result = new HashMap<>();
    for (String entityType : entityTypes) {
      IndexConfig config = INDEX_CONFIGS.get(entityType);
      if (config != null) {
        result.computeIfAbsent(config.columnNameKeyword(), k -> new ArrayList<>()).add(entityType);
      }
    }
    return result;
  }

  private Query buildFilters(ColumnAggregationRequest request, String columnNameKeyword) {
    BoolQuery.Builder boolBuilder = new BoolQuery.Builder();

    // Get the column field path (e.g., "columns" from "columns.name.keyword")
    String columnFieldPath = columnNameKeyword.replace(".name.keyword", "");
    boolBuilder.filter(Query.of(q -> q.exists(e -> e.field(columnFieldPath))));

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
      String escapedPattern = escapeWildcardPattern(request.getColumnNamePattern());
      boolBuilder.filter(
          Query.of(
              q -> q.wildcard(w -> w.field(columnNameKeyword).value("*" + escapedPattern + "*"))));
    }

    if (request.getDataTypes() != null && !request.getDataTypes().isEmpty()) {
      String dataTypeField = columnNameKeyword.replace(".name.keyword", ".dataType.keyword");
      List<FieldValue> dataTypeValues =
          request.getDataTypes().stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(
              q -> q.terms(t -> t.field(dataTypeField).terms(tv -> tv.value(dataTypeValues)))));
    }

    if (!nullOrEmpty(request.getMetadataStatus())) {
      Query metadataStatusQuery =
          buildMetadataStatusFilter(request.getMetadataStatus(), columnFieldPath);
      if (metadataStatusQuery != null) {
        boolBuilder.filter(metadataStatusQuery);
      }
    }

    return Query.of(q -> q.bool(boolBuilder.build()));
  }

  private Query buildMetadataStatusFilter(String status, String columnFieldPath) {
    String descField = columnFieldPath + ".description";
    String tagsField = columnFieldPath + ".tags";

    Query hasDesc = hasNonEmptyField(descField);
    Query hasTags = existsQuery(tagsField);
    Query noDesc = hasEmptyOrMissingField(descField);
    Query noTags = notExistsQuery(tagsField);

    return switch (status.toUpperCase()) {
      case "MISSING" -> Query.of(q -> q.bool(b -> b.must(noDesc).must(noTags)));
      case "INCOMPLETE" -> Query.of(
          q ->
              q.bool(
                  b ->
                      b.should(Query.of(qs -> qs.bool(bs -> bs.must(hasDesc).must(noTags))))
                          .should(Query.of(qs -> qs.bool(bs -> bs.must(noDesc).must(hasTags))))
                          .minimumShouldMatch("1")));
      case "COMPLETE" -> Query.of(q -> q.bool(b -> b.must(hasDesc).must(hasTags)));
      default -> null;
    };
  }

  private Query existsQuery(String field) {
    return Query.of(q -> q.exists(e -> e.field(field)));
  }

  private Query notExistsQuery(String field) {
    return Query.of(q -> q.bool(b -> b.mustNot(existsQuery(field))));
  }

  private Query hasNonEmptyField(String field) {
    return Query.of(
        q ->
            q.bool(
                b ->
                    b.must(existsQuery(field))
                        .mustNot(Query.of(qn -> qn.term(t -> t.field(field).value(""))))));
  }

  private Query hasEmptyOrMissingField(String field) {
    return Query.of(
        q ->
            q.bool(
                b ->
                    b.should(notExistsQuery(field))
                        .should(Query.of(qs -> qs.term(t -> t.field(field).value(""))))
                        .minimumShouldMatch("1")));
  }

  private SearchResponse<JsonData> executeSearch(
      ColumnAggregationRequest request, Query query, List<String> indexes, String columnNameKeyword)
      throws IOException {
    Map<String, CompositeAggregationSource> sources = new HashMap<>();
    sources.put(
        "column_name",
        CompositeAggregationSource.of(
            cas -> cas.terms(t -> t.field(columnNameKeyword).order(SortOrder.Asc))));

    // Get the column field path for source fields (e.g., "columns" or "dataModel.columns")
    String columnFieldPath = columnNameKeyword.replace(".name.keyword", "");

    // Build source fields list including the correct column field
    List<String> sourceFields = new ArrayList<>(BASE_SOURCE_FIELDS);
    sourceFields.add(columnFieldPath);

    // Limit top hits to reduce memory usage - 10 samples is enough for grouping
    Aggregation topHitsAgg =
        Aggregation.of(
            a -> a.topHits(th -> th.size(10).source(s -> s.filter(f -> f.includes(sourceFields)))));

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
        SearchRequest.of(s -> s.index(indexes).query(query).aggregations(aggs).size(0));

    return client.search(searchRequest, JsonData.class);
  }

  private Map<String, List<ColumnWithContext>> parseAggregationResults(
      SearchResponse<JsonData> response, String columnFieldPath) {
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

          // Get columns data from the correct path (e.g., "columns", "dataModel.columns", "fields")
          JsonNode columnsData = getNestedJsonNode(sourceNode, columnFieldPath);

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

  /** Navigate nested JSON path like "dataModel.columns" or "messageSchema.schemaFields" */
  private JsonNode getNestedJsonNode(JsonNode root, String path) {
    String[] parts = path.split("\\.");
    JsonNode current = root;
    for (String part : parts) {
      if (current == null || current.isNull()) {
        return null;
      }
      current = current.get(part);
    }
    return current;
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

    // Parse children for STRUCT, MAP, or UNION data types
    JsonNode childrenData = columnData.get("children");
    if (childrenData != null && childrenData.isArray() && !childrenData.isEmpty()) {
      List<Column> children = new ArrayList<>();
      for (JsonNode childData : childrenData) {
        Column childColumn = parseColumn(childData, columnFQN);
        children.add(childColumn);
      }
      column.setChildren(children);
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

  private Map<String, Long> getTotalCounts(
      Query query, List<String> indexes, String columnNameKeyword) throws IOException {
    // Use lower precision threshold to reduce memory usage (3000 is usually sufficient for UI
    // display)
    Aggregation cardinalityAgg =
        Aggregation.of(
            a -> a.cardinality(c -> c.field(columnNameKeyword).precisionThreshold(3000)));

    // Use value_count instead of expensive scripted_metric
    // This counts total column field values which approximates total occurrences
    Aggregation valueCountAgg =
        Aggregation.of(a -> a.valueCount(vc -> vc.field(columnNameKeyword)));

    Map<String, Aggregation> aggs = new HashMap<>();
    aggs.put("unique_column_names", cardinalityAgg);
    aggs.put("total_column_occurrences", valueCountAgg);

    SearchRequest countRequest =
        SearchRequest.of(s -> s.index(indexes).query(query).aggregations(aggs).size(0));

    SearchResponse<JsonData> countResponse = client.search(countRequest, JsonData.class);

    long uniqueColumns = 0;
    long totalOccurrences = 0;

    if (countResponse.aggregations() != null) {
      if (countResponse.aggregations().containsKey("unique_column_names")) {
        uniqueColumns =
            countResponse.aggregations().get("unique_column_names").cardinality().value();
      }
      if (countResponse.aggregations().containsKey("total_column_occurrences")) {
        totalOccurrences =
            (long)
                countResponse.aggregations().get("total_column_occurrences").valueCount().value();
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
