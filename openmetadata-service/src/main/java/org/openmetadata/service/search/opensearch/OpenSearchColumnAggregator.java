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

package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
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
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.FieldValue;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch._types.SortOrder;
import os.org.opensearch.client.opensearch._types.aggregations.Aggregation;
import os.org.opensearch.client.opensearch._types.aggregations.CompositeAggregate;
import os.org.opensearch.client.opensearch._types.aggregations.CompositeAggregationSource;
import os.org.opensearch.client.opensearch._types.aggregations.CompositeBucket;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsAggregate;
import os.org.opensearch.client.opensearch._types.aggregations.StringTermsBucket;
import os.org.opensearch.client.opensearch._types.aggregations.TopHitsAggregate;
import os.org.opensearch.client.opensearch._types.query_dsl.BoolQuery;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;
import os.org.opensearch.client.opensearch.core.search.Hit;

@Slf4j
public class OpenSearchColumnAggregator implements ColumnAggregator {
  private final OpenSearchClient client;

  /** Uses aliases defined in indexMapping.json */
  private static final List<String> DATA_ASSET_INDEXES =
      Arrays.asList("table", "dashboardDataModel", "topic", "searchIndex", "container");

  public OpenSearchColumnAggregator(OpenSearchClient client) {
    this.client = client;
  }

  @Override
  public ColumnGridResponse aggregateColumns(ColumnAggregationRequest request) throws IOException {
    LOG.info(
        "aggregateColumns called: tags={}, glossaryTerms={}",
        request.getTags(),
        request.getGlossaryTerms());

    // Tag/glossary filter path: we must read _source to check which specific column has
    // the tag (ES flat object mapping can't tell us). Since we're already reading _source,
    // we extract full column metadata in the same pass — no separate data-fetch query needed.
    boolean hasTagFilter =
        !nullOrEmpty(request.getTags()) || !nullOrEmpty(request.getGlossaryTerms());

    if (hasTagFilter) {
      Map<String, List<ColumnWithContext>> taggedColumns = getColumnsWithTagsFromSource(request);
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
      return aggregateColumnsWithPattern(request);
    }

    // Browse path with no pattern or tag/glossary filter: still applies request scope filters
    // (service/database/schema/domain/entityType/metadataStatus, etc.) and uses composite
    // aggregation for engine-side pagination via after_key.
    Query query = buildFilters(request, null);

    try {
      SearchResponse<JsonData> response = executeSearch(request, query);

      Map<String, List<ColumnWithContext>> columnsByName = parseCompositeAggResults(response);

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
    } catch (OpenSearchException e) {
      if (isIndexNotFoundException(e)) {
        LOG.warn("Search index not found, returning empty results");
        return buildResponse(new ArrayList<>(), null, false, 0, 0);
      }
      throw e;
    }
  }

  /**
   * Pattern-only search path (no tag filter): uses terms aggregation with include regex to filter
   * column names at the aggregation level. Two queries: (1) lightweight names query to get all
   * matching names and total count, (2) targeted data query with top_hits for the current page.
   */
  private ColumnGridResponse aggregateColumnsWithPattern(ColumnAggregationRequest request)
      throws IOException {

    Query query = buildFilters(request, null);
    String regex = ColumnAggregator.toCaseInsensitiveRegex(request.getColumnNamePattern());

    try {
      ColumnAggregator.NamesWithCount phase1 = executeNamesQuery(query, regex);
      Set<String> dedupedNames = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
      dedupedNames.addAll(phase1.names());

      int totalUniqueColumns = dedupedNames.size();
      int totalOccurrences = ColumnAggregator.toIntSaturating(phase1.totalDocCount());
      int offset = ColumnAggregator.decodeSearchOffset(request.getCursor());
      int pageSize = request.getSize();

      List<String> sortedNames = new ArrayList<>(dedupedNames);
      int fromIndex = Math.min(offset, sortedNames.size());
      int toIndex = Math.min(offset + pageSize, sortedNames.size());
      List<String> pageNames = sortedNames.subList(fromIndex, toIndex);

      if (pageNames.isEmpty()) {
        return buildResponse(new ArrayList<>(), null, false, totalUniqueColumns, totalOccurrences);
      }

      Map<String, List<ColumnWithContext>> columnsByName = executePageDataQuery(query, pageNames);

      List<ColumnGridItem> gridItems = ColumnMetadataGrouper.groupColumns(columnsByName);

      boolean hasMore = toIndex < totalUniqueColumns;
      String cursor = hasMore ? ColumnAggregator.encodeSearchOffset(toIndex) : null;

      return buildResponse(gridItems, cursor, hasMore, totalUniqueColumns, totalOccurrences);
    } catch (OpenSearchException e) {
      if (isIndexNotFoundException(e)) {
        LOG.warn("Search index not found, returning empty results");
        return buildResponse(new ArrayList<>(), null, false, 0, 0);
      }
      throw e;
    }
  }

