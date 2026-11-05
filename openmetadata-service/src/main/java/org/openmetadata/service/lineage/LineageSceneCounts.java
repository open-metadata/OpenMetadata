/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.lineage.LineageSceneMapper.SERVICE_ENTITY_TYPES;
import static org.openmetadata.service.lineage.LineageSceneMapper.stringValue;
import static org.openmetadata.service.lineage.LineageSceneQuery.parentFieldQuery;
import static org.openmetadata.service.lineage.LineageSceneQuery.rootAssetQuery;
import static org.openmetadata.service.lineage.LineageSceneSearch.DATABASE_FQN_KEYWORD_FIELD;
import static org.openmetadata.service.lineage.LineageSceneSearch.DATABASE_SCHEMA_FQN_KEYWORD_FIELD;
import static org.openmetadata.service.lineage.LineageSceneSearch.SERVICE_FQN_KEYWORD_FIELD;
import static org.openmetadata.service.lineage.LineageSceneSearch.logDatabaseReindexRequired;
import static org.openmetadata.service.lineage.LineageSceneSearch.normalizedKey;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.Datum;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.lineage.LineageSceneMapper.Ref;
import org.openmetadata.service.lineage.LineageSceneMapper.SceneAsset;
import org.openmetadata.service.lineage.LineageSceneSearch.SearchRootAssetsResult;
import org.openmetadata.service.search.SearchAggregation;
import org.openmetadata.service.search.SearchAggregationNode;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
final class LineageSceneCounts {
  private final SearchRepository repository;
  private final LineageSceneRequest request;
  private final LineageSceneSearch search;

  LineageSceneCounts(
      SearchRepository repository, LineageSceneRequest request, LineageSceneSearch search) {
    this.repository = repository;
    this.request = request;
    this.search = search;
  }

  private static final int ROOT_AGGREGATION_BUCKET_SIZE = 10000;

  private static final int ROOT_TYPE_AGGREGATION_BUCKET_SIZE = 30;

  private static final int CONTAINER_TOTAL_LOOKUP_LIMIT = 100;

  RootAssetCounts fetchRootAssetCountsByLens(String rootFieldName) throws IOException {
    SearchAggregationNode roots =
        SearchAggregation.terms("roots", rootFieldName, ROOT_AGGREGATION_BUCKET_SIZE);
    roots.addChild(
        SearchAggregation.terms("types", "entityType", ROOT_TYPE_AGGREGATION_BUCKET_SIZE));
    DataQualityReport response =
        repository.genericAggregation(
            rootAssetQuery(request),
            "dataAsset",
            SearchAggregation.fromTree(roots),
            request.subjectContext());
    return rootAssetCounts(response, rootFieldName);
  }

  static RootAssetCounts rootAssetCounts(DataQualityReport report, String rootFieldName) {
    Map<String, Map<String, Integer>> counts = new LinkedHashMap<>();
    if (report != null && !nullOrEmpty(report.getData())) {
      for (Datum datum : report.getData()) {
        addRootAssetCount(counts, datum, rootFieldName);
      }
    }
    return new RootAssetCounts(counts, isRootAssetCountTruncated(counts));
  }

  private static void addRootAssetCount(
      Map<String, Map<String, Integer>> counts, Datum datum, String rootFieldName) {
    Map<String, String> values = datum == null ? null : datum.getAdditionalProperties();
    String rootFqn = values == null ? null : values.get(rootFieldName);
    String entityType = values == null ? null : values.get("entityType");
    int count = values == null ? 0 : parseAggregationCount(values.get("document_count"));
    if (!nullOrEmpty(rootFqn) && !nullOrEmpty(entityType) && count > 0) {
      counts
          .computeIfAbsent(normalizedKey(rootFqn), ignored -> new LinkedHashMap<>())
          .put(normalizedKey(entityType), count);
    }
  }

  private static boolean isRootAssetCountTruncated(Map<String, Map<String, Integer>> counts) {
    return counts.size() >= ROOT_AGGREGATION_BUCKET_SIZE
        || counts.values().stream()
            .anyMatch(typeCounts -> typeCounts.size() >= ROOT_TYPE_AGGREGATION_BUCKET_SIZE);
  }

