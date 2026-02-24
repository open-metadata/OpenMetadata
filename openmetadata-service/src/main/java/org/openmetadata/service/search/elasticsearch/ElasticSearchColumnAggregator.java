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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ColumnAggregator;
import org.openmetadata.service.search.ColumnMetadataGrouper;
import org.openmetadata.service.search.ColumnMetadataGrouper.ColumnWithContext;

@Slf4j
public class ElasticSearchColumnAggregator implements ColumnAggregator {
  private final ElasticsearchClient client;

  /** Index configuration with field mappings for each entity type. Uses aliases defined in indexMapping.json */
  private static final Map<String, IndexConfig> INDEX_CONFIGS =
      Map.of(
          "table",
          new IndexConfig("table", "columns", "columns.name.keyword"),
          "dashboardDataModel",
          new IndexConfig("dashboardDataModel", "columns", "columns.name.keyword"),
          "topic",
          new IndexConfig(
              "topic", "messageSchema.schemaFields", "messageSchema.schemaFields.name.keyword"),
          "searchIndex",
          new IndexConfig("searchIndex", "fields", "fields.name.keyword"),
          "container",
          new IndexConfig("container", "dataModel.columns", "dataModel.columns.name.keyword"));

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
    LOG.info(
        "ES aggregateColumns called: tags={}, glossaryTerms={}",
        request.getTags(),
        request.getGlossaryTerms());

    List<String> entityTypes = getEntityTypesForRequest(request);

    // Two-phase query for tags/glossaryTerms filtering:
    // Phase 1: Find entityFQN#columnName pairs that have the tag
    // Phase 2: Filter to only return those specific occurrences
    boolean hasTagFilter =
        !nullOrEmpty(request.getTags()) || !nullOrEmpty(request.getGlossaryTerms());
    Set<String> entityColumnPairsWithTags = null;
    Set<String> columnNamesWithTags = null;

    if (hasTagFilter) {
      entityColumnPairsWithTags = getEntityColumnPairsWithTags(request, entityTypes);
      if (entityColumnPairsWithTags.isEmpty()) {
        return buildResponse(new ArrayList<>(), null, false, 0, 0);
      }
      // Also keep just the column names for the Phase 2 query filter
      columnNamesWithTags =
          entityColumnPairsWithTags.stream()
              .map(pair -> pair.substring(pair.indexOf('#') + 1))
              .collect(java.util.stream.Collectors.toSet());
    }

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

      List<String> indexes = resolveIndexNames(groupEntityTypes);

      String columnFieldPath = INDEX_CONFIGS.get(groupEntityTypes.getFirst()).columnFieldPath();

      // Phase 2: Build query WITHOUT tag filter but WITH column names filter
      List<String> columnNamesList =
          columnNamesWithTags != null ? new ArrayList<>(columnNamesWithTags) : null;
      Query query = buildFilters(request, columnNameKeyword, columnNamesList);