  /**
   * Tag/glossary filter path: the tag-check pass already extracted full column metadata from
   * _source (only tagged columns are in the map). Just paginate over the in-memory result.
   *
   * <p>{@code taggedColumns} is a case-insensitive map: when two entities have columns differing
   * only in case (e.g. "User" / "user"), occurrences are merged under a single key.
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
   *
   * <p>Returns a case-insensitive map so that columns differing only in case (e.g. "User" / "user")
   * group together, matching how the search/browse paths display them.
   */
  private Map<String, List<ColumnWithContext>> getColumnsWithTagsFromSource(
      ColumnAggregationRequest request) throws IOException {
    Map<String, List<ColumnWithContext>> columnsByName =
        new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    Set<String> targetTags = buildTargetTagSet(request);

    Query query = buildTagFilterQuery(request);

    try {
      fetchColumnsWithTagsFromSource(query, targetTags, columnsByName);
    } catch (OpenSearchException e) {
      if (!isIndexNotFoundException(e)) {
        throw e;
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

  /** Resolve index names using SearchRepository to add the proper cluster alias prefix */
  private List<String> resolveIndexNames() {
    return DATA_ASSET_INDEXES.stream()
        .map(name -> Entity.getSearchRepository().getIndexOrAliasName(name))
        .toList();
  }

  private void fetchColumnsWithTagsFromSource(
      Query query, Set<String> targetTags, Map<String, List<ColumnWithContext>> columnsByName)
      throws IOException {
    List<String> resolvedIndexes = resolveIndexNames();

    // Capped at index.max_result_window (default 10k). For tag/glossary filtering this is the
    // max number of *tagged entities* we can scan; columns from later entities are not
    // considered. Tracked separately — would need search_after / scroll to remove this cap.
    SearchRequest searchRequest =
        SearchRequest.of(s -> s.index(resolvedIndexes).query(query).size(10000));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);
    long totalHits = response.hits().total() != null ? response.hits().total().value() : 0;
    if (totalHits > 10000) {
      LOG.warn(
          "Tag/glossary source-fetch matched {} entities; only first 10000 scanned for tagged "
              + "columns (index.max_result_window). Later entities will not be included.",
          totalHits);
    }

    for (os.org.opensearch.client.opensearch.core.search.Hit<JsonData> hit :
        response.hits().hits()) {
      extractMatchingColumnsFromHit(hit, targetTags, columnsByName);
    }
  }

  private void extractMatchingColumnsFromHit(
      os.org.opensearch.client.opensearch.core.search.Hit<JsonData> hit,
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

      JsonNode columnsData = sourceNode.get("columns");

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
  private Query buildTagFilterQuery(ColumnAggregationRequest request) {
    BoolQuery.Builder boolBuilder = new BoolQuery.Builder();

    boolBuilder.filter(Query.of(q -> q.exists(e -> e.field("columns"))));

    addEntityTypeFilter(boolBuilder, request);
    addServiceFilter(boolBuilder, request);
    addServiceTypeFilter(boolBuilder, request);
    addDatabaseFilter(boolBuilder, request);
    addSchemaFilter(boolBuilder, request);
    addDomainFilter(boolBuilder, request);
    addColumnNamePatternFilter(boolBuilder, request);
    addMetadataStatusFilter(boolBuilder, request);

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
          Query.of(
              q -> q.terms(t -> t.field("columns.tags.tagFQN").terms(tv -> tv.value(tagValues)))));
    }

    return Query.of(q -> q.bool(boolBuilder.build()));
  }

  private boolean isIndexNotFoundException(OpenSearchException e) {
    String message = e.getMessage();
    return message != null && message.contains("index_not_found_exception");
  }

  private String escapeWildcardPattern(String input) {
    if (input == null) {
      return null;
    }
    return input.replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?");
  }

  /**
   * Build filters for the main query. When columnNamesFromTagFilter is provided (two-phase query),
   * skip tag/glossaryTerms filters and use column names filter instead.
   */
  private Query buildFilters(
      ColumnAggregationRequest request, List<String> columnNamesFromTagFilter) {
    BoolQuery.Builder boolBuilder = new BoolQuery.Builder();

    boolBuilder.filter(Query.of(q -> q.exists(e -> e.field("columns"))));

    addEntityTypeFilter(boolBuilder, request);
    addServiceFilter(boolBuilder, request);
    addServiceTypeFilter(boolBuilder, request);
    addDatabaseFilter(boolBuilder, request);
    addSchemaFilter(boolBuilder, request);
    addDomainFilter(boolBuilder, request);
    addColumnNamePatternFilter(boolBuilder, request);
    addTagFilters(boolBuilder, request, columnNamesFromTagFilter);
    addMetadataStatusFilter(boolBuilder, request);

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
              q ->
                  q.term(
                      t ->
                          t.field("service.name.keyword")
                              .value(FieldValue.of(request.getServiceName())))));
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
              q ->
                  q.term(
                      t ->
                          t.field("database.name.keyword")
                              .value(FieldValue.of(request.getDatabaseName())))));
    }
  }

  private void addSchemaFilter(BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (!nullOrEmpty(request.getSchemaName())) {
      boolBuilder.filter(
          Query.of(
              q ->
                  q.term(
                      t ->
                          t.field("databaseSchema.name.keyword")
                              .value(FieldValue.of(request.getSchemaName())))));
    }
  }

  private void addDomainFilter(BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (!nullOrEmpty(request.getDomainId())) {
      boolBuilder.filter(
          Query.of(
              q -> q.term(t -> t.field("domains.id").value(FieldValue.of(request.getDomainId())))));
    }
  }

  private void addColumnNamePatternFilter(
      BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (!nullOrEmpty(request.getColumnNamePattern())) {
      String escapedPattern = escapeWildcardPattern(request.getColumnNamePattern());
      boolBuilder.filter(
          Query.of(
              q ->
                  q.wildcard(
                      w ->
                          w.field("columns.name.keyword")
                              .value("*" + escapedPattern + "*")
                              .caseInsensitive(true))));
    }
  }

  private void addTagFilters(
      BoolQuery.Builder boolBuilder,
      ColumnAggregationRequest request,
      List<String> columnNamesFromTagFilter) {
    // Two-phase query: filter by column names instead of tags
    if (columnNamesFromTagFilter != null && !columnNamesFromTagFilter.isEmpty()) {
      List<FieldValue> values = columnNamesFromTagFilter.stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(
              q -> q.terms(t -> t.field("columns.name.keyword").terms(tv -> tv.value(values)))));
      return;
    }

    // Original tag filtering
    if (request.getTags() != null && !request.getTags().isEmpty()) {
      List<FieldValue> values = request.getTags().stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(
              q -> q.terms(t -> t.field("columns.tags.tagFQN").terms(tv -> tv.value(values)))));
    }

    if (request.getGlossaryTerms() != null && !request.getGlossaryTerms().isEmpty()) {
      List<FieldValue> values = request.getGlossaryTerms().stream().map(FieldValue::of).toList();
      boolBuilder.filter(
          Query.of(
              q -> q.terms(t -> t.field("columns.tags.tagFQN").terms(tv -> tv.value(values)))));
    }
  }

  private void addMetadataStatusFilter(
      BoolQuery.Builder boolBuilder, ColumnAggregationRequest request) {
    if (!nullOrEmpty(request.getMetadataStatus())) {
      Query metadataStatusQuery = buildMetadataStatusFilter(request.getMetadataStatus());
      if (metadataStatusQuery != null) {
        boolBuilder.filter(metadataStatusQuery);
      }
    }
  }

  private Query buildMetadataStatusFilter(String status) {
    String descField = "columns.description";
    String tagsField = "columns.tags";

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
                        .mustNot(
                            Query.of(
                                qn -> qn.term(t -> t.field(field).value(FieldValue.of("")))))));
  }

  private Query hasEmptyOrMissingField(String field) {
    return Query.of(
        q ->
            q.bool(
                b ->
                    b.should(notExistsQuery(field))
                        .should(
                            Query.of(qs -> qs.term(t -> t.field(field).value(FieldValue.of("")))))
                        .minimumShouldMatch("1")));
  }

  /** Phase 1: Get all matching column names using terms agg with include regex (no top_hits). */
  private ColumnAggregator.NamesWithCount executeNamesQuery(Query query, String regex)
      throws IOException {
    Aggregation termsAgg =
        Aggregation.of(
            a ->
                a.terms(
                    t ->
                        t.field("columns.name.keyword")
                            .include(inc -> inc.regexp(regex))
                            .size(ColumnAggregator.MAX_PATTERN_SEARCH_NAMES)
                            .order(
                                List.of(Map.of(ColumnAggregator.AGG_KEY_ORDER, SortOrder.Asc)))));

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(resolveIndexNames())
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
        names.add(bucket.key());
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
      Query query, List<String> columnNames) throws IOException {

    Aggregation topHitsAgg =
        Aggregation.of(a -> a.topHits(th -> th.size(ColumnAggregator.SAMPLE_DOCS_PER_COLUMN)));

    Aggregation termsAgg =
        Aggregation.of(
            a ->
                a.terms(
                        t ->
                            t.field("columns.name.keyword")
                                .include(inc -> inc.terms(columnNames))
                                .size(columnNames.size()))
                    .aggregations(ColumnAggregator.AGG_SAMPLE_DOCS, topHitsAgg));

    SearchRequest searchRequest =
        SearchRequest.of(
            s ->
                s.index(resolveIndexNames())
                    .query(query)
                    .aggregations(ColumnAggregator.AGG_PAGE_COLUMNS, termsAgg)
                    .size(0));

    SearchResponse<JsonData> response = client.search(searchRequest, JsonData.class);

    return parseTermsAggResults(response);
  }

  private Map<String, List<ColumnWithContext>> parseTermsAggResults(
      SearchResponse<JsonData> response) {
    Map<String, List<ColumnWithContext>> columnsByName = new HashMap<>();

    if (response.aggregations() == null
        || !response.aggregations().containsKey(ColumnAggregator.AGG_PAGE_COLUMNS)) {
      return columnsByName;
    }

    StringTermsAggregate termsAgg =
        response.aggregations().get(ColumnAggregator.AGG_PAGE_COLUMNS).sterms();

    for (StringTermsBucket bucket : termsAgg.buckets().array()) {
      String columnName = bucket.key();

      if (!bucket.aggregations().containsKey(ColumnAggregator.AGG_SAMPLE_DOCS)) {
        continue;
      }

      TopHitsAggregate topHits =
          bucket.aggregations().get(ColumnAggregator.AGG_SAMPLE_DOCS).topHits();
      parseBucketHits(columnName, topHits, columnsByName);
    }

    return columnsByName;
  }

  private SearchResponse<JsonData> executeSearch(ColumnAggregationRequest request, Query query)
      throws IOException {
    Map<String, CompositeAggregationSource> sources = new HashMap<>();
    sources.put(
        "column_name",
        CompositeAggregationSource.of(
            cas -> cas.terms(t -> t.field("columns.name.keyword").order(SortOrder.Asc))));

    Aggregation topHitsAgg =
        Aggregation.of(a -> a.topHits(th -> th.size(ColumnAggregator.SAMPLE_DOCS_PER_COLUMN)));

    Map<String, Aggregation> subAggs = new HashMap<>();
    subAggs.put(ColumnAggregator.AGG_SAMPLE_DOCS, topHitsAgg);

    Map<String, FieldValue> afterKey =
        request.getCursor() != null ? decodeCursorAsFieldValues(request.getCursor()) : null;

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
        SearchRequest.of(s -> s.index(resolveIndexNames()).query(query).aggregations(aggs).size(0));

    return client.search(searchRequest, JsonData.class);
  }

  private Map<String, List<ColumnWithContext>> parseCompositeAggResults(
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
      FieldValue fieldValue = bucket.key().get("column_name");
      String columnName = fieldValue != null ? fieldValue.stringValue() : null;

      if (!bucket.aggregations().containsKey(ColumnAggregator.AGG_SAMPLE_DOCS)) {
        continue;
      }

      TopHitsAggregate topHits =
          bucket.aggregations().get(ColumnAggregator.AGG_SAMPLE_DOCS).topHits();
      parseBucketHits(columnName, topHits, columnsByName);
    }

    return columnsByName;
  }

  /** Parse top_hits from a single bucket (shared by composite and terms agg parsing). */
  private void parseBucketHits(
      String columnName,
      TopHitsAggregate topHits,
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

        JsonNode columnsData = sourceNode.get("columns");

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
        FieldValue fv = entry.getValue();
        stringMap.put(entry.getKey(), fv != null ? fv.stringValue() : null);
      }
      String json = JsonUtils.pojoToJson(stringMap);
      return Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      LOG.error("Failed to encode cursor", e);
      return null;
    }
  }

  private Map<String, FieldValue> decodeCursorAsFieldValues(String cursor) {
    try {
      String json = new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8);
      Map<String, String> stringMap = JsonUtils.readValue(json, new TypeReference<>() {});
      Map<String, FieldValue> result = new HashMap<>();
      for (Map.Entry<String, String> entry : stringMap.entrySet()) {
        result.put(entry.getKey(), FieldValue.of(entry.getValue()));
      }
      return result;
    } catch (Exception e) {
      LOG.error("Failed to decode cursor", e);
      return null;
    }
  }

  private Map<String, String> decodeCursor(String cursor) {
    try {
      byte[] decoded = Base64.getDecoder().decode(cursor);
      String json = new String(decoded, StandardCharsets.UTF_8);
      return JsonUtils.readValue(json, new TypeReference<>() {});
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
        SearchRequest.of(s -> s.index(resolveIndexNames()).query(query).aggregations(aggs).size(0));

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