  void enrichFocusedContainerTotals(SearchLineageResult lineage) throws IOException {
    if (lineage == null
        || lineage.getNodes() == null
        || !request.hasFocus()
        || request.requiresEntityAuthorization()) {
      return;
    }
    if (SERVICE_ENTITY_TYPES.contains(request.entityType())) {
      enrichServiceDatabaseTotals(lineage);
    } else if (Entity.DATABASE.equals(request.entityType())) {
      enrichDatabaseSchemaTotals(lineage);
    }
  }

  private void enrichServiceDatabaseTotals(SearchLineageResult lineage) throws IOException {
    SearchRootAssetsResult databases =
        search.lookupContainers(
            SERVICE_FQN_KEYWORD_FIELD, request.focusFqn(), Entity.DATABASE, containerLookupLimit());
    List<SceneAsset> databaseAssets = toCountableContainerAssets(databases.assets());
    Map<String, Integer> tableCounts =
        fetchContainerAssetCounts(
            SERVICE_FQN_KEYWORD_FIELD,
            request.focusFqn(),
            DATABASE_FQN_KEYWORD_FIELD,
            Entity.TABLE,
            containerLookupLimit());
    for (SceneAsset database : databaseAssets) {
      int tableCount = tableCounts.getOrDefault(normalizedKey(database.self().fqn()), 0);
      if (tableCount > 0) {
        addSyntheticCountEntity(
            lineage,
            database.self(),
            Entity.TABLE,
            tableCount,
            database.service(),
            database.self(),
            null,
            null,
            null);
      }
    }
  }

  private void enrichDatabaseSchemaTotals(SearchLineageResult lineage) throws IOException {
    SearchRootAssetsResult schemas =
        search.lookupContainers(
            DATABASE_FQN_KEYWORD_FIELD,
            request.focusFqn(),
            Entity.DATABASE_SCHEMA,
            containerLookupLimit());
    List<SceneAsset> schemaAssets = toCountableContainerAssets(schemas.assets());
    Map<String, Integer> tableCounts =
        fetchContainerAssetCounts(
            DATABASE_FQN_KEYWORD_FIELD,
            request.focusFqn(),
            DATABASE_SCHEMA_FQN_KEYWORD_FIELD,
            Entity.TABLE,
            containerLookupLimit());
    for (SceneAsset schema : schemaAssets) {
      int tableCount = tableCounts.getOrDefault(normalizedKey(schema.self().fqn()), 0);
      if (tableCount > 0) {
        addSyntheticCountEntity(
            lineage,
            schema.self(),
            Entity.TABLE,
            tableCount,
            schema.service(),
            schema.database(),
            schema.self(),
            null,
            null);
      }
    }
  }

  private static List<SceneAsset> toCountableContainerAssets(List<Map<String, Object>> entities) {
    return entities.stream()
        .map(LineageSceneMapper::toAsset)
        .filter(asset -> asset.self() != null && !nullOrEmpty(asset.self().fqn()))
        .toList();
  }

  private int containerLookupLimit() {
    return Math.max(1, Math.min(request.size() + 1, CONTAINER_TOTAL_LOOKUP_LIMIT));
  }

  private Map<String, Integer> fetchContainerAssetCounts(
      String parentFieldName, String parentFqn, String bucketFieldName, String entityType, int size)
      throws IOException {
    if (nullOrEmpty(parentFieldName) || nullOrEmpty(parentFqn) || nullOrEmpty(bucketFieldName)) {
      return Map.of();
    }
    if (DATABASE_FQN_KEYWORD_FIELD.equals(bucketFieldName)
        && !search.isDatabaseKeywordFieldMapped()) {
      logDatabaseReindexRequired();
      return Map.of();
    }
    SearchAggregationNode containers = SearchAggregation.terms("containers", bucketFieldName, size);
    DataQualityReport response =
        repository.genericAggregation(
            parentFieldQuery(parentFieldName, parentFqn, request),
            entityType,
            SearchAggregation.fromTree(containers),
            request.subjectContext());
    return aggregationCounts(response, bucketFieldName);
  }