      try {
        SearchResponse<JsonData> response =
            executeSearch(request, query, indexes, columnNameKeyword);

        Map<String, List<ColumnWithContext>> columnsByName =
            parseAggregationResults(response, columnFieldPath);

        // Post-filter columns by name pattern since ES aggregation returns all columns from matched
        // documents
        String columnNamePattern = request.getColumnNamePattern();
        if (!nullOrEmpty(columnNamePattern)) {
          columnsByName
              .entrySet()
              .removeIf(e -> !matchesColumnNamePattern(e.getKey(), columnNamePattern));
        }

        // Post-filter for tag/glossary terms filtering: Only keep occurrences that were
        // identified in Phase 1 as having the tag (not just same column name)
        if (entityColumnPairsWithTags != null && !entityColumnPairsWithTags.isEmpty()) {
          final Set<String> allowedPairs = entityColumnPairsWithTags;
          for (List<ColumnWithContext> occurrences : columnsByName.values()) {
            occurrences.removeIf(
                ctx -> {
                  String key = ctx.entityFQN + "#" + ctx.column.getName();
                  return !allowedPairs.contains(key);
                });
          }
          // Remove column entries that have no occurrences left
          columnsByName.entrySet().removeIf(e -> e.getValue().isEmpty());
        }

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

        // Get totals only on first page and only when no column name pattern
        // (ES aggregation counts all columns from matched docs, not just filtered ones)
        if (request.getCursor() == null && nullOrEmpty(request.getColumnNamePattern())) {
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

    // Calculate totals from actual filtered data when:
    // - On subsequent pages (cursor is set)
    // - When column name pattern is specified (ES aggregation includes non-matching columns)
    if (request.getCursor() != null || !nullOrEmpty(request.getColumnNamePattern())) {
      totalUniqueColumns = allColumnsByName.size();
      totalOccurrences = gridItems.stream().mapToInt(ColumnGridItem::getTotalOccurrences).sum();
    }

    return buildResponse(
        gridItems, lastCursor, hasMore, (int) totalUniqueColumns, (int) totalOccurrences);
  }

  /**
   * Phase 1: Get entityFQN#columnName pairs that have the specified tags. Since ES flattens
   * arrays, we must fetch column data and filter in Java to find columns that actually have the
   * tag.
   */
  private Set<String> getEntityColumnPairsWithTags(
      ColumnAggregationRequest request, List<String> entityTypes) throws IOException {
    Set<String> entityColumnPairs = new HashSet<>();
    Map<String, List<String>> fieldPathToEntityTypes = groupByFieldPath(entityTypes);

    Set<String> targetTags = buildTargetTagSet(request);

    for (Map.Entry<String, List<String>> entry : fieldPathToEntityTypes.entrySet()) {
      String columnNameKeyword = entry.getKey();
      List<String> groupEntityTypes = entry.getValue();
      List<String> indexes = resolveIndexNames(groupEntityTypes);
      String columnFieldPath = INDEX_CONFIGS.get(groupEntityTypes.getFirst()).columnFieldPath();

      Query query = buildTagFilterQuery(request, columnNameKeyword);

      try {
        Set<String> matchingPairs =
            fetchEntityColumnPairsWithTags(indexes, query, columnFieldPath, targetTags);
        entityColumnPairs.addAll(matchingPairs);
      } catch (ElasticsearchException e) {
        if (!isIndexNotFoundException(e)) {
          throw e;
        }
      }
    }

    return entityColumnPairs;
  }

  private Set<String> buildTargetTagSet(ColumnAggregationRequest request) {
    Set<String> targetTags = new HashSet<>();
    if (!nullOrEmpty(request.getTags())) {
      targetTags.addAll(request.getTags());
    }
    if (!nullOrEmpty(request.getGlossaryTerms())) {
      targetTags.addAll(request.getGlossaryTerms());
    }
    return targetTags;
  }

  private Set<String> fetchEntityColumnPairsWithTags(
      List<String> indexes, Query query, String columnFieldPath, Set<String> targetTags)
      throws IOException {
    Set<String> entityColumnPairs = new HashSet<>();

    SearchRequest searchRequest = SearchRequest.of(s -> s.index(indexes).query(query).size(10000));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);

    for (Hit<JsonData> hit : response.hits().hits()) {
      extractMatchingEntityColumnPairs(hit, columnFieldPath, targetTags, entityColumnPairs);
    }

    return entityColumnPairs;
  }

