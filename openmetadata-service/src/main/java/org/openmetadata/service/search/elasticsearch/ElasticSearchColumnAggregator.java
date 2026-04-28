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

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.SortOrder;
import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.aggregations.CompositeAggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.CompositeAggregationSource;
import es.co.elastic.clients.elasticsearch._types.aggregations.CompositeBucket;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsAggregate;
import es.co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import es.co.elastic.clients.elasticsearch._types.aggregations.TopHitsAggregate;
import es.co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.elasticsearch.core.SearchResponse;
import es.co.elastic.clients.elasticsearch.core.search.Hit;
import es.co.elastic.clients.json.JsonData;
import es.co.elastic.clients.util.NamedValue;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
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

    // Tag/glossary filter path: we must read _source to check which specific column has
    // the tag (ES flat object mapping can't tell us). Since we're already reading _source,
    // we extract full column metadata in the same pass — no separate data-fetch query needed.
    boolean hasTagFilter =
        !nullOrEmpty(request.getTags()) || !nullOrEmpty(request.getGlossaryTerms());

    if (hasTagFilter) {
      Map<String, List<ColumnWithContext>> taggedColumns =
          getColumnsWithTagsFromSource(request, entityTypes);
      if (taggedColumns.isEmpty()) {
        return buildResponse(new ArrayList<>(), null, false, 0, 0);
      }

      // Pattern + tag combined: filter the already-fetched columns by pattern in Java
      if (!nullOrEmpty(request.getColumnNamePattern())) {
        String pattern = request.getColumnNamePattern().toLowerCase(Locale.ROOT);
        taggedColumns
            .entrySet()
            .removeIf(e -> !e.getKey().toLowerCase(Locale.ROOT).contains(pattern));
      }

      return aggregateColumnsWithKnownNames(request, taggedColumns);
    }

    // Pattern-only path (no tag filter): use terms agg with include regex
    if (!nullOrEmpty(request.getColumnNamePattern())) {
      return aggregateColumnsWithPattern(request, entityTypes);
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

      Query query = buildFilters(request, columnNameKeyword, null);

      try {
        SearchResponse<JsonData> response =
            executeSearch(request, query, indexes, columnNameKeyword);

        Map<String, List<ColumnWithContext>> columnsByName =
            parseCompositeAggResults(response, columnFieldPath);

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

  /**
   * Pattern-only search path (no tag filter): uses terms aggregation with include regex to filter
   * column names at the aggregation level. Two queries per entity-type group: (1) lightweight names
   * query to get all matching names and total count, (2) targeted data query with top_hits for the
   * current page.
   */
  private ColumnGridResponse aggregateColumnsWithPattern(
      ColumnAggregationRequest request, List<String> entityTypes) throws IOException {

    Map<String, List<String>> fieldPathToEntityTypes = groupByFieldPath(entityTypes);
    String regex = ColumnAggregator.toCaseInsensitiveRegex(request.getColumnNamePattern());

    Set<String> allMatchingNames = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    long totalOccurrencesAcrossGroups = 0;

    for (Map.Entry<String, List<String>> entry : fieldPathToEntityTypes.entrySet()) {
      String columnNameKeyword = entry.getKey();
      List<String> indexes = resolveIndexNames(entry.getValue());
      Query query = buildFilters(request, columnNameKeyword, null);

      try {
        NamesWithCount result = executeNamesQuery(query, indexes, columnNameKeyword, regex);
        allMatchingNames.addAll(result.names());
        totalOccurrencesAcrossGroups += result.totalDocCount();
      } catch (ElasticsearchException e) {
        if (!isIndexNotFoundException(e)) {
          throw e;
        }
      }
    }

    int totalUniqueColumns = allMatchingNames.size();
    int totalOccurrences = ColumnAggregator.toIntSaturating(totalOccurrencesAcrossGroups);
    int offset = ColumnAggregator.decodeSearchOffset(request.getCursor());
    int pageSize = request.getSize();

    List<String> sortedNames = new ArrayList<>(allMatchingNames);
    int fromIndex = Math.min(offset, sortedNames.size());
    int toIndex = Math.min(offset + pageSize, sortedNames.size());
    List<String> pageNames = sortedNames.subList(fromIndex, toIndex);

    if (pageNames.isEmpty()) {
      return buildResponse(new ArrayList<>(), null, false, totalUniqueColumns, totalOccurrences);
    }

    Map<String, List<ColumnWithContext>> allColumnsByName = new HashMap<>();

    for (Map.Entry<String, List<String>> entry : fieldPathToEntityTypes.entrySet()) {
      String columnNameKeyword = entry.getKey();
      List<String> indexes = resolveIndexNames(entry.getValue());
      String columnFieldPath = INDEX_CONFIGS.get(entry.getValue().getFirst()).columnFieldPath();
      Query query = buildFilters(request, columnNameKeyword, null);

      try {
        Map<String, List<ColumnWithContext>> columnsByName =
            executePageDataQuery(query, indexes, columnNameKeyword, columnFieldPath, pageNames);

        for (Map.Entry<String, List<ColumnWithContext>> colEntry : columnsByName.entrySet()) {
          allColumnsByName
              .computeIfAbsent(colEntry.getKey(), k -> new ArrayList<>())
              .addAll(colEntry.getValue());
        }
      } catch (ElasticsearchException e) {
        if (!isIndexNotFoundException(e)) {
          throw e;
        }
      }
    }

    List<ColumnGridItem> gridItems = ColumnMetadataGrouper.groupColumns(allColumnsByName);

    boolean hasMore = toIndex < totalUniqueColumns;
    String cursor = hasMore ? ColumnAggregator.encodeSearchOffset(toIndex) : null;

    return buildResponse(gridItems, cursor, hasMore, totalUniqueColumns, totalOccurrences);
  }

  /**
   * Tag/glossary filter path: the tag-check pass already extracted full column metadata from
   * _source (only tagged columns are in the map). Just paginate over the in-memory result.
   */
  private ColumnGridResponse aggregateColumnsWithKnownNames(
      ColumnAggregationRequest request, Map<String, List<ColumnWithContext>> taggedColumns) {

    int totalUniqueColumns = taggedColumns.size();
    int totalOccurrences = taggedColumns.values().stream().mapToInt(List::size).sum();
    int offset = ColumnAggregator.decodeSearchOffset(request.getCursor());
    int pageSize = request.getSize();

    List<String> sortedNames = new ArrayList<>(taggedColumns.keySet());
    int fromIndex = Math.min(offset, sortedNames.size());
    int toIndex = Math.min(offset + pageSize, sortedNames.size());
    List<String> pageNames = sortedNames.subList(fromIndex, toIndex);

    if (pageNames.isEmpty()) {
      return buildResponse(new ArrayList<>(), null, false, totalUniqueColumns, totalOccurrences);
    }

    Map<String, List<ColumnWithContext>> pageColumns = new HashMap<>();
    for (String name : pageNames) {
      List<ColumnWithContext> occurrences = taggedColumns.get(name);
      if (occurrences != null) {
        pageColumns.put(name, occurrences);
      }
    }

    List<ColumnGridItem> gridItems = ColumnMetadataGrouper.groupColumns(pageColumns);

    boolean hasMore = toIndex < totalUniqueColumns;
    String cursor = hasMore ? ColumnAggregator.encodeSearchOffset(toIndex) : null;

    return buildResponse(gridItems, cursor, hasMore, totalUniqueColumns, totalOccurrences);
  }

  /**
   * Fetch columns with matching tags from _source. ES flat object mapping means we can't filter
   * "column X has tag Y" at query level, so we read _source and check in Java. Since we already
   * have the full document, we extract column metadata here — avoiding a separate data-fetch query.
   */
  private Map<String, List<ColumnWithContext>> getColumnsWithTagsFromSource(
      ColumnAggregationRequest request, List<String> entityTypes) throws IOException {
    Map<String, List<ColumnWithContext>> columnsByName =
        new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    Map<String, List<String>> fieldPathToEntityTypes = groupByFieldPath(entityTypes);

    Set<String> targetTags = buildTargetTagSet(request);

    for (Map.Entry<String, List<String>> entry : fieldPathToEntityTypes.entrySet()) {
      String columnNameKeyword = entry.getKey();
      List<String> groupEntityTypes = entry.getValue();
      List<String> indexes = resolveIndexNames(groupEntityTypes);
      String columnFieldPath = INDEX_CONFIGS.get(groupEntityTypes.getFirst()).columnFieldPath();

      Query query = buildTagFilterQuery(request, columnNameKeyword);

      try {
        fetchColumnsWithTagsFromSource(indexes, query, columnFieldPath, targetTags, columnsByName);
      } catch (ElasticsearchException e) {
        if (!isIndexNotFoundException(e)) {
          throw e;
        }
      }
    }

    return columnsByName;
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

  private void fetchColumnsWithTagsFromSource(
      List<String> indexes,
      Query query,
      String columnFieldPath,
      Set<String> targetTags,
      Map<String, List<ColumnWithContext>> columnsByName)
      throws IOException {

    SearchRequest searchRequest = SearchRequest.of(s -> s.index(indexes).query(query).size(10000));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);
    long totalHits = response.hits().total() != null ? response.hits().total().value() : 0;
    if (totalHits > 10000) {
      LOG.warn(
          "Tag/glossary source-fetch matched {} entities; only first 10000 scanned.", totalHits);
    }

    for (Hit<JsonData> hit : response.hits().hits()) {
      extractMatchingColumnsFromHit(hit, columnFieldPath, targetTags, columnsByName);
    }
  }

  private void extractMatchingColumnsFromHit(
      Hit<JsonData> hit,
      String columnFieldPath,
      Set<String> targetTags,
      Map<String, List<ColumnWithContext>> columnsByName) {
    if (hit.source() == null) {
      return;
    }
    try {
      JsonNode sourceNode = hit.source().to(JsonNode.class);
      String entityFQN = getTextField(sourceNode, "fullyQualifiedName");
      if (entityFQN == null) {
        return;
      }

      String entityType = getTextField(sourceNode, "entityType");
      String entityDisplayName = getTextField(sourceNode, "displayName");
      String serviceName = getNestedField(sourceNode, "service", "name");
      String databaseName = getNestedField(sourceNode, "database", "name");
      String schemaName = getNestedField(sourceNode, "databaseSchema", "name");

      JsonNode columnsData = getNestedJsonNode(sourceNode, columnFieldPath);

      if (columnsData != null && columnsData.isArray()) {
        for (JsonNode columnData : columnsData) {
          String colName = getTextField(columnData, "name");
          if (colName != null && columnHasTargetTag(columnData, targetTags)) {
            Column column = parseColumn(columnData, entityFQN);
            columnsByName
                .computeIfAbsent(colName, k -> new ArrayList<>())
                .add(
                    new ColumnWithContext(
                        column,
                        entityType,
                        entityFQN,
                        entityDisplayName,
                        serviceName,
                        databaseName,
                        schemaName));
          }
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to extract columns from hit", e);
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

  /**
   * Build query for tag filtering source fetch. Includes all scope filters (service, database,
   * schema, domain, entityType), column-name pattern, and metadataStatus so the _source fetch is
   * scoped to the same data as the main query. Per-column correlation (which specific column has
   * the tag + matches the pattern) still happens in Java because flat object mapping prevents
   * expressing it at query level.
   */
  private Query buildTagFilterQuery(ColumnAggregationRequest request, String columnNameKeyword) {
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
    addMetadataStatusFilter(boolBuilder, request, columnFieldPath);

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
      addNameOrDisplayNameFilter(boolBuilder, "service", request.getServiceName());
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
      addNameOrDisplayNameFilter(boolBuilder, "database", request.getDatabaseName());
    }
  }

  private void addSchemaFilter(BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (!nullOrEmpty(request.getSchemaName())) {
      addNameOrDisplayNameFilter(boolBuilder, "databaseSchema", request.getSchemaName());
    }
  }

  /**
   * Match a value against either {fieldPrefix}.name.keyword or {fieldPrefix}.displayName.keyword.
   * The UI filter dropdowns aggregate on displayName.keyword while API consumers (and the legacy
   * dropdown) may pass the underlying name — this matches either, so both work.
   */
  private void addNameOrDisplayNameFilter(
      BoolQuery.Builder boolBuilder, String fieldPrefix, String value) {
    boolBuilder.filter(
        Query.of(
            q ->
                q.bool(
                    b ->
                        b.minimumShouldMatch("1")
                            .should(
                                Query.of(
                                    sq ->
                                        sq.term(
                                            t ->
                                                t.field(fieldPrefix + ".name.keyword")
                                                    .value(value))))
                            .should(
                                Query.of(
                                    sq ->
                                        sq.term(
                                            t ->
                                                t.field(fieldPrefix + ".displayName.keyword")
                                                    .value(value)))))));
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

  // `wildcard(field, "?*")` matches any doc whose indexed terms include at least one token of
  // at least one character — the analyzer-friendly equivalent of "field has non-empty value".
  // We can't use `term(field, "")` against analyzed text fields like `columns.description`: the
  // field's analyzer produces no tokens for the empty string and ES 7.17 rejects the term query
  // with `search_phase_execution_exception ... all shards failed`. Caught by
  // ColumnGridResourceIT#test_getColumnGrid_withMetadataStatusIncomplete.
  private Query hasNonEmptyField(String field) {
    return Query.of(q -> q.wildcard(w -> w.field(field).value("?*")));
  }

  private Query hasEmptyOrMissingField(String field) {
    return Query.of(q -> q.bool(b -> b.mustNot(hasNonEmptyField(field))));
  }

  /** Phase 1: Get all matching column names using terms agg with include regex (no top_hits). */
  private ColumnAggregator.NamesWithCount executeNamesQuery(
      Query query, List<String> indexes, String columnNameKeyword, String regex)
      throws IOException {

    Aggregation termsAgg =
        Aggregation.of(
            a ->
                a.terms(
                    t ->
                        t.field(columnNameKeyword)
                            .include(inc -> inc.regexp(regex))
                            .size(ColumnAggregator.MAX_PATTERN_SEARCH_NAMES)
                            .order(
                                List.of(
                                    NamedValue.of(
                                        ColumnAggregator.AGG_KEY_ORDER, SortOrder.Asc)))));

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(indexes)
                    .query(query)
                    .aggregations(ColumnAggregator.AGG_MATCHING_COLUMNS, termsAgg)
                    .size(0));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);

    List<String> names = new ArrayList<>();
    long totalDocCount = 0;
    if (response.aggregations() != null
        && response.aggregations().containsKey(ColumnAggregator.AGG_MATCHING_COLUMNS)) {
      StringTermsAggregate termsResult =
          response.aggregations().get(ColumnAggregator.AGG_MATCHING_COLUMNS).sterms();
      for (StringTermsBucket bucket : termsResult.buckets().array()) {
        names.add(bucket.key().stringValue());
        totalDocCount += bucket.docCount();
      }
      if (names.size() == ColumnAggregator.MAX_PATTERN_SEARCH_NAMES) {
        LOG.warn(
            "Column name pattern matched at least {} distinct names; results truncated",
            ColumnAggregator.MAX_PATTERN_SEARCH_NAMES);
      }
    }
    return new ColumnAggregator.NamesWithCount(names, totalDocCount);
  }

  /** Phase 2: Get data for specific column names using terms agg with exact include + top_hits. */
  private Map<String, List<ColumnWithContext>> executePageDataQuery(
      Query query,
      List<String> indexes,
      String columnNameKeyword,
      String columnFieldPath,
      List<String> columnNames)
      throws IOException {

    Aggregation topHitsAgg =
        Aggregation.of(a -> a.topHits(th -> th.size(ColumnAggregator.SAMPLE_DOCS_PER_COLUMN)));

    Aggregation termsAgg =
        Aggregation.of(
            a ->
                a.terms(
                        t ->
                            t.field(columnNameKeyword)
                                .include(inc -> inc.terms(columnNames))
                                .size(columnNames.size()))
                    .aggregations(ColumnAggregator.AGG_SAMPLE_DOCS, topHitsAgg));

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(indexes)
                    .query(query)
                    .aggregations(ColumnAggregator.AGG_PAGE_COLUMNS, termsAgg)
                    .size(0));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);

    return parseTermsAggResults(response, columnFieldPath);
  }

  private Map<String, List<ColumnWithContext>> parseTermsAggResults(
      SearchResponse<JsonData> response, String columnFieldPath) {
    Map<String, List<ColumnWithContext>> columnsByName = new HashMap<>();

    if (response.aggregations() == null
        || !response.aggregations().containsKey(ColumnAggregator.AGG_PAGE_COLUMNS)) {
      return columnsByName;
    }

    StringTermsAggregate termsAgg =
        response.aggregations().get(ColumnAggregator.AGG_PAGE_COLUMNS).sterms();

    for (StringTermsBucket bucket : termsAgg.buckets().array()) {
      String columnName = bucket.key().stringValue();

      if (!bucket.aggregations().containsKey(ColumnAggregator.AGG_SAMPLE_DOCS)) {
        continue;
      }

      TopHitsAggregate topHits =
          bucket.aggregations().get(ColumnAggregator.AGG_SAMPLE_DOCS).topHits();
      parseBucketHits(columnName, topHits, columnFieldPath, columnsByName);
    }

    return columnsByName;
  }

  private SearchResponse<JsonData> executeSearch(
      ColumnAggregationRequest request, Query query, List<String> indexes, String columnNameKeyword)
      throws IOException {
    List<NamedValue<CompositeAggregationSource>> sources = new ArrayList<>();
    sources.add(
        NamedValue.of(
            "column_name",
            CompositeAggregationSource.of(
                cas -> cas.terms(t -> t.field(columnNameKeyword).order(SortOrder.Asc)))));

    // Use full _source to avoid top_hits source-filter edge cases where combining root and nested
    // include paths can produce empty buckets.
    Aggregation topHitsAgg =
        Aggregation.of(a -> a.topHits(th -> th.size(ColumnAggregator.SAMPLE_DOCS_PER_COLUMN)));

    Map<String, Aggregation> subAggs = new HashMap<>();
    subAggs.put(ColumnAggregator.AGG_SAMPLE_DOCS, topHitsAgg);

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

  private Map<String, List<ColumnWithContext>> parseCompositeAggResults(
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
      parseBucketHits(columnName, topHits, columnFieldPath, columnsByName);
    }

    return columnsByName;
  }

  /** Parse top_hits from a single bucket (shared by composite and terms agg parsing). */
  private void parseBucketHits(
      String columnName,
      TopHitsAggregate topHits,
      String columnFieldPath,
      Map<String, List<ColumnWithContext>> columnsByName) {

    if (topHits == null || topHits.hits() == null || topHits.hits().hits().isEmpty()) {
      return;
    }

    List<ColumnWithContext> occurrences = new ArrayList<>();
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

        JsonNode columnsData = getNestedJsonNode(sourceNode, columnFieldPath);

        if (columnsData != null && columnsData.isArray()) {
          for (JsonNode columnData : columnsData) {
            String colName = getTextField(columnData, "name");
            if (columnName.equalsIgnoreCase(colName)) {
              if (originalCaseColumnName == null) {
                originalCaseColumnName = colName;
              }
              Column column = parseColumn(columnData, entityFQN);

              occurrences.add(
                  new ColumnWithContext(
                      column,
                      entityType,
                      entityFQN,
                      entityDisplayName,
                      serviceName,
                      databaseName,
                      schemaName));
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

  private Map<String, FieldValue> decodeCursor(String cursor) {
    try {
      byte[] decoded = Base64.getDecoder().decode(cursor);
      String json = new String(decoded, StandardCharsets.UTF_8);
      Map<String, String> stringMap = JsonUtils.readValue(json, new TypeReference<>() {});
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