  static Map<String, Integer> aggregationCounts(DataQualityReport report, String bucketFieldName) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    if (report != null && !nullOrEmpty(report.getData())) {
      for (Datum datum : report.getData()) {
        Map<String, String> values = datum == null ? Map.of() : datum.getAdditionalProperties();
        String bucket = values.get(bucketFieldName);
        int count = parseAggregationCount(values.get("document_count"));
        if (!nullOrEmpty(bucket) && count > 0) {
          counts.put(normalizedKey(bucket), count);
        }
      }
    }
    return counts;
  }

  private static int parseAggregationCount(String value) {
    int count = 0;
    if (!nullOrEmpty(value)) {
      try {
        count = Math.max(0, Integer.parseInt(value));
      } catch (NumberFormatException exception) {
        LOG.warn("Ignoring invalid lineage aggregation count '{}'.", value);
      }
    }
    return count;
  }

  private static void addSyntheticCountEntity(
      SearchLineageResult lineage,
      Ref container,
      String entityType,
      int count,
      Ref service,
      Ref database,
      Ref schema,
      Ref domain,
      Ref dataProduct) {
    lineage
        .getNodes()
        .putIfAbsent(
            syntheticCountFqn(container, entityType),
            new NodeInformation()
                .withEntity(
                    syntheticCountEntity(
                        container,
                        entityType,
                        count,
                        service,
                        database,
                        schema,
                        domain,
                        dataProduct)));
  }

  static String syntheticCountFqn(Ref root, String entityType) {
    return "__lineage_scene_count__." + root.fqn() + "." + entityType;
  }

  static Map<String, Object> syntheticCountEntity(
      Ref root, LineageLens lens, String entityType, int count) {
    Map<String, Object> entity = new LinkedHashMap<>();
    entity.put("id", syntheticCountFqn(root, entityType));
    entity.put("name", entityType);
    entity.put("fullyQualifiedName", syntheticCountFqn(root, entityType));
    entity.put("entityType", entityType);
    entity.put("serviceType", root.serviceType());
    entity.put("lineageSceneCount", count);
    entity.put("lineageSceneSyntheticCount", true);
    switch (lens) {
      case SERVICE -> entity.put("service", refMap(root));
      case DOMAIN -> entity.put("domains", List.of(refMap(root)));
      case DATA_PRODUCT -> entity.put("dataProducts", List.of(refMap(root)));
    }
    return entity;
  }

  static Map<String, Object> syntheticCountEntity(
      Ref container,
      String entityType,
      int count,
      Ref service,
      Ref database,
      Ref schema,
      Ref domain,
      Ref dataProduct) {
    Map<String, Object> entity = new LinkedHashMap<>();
    entity.put("id", syntheticCountFqn(container, entityType));
    entity.put("name", entityType);
    entity.put("fullyQualifiedName", syntheticCountFqn(container, entityType));
    entity.put("entityType", entityType);
    entity.put("serviceType", service == null ? container.serviceType() : service.serviceType());
    entity.put("lineageSceneCount", count);
    entity.put("lineageSceneSyntheticCount", true);
    if (service != null) {
      entity.put("service", refMap(service));
    }
    if (database != null) {
      entity.put("database", refMap(database));
    }
    if (schema != null) {
      entity.put("databaseSchema", refMap(schema));
    }
    if (domain != null) {
      entity.put("domains", List.of(refMap(domain)));
    }
    if (dataProduct != null) {
      entity.put("dataProducts", List.of(refMap(dataProduct)));
    }
    return entity;
  }

  private static Map<String, Object> refMap(Ref ref) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("id", ref.id());
    map.put("type", ref.entityType());
    map.put("name", ref.label());
    map.put("fullyQualifiedName", ref.fqn());
    if (!nullOrEmpty(stringValue(ref.sourceEntity(), "displayName"))) {
      map.put("displayName", stringValue(ref.sourceEntity(), "displayName"));
    }
    return map;
  }

  record RootAssetCounts(Map<String, Map<String, Integer>> counts, boolean truncated) {}
}