  private void extractMatchingEntityColumnPairs(
      Hit<JsonData> hit,
      String columnFieldPath,
      Set<String> targetTags,
      Set<String> entityColumnPairs) {
    if (hit.source() == null) {
      return;
    }
    try {
      JsonNode sourceNode = hit.source().to(JsonNode.class);
      String entityFQN = getTextField(sourceNode, "fullyQualifiedName");
      if (entityFQN == null) {
        return;
      }

      JsonNode columnsData = getNestedJsonNode(sourceNode, columnFieldPath);

      if (columnsData != null && columnsData.isArray()) {
        for (JsonNode columnData : columnsData) {
          String colName = getTextField(columnData, "name");
          boolean hasTag = columnHasTargetTag(columnData, targetTags);
          if (hasTag && colName != null) {
            entityColumnPairs.add(entityFQN + "#" + colName);
          }
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to extract entity column pairs from hit", e);
    }
  }

  private boolean columnHasTargetTag(JsonNode columnData, Set<String> targetTags) {
    JsonNode tagsData = columnData.get("tags");
    if (tagsData == null || !tagsData.isArray()) {
      return false;
    }
    for (JsonNode tagData : tagsData) {
      String tagFQN = getTextField(tagData, "tagFQN");
      if (tagFQN != null && containsIgnoreCase(targetTags, tagFQN)) {
        return true;
      }
    }
    return false;
  }

  private boolean containsIgnoreCase(Set<String> set, String value) {
    for (String item : set) {
      if (item.equalsIgnoreCase(value)) {
        return true;
      }
    }
    return false;
  }

  /** Build query specifically for tag filtering (Phase 1) */
  private Query buildTagFilterQuery(ColumnAggregationRequest request, String columnNameKeyword) {
    BoolQuery.Builder boolBuilder = new BoolQuery.Builder();

    String columnFieldPath = columnNameKeyword.replace(".name.keyword", "");
    boolBuilder.filter(Query.of(q -> q.exists(e -> e.field(columnFieldPath))));

    String tagFQNField = columnNameKeyword.replace(".name.keyword", ".tags.tagFQN");
    List<String> allTags = new ArrayList<>();

    if (!nullOrEmpty(request.getTags())) {
      allTags.addAll(request.getTags());
    }
    if (!nullOrEmpty(request.getGlossaryTerms())) {
      allTags.addAll(request.getGlossaryTerms());
    }

    if (!allTags.isEmpty()) {
      List<FieldValue> tagValues = allTags.stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(q -> q.terms(t -> t.field(tagFQNField).terms(tv -> tv.value(tagValues)))));
    }

    return Query.of(q -> q.bool(boolBuilder.build()));
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

  private boolean matchesColumnNamePattern(String columnName, String pattern) {
    if (nullOrEmpty(pattern)) {
      return true;
    }
    String lowerColumnName = columnName.toLowerCase();
    String lowerPattern = pattern.toLowerCase();
    return lowerColumnName.contains(lowerPattern);
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

  /** Resolve index names using SearchRepository to add the proper cluster alias prefix */
  private List<String> resolveIndexNames(List<String> entityTypes) {
    return entityTypes.stream()
        .map(et -> INDEX_CONFIGS.get(et).indexName())
        .map(name -> Entity.getSearchRepository().getIndexOrAliasName(name))
        .toList();
  }

  /**
   * Build filters for the main query. When columnNamesFromTagFilter is provided (two-phase query),
   * skip tag/glossaryTerms filters and use column names filter instead.
   */
  private Query buildFilters(
      ColumnAggregationRequest request,
      String columnNameKeyword,
      List<String> columnNamesFromTagFilter) {
    BoolQuery.Builder boolBuilder = new BoolQuery.Builder();

    String columnFieldPath = columnNameKeyword.replace(".name.keyword", "");
    boolBuilder.filter(Query.of(q -> q.exists(e -> e.field(columnFieldPath))));

    addEntityTypeFilter(boolBuilder, request);
    addServiceFilter(boolBuilder, request);
    addServiceTypeFilter(boolBuilder, request);
    addDatabaseFilter(boolBuilder, request);
    addSchemaFilter(boolBuilder, request);
    addDomainFilter(boolBuilder, request);
    addColumnNamePatternFilter(boolBuilder, request, columnNameKeyword);
    addTagFilters(boolBuilder, request, columnNameKeyword, columnNamesFromTagFilter);
    addMetadataStatusFilter(boolBuilder, request, columnFieldPath);

    return Query.of(q -> q.bool(boolBuilder.build()));
  }

  private void addEntityTypeFilter(
      BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (request.getEntityTypes() != null && !request.getEntityTypes().isEmpty()) {
      List<FieldValue> values = request.getEntityTypes().stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(q -> q.terms(t -> t.field("entityType").terms(tv -> tv.value(values)))));
    }
  }

  private void addServiceFilter(BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (!nullOrEmpty(request.getServiceName())) {
      boolBuilder.filter(
          Query.of(
              q -> q.term(t -> t.field("service.name.keyword").value(request.getServiceName()))));
    }
  }

  private void addServiceTypeFilter(
      BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (request.getServiceTypes() != null && !request.getServiceTypes().isEmpty()) {
      List<FieldValue> values = request.getServiceTypes().stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(q -> q.terms(t -> t.field("serviceType").terms(tv -> tv.value(values)))));
    }
  }

  private void addDatabaseFilter(BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (!nullOrEmpty(request.getDatabaseName())) {
      boolBuilder.filter(
          Query.of(
              q -> q.term(t -> t.field("database.name.keyword").value(request.getDatabaseName()))));
    }
  }

  private void addSchemaFilter(BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (!nullOrEmpty(request.getSchemaName())) {
      boolBuilder.filter(
          Query.of(
              q ->
                  q.term(
                      t -> t.field("databaseSchema.name.keyword").value(request.getSchemaName()))));
    }
  }

  private void addDomainFilter(BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (!nullOrEmpty(request.getDomainId())) {
      boolBuilder.filter(
          Query.of(q -> q.term(t -> t.field("domains.id").value(request.getDomainId()))));
    }
  }

  private void addColumnNamePatternFilter(
      BoolQuery.Builder boolBuilder, ColumnAggregationRequest request, String columnNameKeyword) {
    if (!nullOrEmpty(request.getColumnNamePattern())) {
      String escapedPattern = escapeWildcardPattern(request.getColumnNamePattern());
      boolBuilder.filter(
          Query.of(
              q ->
                  q.wildcard(
                      w ->
                          w.field(columnNameKeyword)
                              .value("*" + escapedPattern + "*")
                              .caseInsensitive(true))));
    }
  }

  private void addTagFilters(
      BoolQuery.Builder boolBuilder,
      ColumnAggregationRequest request,
      String columnNameKeyword,
      List<String> columnNamesFromTagFilter) {
    if (columnNamesFromTagFilter != null && !columnNamesFromTagFilter.isEmpty()) {
      List<FieldValue> values = columnNamesFromTagFilter.stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(q -> q.terms(t -> t.field(columnNameKeyword).terms(tv -> tv.value(values)))));
      return;
    }

    String tagFQNField = columnNameKeyword.replace(".name.keyword", ".tags.tagFQN");
    if (request.getTags() != null && !request.getTags().isEmpty()) {
      List<FieldValue> values = request.getTags().stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(q -> q.terms(t -> t.field(tagFQNField).terms(tv -> tv.value(values)))));
    }

    if (request.getGlossaryTerms() != null && !request.getGlossaryTerms().isEmpty()) {
      List<FieldValue> values = request.getGlossaryTerms().stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(q -> q.terms(t -> t.field(tagFQNField).terms(tv -> tv.value(values)))));
    }
  }

  private void addMetadataStatusFilter(
      BoolQuery.Builder boolBuilder, ColumnAggregationRequest request, String columnFieldPath) {
    if (!nullOrEmpty(request.getMetadataStatus())) {
      Query metadataStatusQuery =
          buildMetadataStatusFilter(request.getMetadataStatus(), columnFieldPath);
      if (metadataStatusQuery != null) {
        boolBuilder.filter(metadataStatusQuery);
      }
    }
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
    List<es.co.elastic.clients.util.NamedValue<CompositeAggregationSource>> sources =
        new ArrayList<>();
    sources.add(
        es.co.elastic.clients.util.NamedValue.of(
            "column_name",
            CompositeAggregationSource.of(
                cas -> cas.terms(t -> t.field(columnNameKeyword).order(SortOrder.Asc)))));

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
                          c.sources(sources);
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
      // Track the original case column name from the document source
      String originalCaseColumnName = null;

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
              // ES keyword aggregation lowercases the column names, so use case-insensitive
              // comparison
              if (colName != null && columnName.equalsIgnoreCase(colName)) {
                // Preserve the original case column name from the first match
                if (originalCaseColumnName == null) {
                  originalCaseColumnName = colName;
                }
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

      if (!occurrences.isEmpty() && originalCaseColumnName != null) {
        columnsByName.put(originalCaseColumnName, occurrences);
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
    setBasicColumnFields(column, columnData);

    String columnFQN = resolveColumnFQN(columnData, parentFQN, column.getName());
    column.setFullyQualifiedName(columnFQN);

    parseColumnTags(column, columnData);
    parseColumnChildren(column, columnData, columnFQN);

    return column;
  }

  private void setBasicColumnFields(Column column, JsonNode columnData) {
    column.setName(getTextField(columnData, "name"));
    column.setDisplayName(getTextField(columnData, "displayName"));
    column.setDescription(getTextField(columnData, "description"));
    column.setDataType(parseDataType(getTextField(columnData, "dataType")));
  }

  private String resolveColumnFQN(JsonNode columnData, String parentFQN, String columnName) {
    String columnFQN = getTextField(columnData, "fullyQualifiedName");
    if (columnFQN == null && parentFQN != null) {
      columnFQN = parentFQN + "." + columnName;
    }
    return columnFQN;
  }

  private void parseColumnTags(Column column, JsonNode columnData) {
    JsonNode tagsData = columnData.get("tags");
    if (tagsData == null || !tagsData.isArray()) {
      return;
    }

    List<TagLabel> tags = new ArrayList<>();
    for (JsonNode tagData : tagsData) {
      tags.add(parseTagLabel(tagData));
    }
    column.setTags(tags);
  }

  private TagLabel parseTagLabel(JsonNode tagData) {
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
    return tag;
  }

  private void parseColumnChildren(Column column, JsonNode columnData, String columnFQN) {
    JsonNode childrenData = columnData.get("children");
    if (childrenData == null || !childrenData.isArray() || childrenData.isEmpty()) {
      return;
    }

    List<Column> children = new ArrayList<>();
    for (JsonNode childData : childrenData) {
      children.add(parseColumn(childData, columnFQN));
    }
    column.setChildren(children);
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
        Double valueCountValue =
            countResponse.aggregations().get("total_column_occurrences").valueCount().value();
        totalOccurrences = valueCountValue != null ? valueCountValue.longValue() : 0L;
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
