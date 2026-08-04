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
import static org.openmetadata.service.search.SearchUtils.getRelationshipRef;
import static org.openmetadata.service.search.SearchUtils.getRequiredLineageFields;
import static org.openmetadata.service.search.SearchUtils.getUpstreamLineageListIfExist;
import static org.openmetadata.service.search.SearchUtils.isConnectedVia;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.LineageLevelKind;
import org.openmetadata.schema.api.lineage.LineageScene;
import org.openmetadata.schema.api.lineage.LineageSceneBreadcrumb;
import org.openmetadata.schema.api.lineage.LineageSceneEdge;
import org.openmetadata.schema.api.lineage.LineageSceneField;
import org.openmetadata.schema.api.lineage.LineageSceneNode;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.tests.DataQualityReport;
import org.openmetadata.schema.tests.Datum;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TempLineageTable;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.lineage.LineageDomainFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Slf4j
public class LineageSceneResolver {
  private static final String BASE_SOURCE_FIELDS =
      "id,name,displayName,fullyQualifiedName,entityType,service,serviceType,database,"
          + "databaseSchema,domains,dataProducts,tags,tier,deleted,certification";
  private static final String FIELD_BAND_SOURCE_FIELDS =
      BASE_SOURCE_FIELDS
          + ",columns,messageSchema,charts,mlFeatures,fields,dataModel,requestSchema,responseSchema";
  private static final String FIELD_SEPARATOR = "::field::";
  private static final Set<String> SERVICE_ENTITY_TYPES =
      Set.of(
          Entity.DATABASE_SERVICE,
          Entity.MESSAGING_SERVICE,
          Entity.DASHBOARD_SERVICE,
          Entity.PIPELINE_SERVICE,
          Entity.MLMODEL_SERVICE,
          Entity.STORAGE_SERVICE,
          Entity.METADATA_SERVICE,
          Entity.SEARCH_SERVICE,
          Entity.SECURITY_SERVICE,
          Entity.API_SERVICE,
          Entity.DRIVE_SERVICE,
          Entity.LLM_SERVICE,
          Entity.MCP_SERVICE);
  private static final List<String> ROOT_ASSET_ENTITY_TYPES =
      List.of(
          Entity.TABLE,
          Entity.TOPIC,
          Entity.DASHBOARD,
          Entity.DASHBOARD_DATA_MODEL,
          Entity.PIPELINE,
          Entity.STORED_PROCEDURE,
          Entity.MLMODEL,
          Entity.CONTAINER,
          Entity.SEARCH_INDEX,
          Entity.API_ENDPOINT,
          Entity.METRIC,
          Entity.DIRECTORY,
          Entity.FILE,
          Entity.SPREADSHEET,
          Entity.WORKSHEET);
  private static final String SERVICE_FQN_KEYWORD_FIELD = "service.fullyQualifiedName.keyword";
  private static final String DATABASE_FQN_KEYWORD_FIELD = "database.fullyQualifiedName.keyword";
  private static final String DATABASE_SCHEMA_FQN_KEYWORD_FIELD =
      "databaseSchema.fullyQualifiedName.keyword";
  private static final String DOMAINS_FQN_FIELD = "domains.fullyQualifiedName";
  private static final String DATA_PRODUCTS_FQN_FIELD = "dataProducts.fullyQualifiedName";
  private static final String ENTITY_FQN_FIELD = "fullyQualifiedName";
  private static final String UPSTREAM_LINEAGE_DOC_ID_FIELD = "upstreamLineage.docId";
  private static final String UPSTREAM_LINEAGE_FROM_FQN_FIELD =
      "upstreamLineage.fromEntity.fullyQualifiedName.keyword";
  private static final int ROOT_ASSET_PAGE_SIZE = 25;
  private static final int ROOT_AGGREGATION_BUCKET_SIZE = 10000;
  private static final int ROOT_TYPE_AGGREGATION_BUCKET_SIZE = 30;
  private static final int FOCUSED_CHILD_LINEAGE_LOOKUP_LIMIT = 50;
  private static final int FOCUSED_CHILD_LINEAGE_PARALLELISM = 6;
  private static final int FOCUSED_CHILD_LINEAGE_SIZE = 25;
  private static final int CONTAINER_TOTAL_LOOKUP_LIMIT = 100;
  private static final int FIELD_ENDPOINTS_PER_NODE = 10;
  private static final List<String> ENTITY_REFERENCE_FIELDS =
      List.of(
          "deleted",
          "type",
          "id",
          "description",
          "fullyQualifiedName",
          "name",
          "displayName",
          "inherited",
          "href");
  private static final int FIELD_EDGE_LIMIT = 120;
  private static final int ROOT_LINEAGE_HYDRATION_BATCH_SIZE = 1000;
  private static final long LOOKUP_TIMEOUT_SECONDS = 15;
  private final LineageHydrator hydrator;

  LineageSceneResolver() {
    this(null);
  }

  public LineageSceneResolver(LineageHydrator hydrator) {
    this.hydrator = hydrator;
  }

  public LineageScene getScene(
      String focusFqn,
      String entityType,
      LineageLens lens,
      LineageBand band,
      int upstreamDepth,
      int downstreamDepth,
      int size,
      String queryFilter,
      boolean includeDeleted,
      SecurityContext securityContext,
      SubjectContext subjectContext)
      throws IOException {
    LineageLens sceneLens = lens == null ? LineageLens.SERVICE : lens;
    LineageBand sceneBand = defaultBand(band);
    boolean authorizeScene = requiresEntityAuthorization(subjectContext);
    boolean cacheable = canUseSharedRootCache(focusFqn, subjectContext);
    LineageSceneCache.Key cacheKey =
        new LineageSceneCache.Key(
            sceneLens,
            sceneBand,
            upstreamDepth,
            downstreamDepth,
            size,
            queryFilter == null ? "" : queryFilter,
            includeDeleted);
    if (cacheable) {
      Optional<LineageScene> cached = LineageSceneCache.getInstance().get(cacheKey);
      if (cached.isPresent()) {
        return cached.get();
      }
    }
    SearchLineageResult lineage =
        shouldLoadFocusedChildrenOnly(focusFqn, entityType, sceneBand)
            ? emptyLineage()
            : fetchLineage(
                focusFqn,
                entityType,
                sceneLens,
                upstreamDepth,
                downstreamDepth,
                size,
                sceneBand,
                queryFilter,
                includeDeleted,
                subjectContext);
    boolean sampled = false;
    if (nullOrEmpty(focusFqn)) {
      sampled =
          enrichRootSceneAssets(
              lineage, sceneLens, sceneBand, size, queryFilter, includeDeleted, subjectContext);
    } else if (!nullOrEmpty(focusFqn) && sceneBand != LineageBand.LAYER) {
      FocusedAssetsResult focusedAssets =
          enrichFocusedSceneAssets(
              lineage, focusFqn, entityType, sceneBand, size, includeDeleted, subjectContext);
      sampled = focusedAssets.sampled();
      enrichFocusedContainerTotals(
          lineage, focusFqn, entityType, size, includeDeleted, subjectContext);
      enrichFocusedChildLineage(
          lineage,
          focusedAssets.seeds(),
          sceneLens,
          sceneBand,
          upstreamDepth,
          downstreamDepth,
          queryFilter,
          includeDeleted,
          subjectContext);
    }
    if (authorizeScene) {
      Include include = includeDeleted ? Include.DELETED : Include.NON_DELETED;
      hydrator.pruneUnauthorizedLineage(
          securityContext, lineage, include, LineageDomainFilter.shouldApply(subjectContext));
      sampled = true;
    }
    pruneLineage(lineage, subjectContext, focusFqn);
    LineageScene scene =
        resolveScene(focusFqn, entityType, sceneLens, sceneBand, lineage, size, sampled);
    if (cacheable) {
      LineageSceneCache.getInstance().put(cacheKey, scene);
    }
    return scene;
  }

  private static boolean canUseSharedRootCache(String focusFqn, SubjectContext subjectContext) {
    return nullOrEmpty(focusFqn) && (subjectContext == null || subjectContext.isAdmin());
  }

  private static boolean requiresEntityAuthorization(SubjectContext subjectContext) {
    return subjectContext != null && !subjectContext.isAdmin();
  }

  LineageScene resolveScene(
      String focusFqn,
      String entityType,
      LineageLens sceneLens,
      LineageBand sceneBand,
      SearchLineageResult lineage,
      int size) {
    return resolveScene(focusFqn, entityType, sceneLens, sceneBand, lineage, size, false);
  }

  private LineageScene resolveScene(
      String focusFqn,
      String entityType,
      LineageLens sceneLens,
      LineageBand sceneBand,
      SearchLineageResult lineage,
      int size,
      boolean sampled) {
    enrichIndexedUpstreamLineage(lineage);
    Map<String, SceneAsset> assets = buildAssets(lineage, sceneBand);
    SceneAsset focusAsset = findFocusAsset(assets.values(), focusFqn);
    Ref focusRef = focusAsset == null ? null : focusAsset.refForFqn(focusFqn);
    SceneSelection selection =
        buildSelection(assets, lineage, sceneLens, sceneBand, focusRef, size);

    return new LineageScene()
        .withLens(sceneLens)
        .withBand(sceneBand)
        .withFocusFqn(focusRef == null ? focusFqn : focusRef.fqn())
        .withFocusEntityType(focusRef == null ? entityType : focusRef.entityType())
        .withOriginFqn(focusFqn)
        .withOriginEntityType(entityType)
        .withNodes(selection.nodes())
        .withEdges(selection.edges())
        .withBreadcrumb(buildBreadcrumb(sceneLens, sceneBand, focusAsset, focusRef))
        .withHiddenNodeCount(selection.hiddenNodeCount())
        .withSampled(sampled);
  }

  private static LineageBand defaultBand(LineageBand band) {
    return band == null ? LineageBand.ASSET : band;
  }

  private static boolean shouldLoadFocusedChildrenOnly(
      String focusFqn, String entityType, LineageBand sceneBand) {
    return !nullOrEmpty(focusFqn)
        && sceneBand == LineageBand.ASSET
        && !nullOrEmpty(focusedAssetFieldName(entityType));
  }

  private static SearchLineageResult emptyLineage() {
    return new SearchLineageResult()
        .withNodes(new LinkedHashMap<>())
        .withUpstreamEdges(new LinkedHashMap<>())
        .withDownstreamEdges(new LinkedHashMap<>());
  }

  private static SearchLineageResult fetchLineage(
      String focusFqn,
      String entityType,
      LineageLens lens,
      int upstreamDepth,
      int downstreamDepth,
      int size,
      LineageBand band,
      String queryFilter,
      boolean includeDeleted,
      SubjectContext subjectContext)
      throws IOException {
    if (nullOrEmpty(focusFqn)) {
      if (requiresEntityAuthorization(subjectContext)) {
        SearchLineageResult lineage =
            Entity.getSearchRepository()
                .searchPlatformLineage(
                    "dataAsset",
                    rootLineageParticipantQuery(queryFilter, subjectContext),
                    includeDeleted,
                    subjectContext);
        hydrateMissingRootLineageAssets(lineage, band, includeDeleted, subjectContext);
        return lineage;
      }
      return Entity.getSearchRepository()
          .searchPlatformLineage(lens.value(), queryFilter, includeDeleted, subjectContext);
    }
    return Entity.getSearchRepository()
        .searchLineage(
            new SearchLineageRequest()
                .withFqn(focusFqn)
                .withUpstreamDepth(upstreamDepth)
                .withDownstreamDepth(downstreamDepth)
                .withQueryFilter(queryFilter)
                .withPreservePaths(true)
                .withIncludeDeleted(includeDeleted)
                .withLayerSize(size)
                .withIsConnectedVia(isConnectedVia(entityType))
                .withIncludeSourceFields(getRequiredLineageFields(sourceFieldsForBand(band))),
            subjectContext);
  }

  private static String sourceFieldsForBand(LineageBand band) {
    return band == LineageBand.FIELD ? FIELD_BAND_SOURCE_FIELDS : BASE_SOURCE_FIELDS;
  }

  private static boolean enrichRootSceneAssets(
      SearchLineageResult lineage,
      LineageLens lens,
      LineageBand band,
      int size,
      String queryFilter,
      boolean includeDeleted,
      SubjectContext subjectContext)
      throws IOException {
    if (lineage == null || lineage.getNodes() == null || lineage.getNodes().isEmpty()) {
      return false;
    }
    List<Ref> roots = rootRefs(lineage, lens);
    if (roots.isEmpty()) {
      return false;
    }

    String fieldName = rootAssetFieldName(lens);
    if (nullOrEmpty(fieldName)) {
      return false;
    }
    RootAssetCounts rootAssetCounts =
        fetchRootAssetCountsByLens(fieldName, queryFilter, includeDeleted, subjectContext);
    if (rootAssetCounts.truncated()) {
      LOG.warn(
          "Lineage scene root aggregation exceeded its bucket limit for lens field {}", fieldName);
    }
    if (band == LineageBand.LAYER) {
      for (Ref root : roots) {
        Map<String, Integer> counts =
            rootAssetCounts.counts().getOrDefault(normalizedKey(root.fqn()), Map.of());
        for (String entityType : ROOT_ASSET_ENTITY_TYPES) {
          int count = counts.getOrDefault(normalizedKey(entityType), 0);
          if (count > 0) {
            lineage
                .getNodes()
                .putIfAbsent(
                    syntheticCountFqn(root, entityType),
                    new NodeInformation()
                        .withEntity(syntheticCountEntity(root, lens, entityType, count)));
          }
        }
      }
      return rootAssetCounts.truncated();
    }

    int remainingBudget = Math.max(1, size + 1);
    int totalMatchingAssets = 0;
    List<IOTask<SearchRootAssetsResult>> tasks = new ArrayList<>();
    for (Ref root : roots) {
      Map<String, Integer> counts =
          rootAssetCounts.counts().getOrDefault(normalizedKey(root.fqn()), Map.of());
      for (String entityType : ROOT_ASSET_ENTITY_TYPES) {
        int count = counts.getOrDefault(normalizedKey(entityType), 0);
        totalMatchingAssets += count;
        if (count <= 0 || remainingBudget <= 0) {
          continue;
        }
        int fetchSize = Math.min(Math.min(ROOT_ASSET_PAGE_SIZE, count), remainingBudget);
        remainingBudget -= fetchSize;
        tasks.add(
            () ->
                searchRootAssets(
                    fieldName,
                    root.fqn(),
                    entityType,
                    includeDeleted,
                    fetchSize,
                    band,
                    null,
                    subjectContext));
      }
    }

    int fetchedAssets = 0;
    for (SearchRootAssetsResult searchResult :
        runBounded(tasks, FOCUSED_CHILD_LINEAGE_PARALLELISM)) {
      for (Map<String, Object> asset : searchResult.assets()) {
        String fqn = stringValue(asset, "fullyQualifiedName");
        if (!nullOrEmpty(fqn) && !SERVICE_ENTITY_TYPES.contains(stringValue(asset, "entityType"))) {
          lineage.getNodes().putIfAbsent(fqn, new NodeInformation().withEntity(asset));
          fetchedAssets++;
        }
      }
    }
    return rootAssetCounts.truncated() || totalMatchingAssets > fetchedAssets;
  }

  private static RootAssetCounts fetchRootAssetCountsByLens(
      String rootFieldName,
      String queryFilter,
      boolean includeDeleted,
      SubjectContext subjectContext)
      throws IOException {
    String aggregation =
        "bucketName=roots:aggType=terms:field="
            + rootFieldName
            + "&size="
            + ROOT_AGGREGATION_BUCKET_SIZE
            + ",bucketName=types:aggType=terms:field=entityType&size="
            + ROOT_TYPE_AGGREGATION_BUCKET_SIZE;
    DataQualityReport response =
        Entity.getSearchRepository()
            .genericAggregation(
                rootAssetQuery(queryFilter, includeDeleted, subjectContext),
                "dataAsset",
                SearchIndexUtils.buildAggregationTree(aggregation),
                subjectContext);
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

  private static String rootAssetQuery(
      String queryFilter, boolean includeDeleted, SubjectContext subjectContext) {
    List<Object> must = new ArrayList<>();
    must.add(Map.of("term", Map.of("deleted", includeDeleted)));
    addQueryFilterClause(must, queryFilter);
    addDomainAccessClause(must, subjectContext);
    return JsonUtils.pojoToJson(Map.of("query", Map.of("bool", Map.of("must", must))));
  }

  static String rootLineageParticipantQuery(String queryFilter, SubjectContext subjectContext) {
    List<Object> must = new ArrayList<>();
    must.add(Map.of("exists", Map.of("field", UPSTREAM_LINEAGE_DOC_ID_FIELD)));
    addQueryFilterClause(must, queryFilter);
    addDomainAccessClause(must, subjectContext);
    return JsonUtils.pojoToJson(Map.of("query", Map.of("bool", Map.of("must", must))));
  }

  private static void addQueryFilterClause(List<Object> must, String queryFilter) {
    if (!nullOrEmpty(queryFilter)) {
      try {
        JsonNode query = JsonUtils.readTree(queryFilter);
        JsonNode innerQuery = query.has("query") ? query.path("query") : query;
        if (!innerQuery.isMissingNode() && !innerQuery.isNull() && !innerQuery.isEmpty()) {
          must.add(JsonUtils.convertValue(innerQuery, new TypeReference<Map<String, Object>>() {}));
        }
      } catch (RuntimeException exception) {
        LOG.warn("Ignoring invalid lineage scene query filter", exception);
      }
    }
  }

  private static void addDomainAccessClause(List<Object> must, SubjectContext subjectContext) {
    Map<String, Object> clause = domainAccessClause(subjectContext);
    if (!clause.isEmpty()) {
      must.add(clause);
    }
  }

  static Map<String, Object> domainAccessClause(SubjectContext subjectContext) {
    if (!LineageDomainFilter.shouldApply(subjectContext)) {
      return Map.of();
    }
    List<Object> allowedDomains = new ArrayList<>();
    allowedDomains.add(
        Map.of(
            "bool",
            Map.of("must_not", List.of(Map.of("exists", Map.of("field", DOMAINS_FQN_FIELD))))));
    for (EntityReference domain : subjectContext.getUserDomains()) {
      if (domain == null || nullOrEmpty(domain.getFullyQualifiedName())) {
        continue;
      }
      String domainFqn = domain.getFullyQualifiedName();
      allowedDomains.add(Map.of("term", Map.of(DOMAINS_FQN_FIELD, domainFqn)));
      allowedDomains.add(Map.of("prefix", Map.of(DOMAINS_FQN_FIELD, domainFqn + ".")));
    }
    return Map.of("bool", Map.of("should", allowedDomains, "minimum_should_match", 1));
  }

  private static String normalizedKey(String value) {
    return value == null ? "" : value.toLowerCase(Locale.ROOT);
  }

  private static FocusedAssetsResult enrichFocusedSceneAssets(
      SearchLineageResult lineage,
      String focusFqn,
      String entityType,
      LineageBand band,
      int size,
      boolean includeDeleted,
      SubjectContext subjectContext)
      throws IOException {
    if (lineage == null || lineage.getNodes() == null) {
      return new FocusedAssetsResult(List.of(), false);
    }
    String fieldName = focusedAssetFieldName(entityType);
    if (nullOrEmpty(fieldName)) {
      return new FocusedAssetsResult(List.of(), false);
    }
    if (DATABASE_FQN_KEYWORD_FIELD.equals(fieldName) && !isDatabaseKeywordFieldMapped()) {
      logDatabaseReindexRequired();
      return new FocusedAssetsResult(List.of(), false);
    }

    Map<String, LineageSeed> seedsByFqn = new LinkedHashMap<>();
    int remaining = Math.max(1, size + 1);
    boolean sampled = false;

    for (String rootAssetType : ROOT_ASSET_ENTITY_TYPES) {
      if (remaining <= 0) {
        sampled = true;
        break;
      }
      SearchRootAssetsResult participants =
          searchRootAssets(
              fieldName,
              focusFqn,
              rootAssetType,
              includeDeleted,
              remaining,
              band,
              UPSTREAM_LINEAGE_DOC_ID_FIELD,
              subjectContext);
      int added = addFocusedAssets(lineage, seedsByFqn, participants.assets(), remaining);
      remaining -= added;
      sampled |= participants.total() > participants.assets().size();
    }

    if (remaining > 0) {
      SearchRootAssetsResult feederHits =
          searchRootAssets(
              UPSTREAM_LINEAGE_FROM_FQN_FIELD,
              focusFqn + ".*",
              "dataAsset",
              includeDeleted,
              Math.max(remaining * 4, remaining),
              null,
              List.of("upstreamLineage"),
              subjectContext);
      sampled |= feederHits.total() > feederHits.assets().size();
      List<String> feederFqns = feederChildFqns(feederHits.assets(), focusFqn);
      if (!feederFqns.isEmpty()) {
        SearchRootAssetsResult feederAssets =
            searchAssetsByTerms(
                ENTITY_FQN_FIELD,
                feederFqns.stream().map(LineageSceneResolver::normalizedKey).toList(),
                "dataAsset",
                includeDeleted,
                remaining,
                band,
                subjectContext);
        int added = addFocusedAssets(lineage, seedsByFqn, feederAssets.assets(), remaining);
        remaining -= added;
        sampled |= feederAssets.total() > feederAssets.assets().size();
      }
    }

    for (String rootAssetType : ROOT_ASSET_ENTITY_TYPES) {
      if (remaining <= 0) {
        sampled = true;
        break;
      }
      SearchRootAssetsResult fill =
          searchRootAssets(
              fieldName,
              focusFqn,
              rootAssetType,
              includeDeleted,
              remaining + seedsByFqn.size(),
              band,
              null,
              subjectContext);
      int added = addFocusedAssets(lineage, seedsByFqn, fill.assets(), remaining);
      remaining -= added;
      sampled |= fill.total() > fill.assets().size();
    }
    sampled |= seedsByFqn.size() > FOCUSED_CHILD_LINEAGE_LOOKUP_LIMIT;
    return new FocusedAssetsResult(new ArrayList<>(seedsByFqn.values()), sampled);
  }

  private static int addFocusedAssets(
      SearchLineageResult lineage,
      Map<String, LineageSeed> seedsByFqn,
      List<Map<String, Object>> assets,
      int limit) {
    int added = 0;
    for (Map<String, Object> asset : assets) {
      String fqn = stringValue(asset, "fullyQualifiedName");
      String assetEntityType = stringValue(asset, "entityType");
      if (nullOrEmpty(fqn)
          || SERVICE_ENTITY_TYPES.contains(assetEntityType)
          || seedsByFqn.containsKey(fqn)) {
        continue;
      }
      lineage.getNodes().putIfAbsent(fqn, new NodeInformation().withEntity(asset));
      seedsByFqn.put(fqn, new LineageSeed(fqn, assetEntityType));
      added++;
      if (added >= limit) {
        break;
      }
    }
    return added;
  }

  private static List<String> feederChildFqns(List<Map<String, Object>> assets, String focusFqn) {
    Set<String> fqns = new LinkedHashSet<>();
    String childPrefix = focusFqn + ".";
    for (Map<String, Object> asset : assets) {
      for (Map<String, Object> upstream : listValue(asset, "upstreamLineage")) {
        Map<String, Object> fromEntity = mapValue(upstream.get("fromEntity"));
        String fqn = stringValue(fromEntity, "fullyQualifiedName");
        if (!nullOrEmpty(fqn) && fqn.startsWith(childPrefix)) {
          fqns.add(fqn);
        }
      }
    }
    return new ArrayList<>(fqns);
  }

  private static void enrichFocusedContainerTotals(
      SearchLineageResult lineage,
      String focusFqn,
      String entityType,
      int size,
      boolean includeDeleted,
      SubjectContext subjectContext)
      throws IOException {
    if (lineage == null || lineage.getNodes() == null || nullOrEmpty(focusFqn)) {
      return;
    }
    if (SERVICE_ENTITY_TYPES.contains(entityType)) {
      enrichServiceDatabaseTotals(lineage, focusFqn, size, includeDeleted, subjectContext);
    } else if (Entity.DATABASE.equals(entityType)) {
      enrichDatabaseSchemaTotals(lineage, focusFqn, size, includeDeleted, subjectContext);
    }
  }

  private static void enrichServiceDatabaseTotals(
      SearchLineageResult lineage,
      String serviceFqn,
      int size,
      boolean includeDeleted,
      SubjectContext subjectContext)
      throws IOException {
    SearchRootAssetsResult databases =
        searchRootAssets(
            SERVICE_FQN_KEYWORD_FIELD,
            serviceFqn,
            Entity.DATABASE,
            includeDeleted,
            Math.max(1, Math.min(size + 1, CONTAINER_TOTAL_LOOKUP_LIMIT)),
            subjectContext);
    List<SceneAsset> databaseAssets = toCountableContainerAssets(databases.assets());
    Map<String, Integer> tableCounts =
        fetchContainerAssetCounts(
            SERVICE_FQN_KEYWORD_FIELD,
            serviceFqn,
            DATABASE_FQN_KEYWORD_FIELD,
            Entity.TABLE,
            includeDeleted,
            Math.max(1, Math.min(size + 1, CONTAINER_TOTAL_LOOKUP_LIMIT)),
            subjectContext);
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

  private static void enrichDatabaseSchemaTotals(
      SearchLineageResult lineage,
      String databaseFqn,
      int size,
      boolean includeDeleted,
      SubjectContext subjectContext)
      throws IOException {
    SearchRootAssetsResult schemas =
        searchRootAssets(
            DATABASE_FQN_KEYWORD_FIELD,
            databaseFqn,
            Entity.DATABASE_SCHEMA,
            includeDeleted,
            Math.max(1, Math.min(size + 1, CONTAINER_TOTAL_LOOKUP_LIMIT)),
            subjectContext);
    List<SceneAsset> schemaAssets = toCountableContainerAssets(schemas.assets());
    Map<String, Integer> tableCounts =
        fetchContainerAssetCounts(
            DATABASE_FQN_KEYWORD_FIELD,
            databaseFqn,
            DATABASE_SCHEMA_FQN_KEYWORD_FIELD,
            Entity.TABLE,
            includeDeleted,
            Math.max(1, Math.min(size + 1, CONTAINER_TOTAL_LOOKUP_LIMIT)),
            subjectContext);
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
        .map(LineageSceneResolver::toAsset)
        .filter(asset -> asset.self() != null && !nullOrEmpty(asset.self().fqn()))
        .toList();
  }

  private static Map<String, Integer> fetchContainerAssetCounts(
      String parentFieldName,
      String parentFqn,
      String bucketFieldName,
      String entityType,
      boolean includeDeleted,
      int size,
      SubjectContext subjectContext)
      throws IOException {
    if (nullOrEmpty(parentFieldName) || nullOrEmpty(parentFqn) || nullOrEmpty(bucketFieldName)) {
      return Map.of();
    }
    if (DATABASE_FQN_KEYWORD_FIELD.equals(bucketFieldName) && !isDatabaseKeywordFieldMapped()) {
      logDatabaseReindexRequired();
      return Map.of();
    }
    String aggregation =
        "bucketName=containers:aggType=terms:field=" + bucketFieldName + "&size=" + size;
    DataQualityReport response =
        Entity.getSearchRepository()
            .genericAggregation(
                parentFieldQuery(parentFieldName, parentFqn, includeDeleted, subjectContext),
                entityType,
                SearchIndexUtils.buildAggregationTree(aggregation),
                subjectContext);
    return aggregationCounts(response, bucketFieldName);
  }

  private static String parentFieldQuery(
      String fieldName, String fieldValue, boolean includeDeleted, SubjectContext subjectContext) {
    List<Object> must = new ArrayList<>();
    must.add(Map.of("wildcard", Map.of(fieldName, fieldValue)));
    must.add(Map.of("term", Map.of("deleted", includeDeleted)));
    addDomainAccessClause(must, subjectContext);
    return JsonUtils.pojoToJson(Map.of("query", Map.of("bool", Map.of("must", must))));
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

  private static boolean isDatabaseKeywordFieldMapped() throws IOException {
    return Entity.getSearchRepository()
        .isFieldMappedInIndex(Entity.TABLE, DATABASE_FQN_KEYWORD_FIELD);
  }

  private static void logDatabaseReindexRequired() {
    LOG.warn(
        "Field {} is not mapped. Run Search Reindex to enable database-focused lineage scenes "
            + "and per-database lineage counts.",
        DATABASE_FQN_KEYWORD_FIELD);
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

  private static void enrichFocusedChildLineage(
      SearchLineageResult lineage,
      List<LineageSeed> lineageSeeds,
      LineageLens lens,
      LineageBand band,
      int upstreamDepth,
      int downstreamDepth,
      String queryFilter,
      boolean includeDeleted,
      SubjectContext subjectContext)
      throws IOException {
    List<LineageSeed> seeds =
        lineageSeeds.stream()
            .filter(seed -> !nullOrEmpty(seed.fqn()) && !nullOrEmpty(seed.entityType()))
            .limit(FOCUSED_CHILD_LINEAGE_LOOKUP_LIMIT)
            .toList();
    if (seeds.isEmpty()) {
      return;
    }
    List<IOTask<SearchLineageResult>> tasks =
        seeds.stream()
            .map(
                seed ->
                    bestEffortTask(
                        "child lineage for " + seed.entityType() + " " + seed.fqn(),
                        () ->
                            fetchLineage(
                                seed.fqn(),
                                seed.entityType(),
                                lens,
                                upstreamDepth,
                                downstreamDepth,
                                FOCUSED_CHILD_LINEAGE_SIZE,
                                band,
                                queryFilter,
                                includeDeleted,
                                subjectContext)))
            .toList();
    for (SearchLineageResult childLineage : runBounded(tasks, FOCUSED_CHILD_LINEAGE_PARALLELISM)) {
      mergeLineage(lineage, childLineage);
    }
  }

  static <T> IOTask<T> bestEffortTask(String description, IOTask<T> task) {
    return () -> {
      try {
        return task.call();
      } catch (IOException exception) {
        LOG.warn("Failed to load {}; skipping result: {}", description, exception.getMessage());
        return null;
      }
    };
  }

  static <T> List<T> runBounded(List<IOTask<T>> tasks, int parallelism) throws IOException {
    if (tasks.isEmpty()) {
      return List.of();
    }
    Semaphore semaphore = new Semaphore(Math.max(1, parallelism));
    List<T> results = new ArrayList<>();
    try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
      List<CompletableFuture<T>> futures =
          tasks.stream()
              .map(
                  task ->
                      CompletableFuture.supplyAsync(
                              RequestLatencyContext.wrapWithContext(
                                  () -> {
                                    boolean acquired = false;
                                    try {
                                      semaphore.acquire();
                                      acquired = true;
                                      return task.call();
                                    } catch (InterruptedException exception) {
                                      Thread.currentThread().interrupt();
                                      throw new CompletionException(exception);
                                    } catch (IOException exception) {
                                      throw new CompletionException(exception);
                                    } finally {
                                      if (acquired) {
                                        semaphore.release();
                                      }
                                    }
                                  }),
                              executor)
                          .orTimeout(LOOKUP_TIMEOUT_SECONDS, TimeUnit.SECONDS))
              .toList();
      for (CompletableFuture<T> future : futures) {
        try {
          T result = future.join();
          if (result != null) {
            results.add(result);
          }
        } catch (CompletionException exception) {
          Throwable cause = exception.getCause();
          if (cause instanceof TimeoutException) {
            future.cancel(true);
            LOG.warn(
                "Timed out after {} seconds while building a lineage scene; skipping result",
                LOOKUP_TIMEOUT_SECONDS);
          } else if (cause instanceof IOException ioException) {
            throw ioException;
          } else {
            throw new IOException(cause);
          }
        }
      }
    }
    return results;
  }

  private static void mergeLineage(SearchLineageResult target, SearchLineageResult source) {
    if (target == null || source == null) {
      return;
    }
    nodeMap(target).putAll(nodeMap(source));
    upstreamEdgeMap(target).putAll(upstreamEdgeMap(source));
    downstreamEdgeMap(target).putAll(downstreamEdgeMap(source));
  }

  private static void hydrateMissingRootLineageAssets(
      SearchLineageResult lineage,
      LineageBand band,
      boolean includeDeleted,
      SubjectContext subjectContext)
      throws IOException {
    Set<String> missingFqns = new LinkedHashSet<>();
    for (EsLineageData edge : allEdges(lineage)) {
      if (edge.getFromEntity() != null
          && !nullOrEmpty(edge.getFromEntity().getFullyQualifiedName())) {
        missingFqns.add(edge.getFromEntity().getFullyQualifiedName());
      }
      if (edge.getToEntity() != null && !nullOrEmpty(edge.getToEntity().getFullyQualifiedName())) {
        missingFqns.add(edge.getToEntity().getFullyQualifiedName());
      }
    }
    missingFqns.removeAll(nodeMap(lineage).keySet());
    List<String> missing = new ArrayList<>(missingFqns);
    for (int offset = 0; offset < missing.size(); offset += ROOT_LINEAGE_HYDRATION_BATCH_SIZE) {
      List<String> batch =
          missing.subList(
              offset, Math.min(offset + ROOT_LINEAGE_HYDRATION_BATCH_SIZE, missing.size()));
      SearchRootAssetsResult searchResult =
          searchAssetsByTerms(
              ENTITY_FQN_FIELD,
              batch.stream().map(LineageSceneResolver::normalizedKey).toList(),
              "dataAsset",
              includeDeleted,
              batch.size(),
              band,
              subjectContext);
      for (Map<String, Object> asset : searchResult.assets()) {
        String fqn = stringValue(asset, "fullyQualifiedName");
        if (!nullOrEmpty(fqn)) {
          nodeMap(lineage).putIfAbsent(fqn, new NodeInformation().withEntity(asset));
        }
      }
    }
  }

  private static void enrichIndexedUpstreamLineage(SearchLineageResult lineage) {
    if (lineage == null || lineage.getNodes() == null) {
      return;
    }
    for (NodeInformation nodeInformation : new ArrayList<>(lineage.getNodes().values())) {
      if (nodeInformation == null || nodeInformation.getEntity() == null) {
        continue;
      }
      Map<String, Object> entity = nodeInformation.getEntity();
      if (!hasRelationshipIdentity(entity)) {
        continue;
      }
      for (EsLineageData upstreamEdge : getUpstreamLineageListIfExist(entity)) {
        if (upstreamEdge == null
            || upstreamEdge.getFromEntity() == null
            || nullOrEmpty(upstreamEdge.getFromEntity().getFullyQualifiedName())) {
          continue;
        }
        EsLineageData edge = JsonUtils.deepCopy(upstreamEdge, EsLineageData.class);
        edge.withToEntity(getRelationshipRef(entity));
        upstreamEdgeMap(lineage).putIfAbsent(lineageEdgeKey(edge), edge);
      }
    }
  }

  private static boolean hasRelationshipIdentity(Map<String, Object> entity) {
    return !nullOrEmpty(stringValue(entity, "id"))
        && !nullOrEmpty(stringValue(entity, "entityType"))
        && !nullOrEmpty(stringValue(entity, "fullyQualifiedName"));
  }

  private static String lineageEdgeKey(EsLineageData edge) {
    return firstNonBlank(
        edge.getDocUniqueId(),
        edge.getDocId(),
        edge.getFromEntity().getFullyQualifiedName()
            + "->"
            + edge.getToEntity().getFullyQualifiedName());
  }

  private static Map<String, NodeInformation> nodeMap(SearchLineageResult lineage) {
    if (lineage.getNodes() == null) {
      lineage.setNodes(new LinkedHashMap<>());
    }
    return lineage.getNodes();
  }

  private static Map<String, EsLineageData> upstreamEdgeMap(SearchLineageResult lineage) {
    if (lineage.getUpstreamEdges() == null) {
      lineage.setUpstreamEdges(new LinkedHashMap<>());
    }
    return lineage.getUpstreamEdges();
  }

  private static Map<String, EsLineageData> downstreamEdgeMap(SearchLineageResult lineage) {
    if (lineage.getDownstreamEdges() == null) {
      lineage.setDownstreamEdges(new LinkedHashMap<>());
    }
    return lineage.getDownstreamEdges();
  }

  private static String focusedAssetFieldName(String entityType) {
    if (nullOrEmpty(entityType)) {
      return null;
    }
    if (SERVICE_ENTITY_TYPES.contains(entityType)) {
      return SERVICE_FQN_KEYWORD_FIELD;
    }
    return switch (entityType) {
      case Entity.DOMAIN -> DOMAINS_FQN_FIELD;
      case Entity.DATA_PRODUCT -> DATA_PRODUCTS_FQN_FIELD;
      case Entity.DATABASE -> DATABASE_FQN_KEYWORD_FIELD;
      case Entity.DATABASE_SCHEMA -> DATABASE_SCHEMA_FQN_KEYWORD_FIELD;
      default -> null;
    };
  }

  private static void pruneLineage(
      SearchLineageResult lineage, SubjectContext subjectContext, String focusFqn) {
    String rootFqn =
        lineage != null && lineage.getNodes() != null && lineage.getNodes().containsKey(focusFqn)
            ? focusFqn
            : null;
    LineageDomainFilter.prune(lineage, subjectContext, rootFqn);
  }

  private static List<Ref> rootRefs(SearchLineageResult lineage, LineageLens lens) {
    Map<String, Ref> refs = new LinkedHashMap<>();
    for (NodeInformation nodeInformation : lineage.getNodes().values()) {
      if (nodeInformation == null || nodeInformation.getEntity() == null) {
        continue;
      }
      SceneAsset asset = toAsset(nodeInformation.getEntity());
      lensRef(asset, lens)
          .filter(ref -> !nullOrEmpty(ref.fqn()))
          .ifPresent(ref -> refs.putIfAbsent(ref.fqn(), ref));
    }
    return new ArrayList<>(refs.values());
  }

  private static String rootAssetFieldName(LineageLens lens) {
    return switch (lens) {
      case DOMAIN -> DOMAINS_FQN_FIELD;
      case DATA_PRODUCT -> DATA_PRODUCTS_FQN_FIELD;
      case SERVICE -> SERVICE_FQN_KEYWORD_FIELD;
    };
  }

  private static SearchRootAssetsResult searchRootAssets(
      String fieldName,
      String fieldValue,
      String entityType,
      boolean includeDeleted,
      int size,
      SubjectContext subjectContext)
      throws IOException {
    return searchRootAssets(
        fieldName,
        fieldValue,
        entityType,
        includeDeleted,
        size,
        LineageBand.ASSET,
        null,
        subjectContext);
  }

  private static SearchRootAssetsResult searchRootAssets(
      String fieldName,
      String fieldValue,
      String entityType,
      boolean includeDeleted,
      int size,
      LineageBand band,
      String requiredExistsField,
      SubjectContext subjectContext)
      throws IOException {
    return searchRootAssets(
        fieldName,
        fieldValue,
        entityType,
        includeDeleted,
        size,
        requiredExistsField,
        sourceFieldList(band),
        subjectContext);
  }

  private static SearchRootAssetsResult searchRootAssets(
      String fieldName,
      String fieldValue,
      String entityType,
      boolean includeDeleted,
      int size,
      String requiredExistsField,
      List<String> sourceIncludes,
      SubjectContext subjectContext)
      throws IOException {
    Response response =
        Entity.getSearchRepository()
            .search(
                sceneAssetSearchRequest(
                    Entity.getSearchRepository().getIndexOrAliasName(entityType),
                    includeDeleted,
                    size,
                    sourceIncludes,
                    fieldQuery(fieldName, fieldValue, requiredExistsField, subjectContext)),
                subjectContext);
    return parseSearchAssets(response);
  }

  private static SearchRootAssetsResult searchAssetsByTerms(
      String fieldName,
      List<String> fieldValues,
      String entityType,
      boolean includeDeleted,
      int size,
      LineageBand band,
      SubjectContext subjectContext)
      throws IOException {
    Response response =
        Entity.getSearchRepository()
            .search(
                sceneAssetSearchRequest(
                    Entity.getSearchRepository().getIndexOrAliasName(entityType),
                    includeDeleted,
                    size,
                    sourceFieldList(band),
                    termsQuery(fieldName, fieldValues, subjectContext)),
                subjectContext);
    return parseSearchAssets(response);
  }

  static SearchRequest sceneAssetSearchRequest(
      String index,
      boolean includeDeleted,
      int size,
      List<String> sourceIncludes,
      String queryFilter) {
    return new SearchRequest()
        .withQuery("*")
        .withIndex(index)
        .withFrom(0)
        .withSize(size)
        .withQueryFilter(queryFilter)
        .withFetchSource(true)
        .withTrackTotalHits(true)
        .withDeleted(includeDeleted)
        .withIncludeSourceFields(sourceIncludes)
        .withIncludeAggregations(false);
  }

  static String fieldQuery(
      String fieldName,
      String fieldValue,
      String requiredExistsField,
      SubjectContext subjectContext) {
    List<Object> must = new ArrayList<>();
    must.add(
        Map.of(
            "wildcard", Map.of(fieldName, Map.of("value", fieldValue, "case_insensitive", true))));
    if (!nullOrEmpty(requiredExistsField)) {
      must.add(Map.of("exists", Map.of("field", requiredExistsField)));
    }
    addDomainAccessClause(must, subjectContext);
    return JsonUtils.pojoToJson(Map.of("query", Map.of("bool", Map.of("must", must))));
  }

  private static String termsQuery(
      String fieldName, List<String> fieldValues, SubjectContext subjectContext) {
    List<Object> must = new ArrayList<>();
    must.add(Map.of("terms", Map.of(fieldName, fieldValues)));
    addDomainAccessClause(must, subjectContext);
    return JsonUtils.pojoToJson(Map.of("query", Map.of("bool", Map.of("must", must))));
  }

  private static List<String> sourceFieldList(LineageBand band) {
    return List.of(sourceFieldsForBand(band).split(","));
  }

  private static SearchRootAssetsResult parseSearchAssets(Response response) {
    if (!(response.getEntity() instanceof String responseJson)) {
      return new SearchRootAssetsResult(List.of(), 0);
    }
    JsonNode responseRoot = JsonUtils.readTree(responseJson);
    JsonNode hits = responseRoot.path("hits").path("hits");
    if (!hits.isArray()) {
      return new SearchRootAssetsResult(List.of(), searchTotal(responseRoot));
    }
    List<Map<String, Object>> assets = new ArrayList<>();
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (!source.isObject()) {
        continue;
      }
      assets.add(JsonUtils.convertValue(source, new TypeReference<Map<String, Object>>() {}));
    }
    return new SearchRootAssetsResult(assets, searchTotal(responseRoot));
  }

  private static int searchTotal(JsonNode responseRoot) {
    JsonNode total = responseRoot.path("hits").path("total");
    if (total.isInt() || total.isLong()) {
      return total.asInt();
    }
    return total.path("value").asInt(0);
  }

  private static String syntheticCountFqn(Ref root, String entityType) {
    return "__lineage_scene_count__." + root.fqn() + "." + entityType;
  }

  private static Map<String, Object> syntheticCountEntity(
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

  private static Map<String, Object> syntheticCountEntity(
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

  private static Map<String, SceneAsset> buildAssets(
      SearchLineageResult lineage, LineageBand band) {
    Map<String, SceneAsset> assets = new LinkedHashMap<>();
    if (lineage == null || lineage.getNodes() == null) {
      return assets;
    }
    for (NodeInformation nodeInformation : lineage.getNodes().values()) {
      if (nodeInformation == null || nodeInformation.getEntity() == null) {
        continue;
      }
      SceneAsset asset = toAsset(nodeInformation.getEntity(), band);
      if (!nullOrEmpty(asset.self().fqn())) {
        assets.put(asset.self().fqn(), asset);
      }
    }
    return assets;
  }

  private static SceneAsset toAsset(Map<String, Object> entity) {
    return toAsset(entity, LineageBand.ASSET);
  }

  private static SceneAsset toAsset(Map<String, Object> entity, LineageBand band) {
    String entityType = stringValue(entity, "entityType");
    if (nullOrEmpty(entityType)) {
      entityType = stringValue(entity, "type");
    }
    Ref self =
        new Ref(
            stringValue(entity, "id"),
            stringValue(entity, "fullyQualifiedName"),
            entityType,
            label(entity),
            levelKind(entityType),
            stringValue(entity, "serviceType"),
            trimSourceEntity(entity, band));

    Ref service = serviceRef(entity, entityType, self, band);
    Ref database = refValue(entity, "database", LineageLevelKind.DATABASE, band);
    Ref schema = refValue(entity, "databaseSchema", LineageLevelKind.SCHEMA, band);
    Ref domain = firstRef(entity, "domains", LineageLevelKind.DOMAIN, band);
    Ref dataProduct = firstRef(entity, "dataProducts", LineageLevelKind.DATA_PRODUCT, band);

    return new SceneAsset(
        self,
        service,
        database,
        schema,
        domain,
        dataProduct,
        fields(entity, self),
        count(entity),
        syntheticCount(entity));
  }

  private static Ref serviceRef(
      Map<String, Object> entity, String entityType, Ref self, LineageBand band) {
    if (SERVICE_ENTITY_TYPES.contains(entityType)) {
      return self.withKind(LineageLevelKind.SERVICE);
    }
    Ref service = refValue(entity, "service", LineageLevelKind.SERVICE, band);
    if (service != null) {
      return service.withServiceType(stringValue(entity, "serviceType"));
    }
    return null;
  }

  private static SceneAsset findFocusAsset(Collection<SceneAsset> assets, String focusFqn) {
    if (nullOrEmpty(focusFqn)) {
      return null;
    }
    for (SceneAsset asset : assets) {
      if (asset.hasFqn(focusFqn)) {
        return asset;
      }
    }
    return null;
  }

  private static SceneSelection buildSelection(
      Map<String, SceneAsset> assets,
      SearchLineageResult lineage,
      LineageLens lens,
      LineageBand band,
      Ref focusRef,
      int size) {
    Map<String, LineageSceneNode> nodes = new LinkedHashMap<>();
    Map<String, String> nodeIdsByFqn = new LinkedHashMap<>();
    Map<String, Set<String>> countedAssetIdsByNode = new LinkedHashMap<>();
    Map<String, Set<String>> syntheticCountKindsByNode = new LinkedHashMap<>();
    Map<String, RollupEdge> edgeByKey = new LinkedHashMap<>();
    List<EsLineageData> lineageEdges = allEdges(lineage);
    SelectionLevel selectionLevel = selectionLevel(assets.values(), lens, band, focusRef);
    boolean focusedContainerScene = isFocusedContainerScene(band, focusRef);
    boolean shouldSeedNodesFromAssets =
        lineageEdges.isEmpty() || focusedContainerScene || shouldSeedRootLayerNodes(band, focusRef);
    if (shouldSeedNodesFromAssets) {
      for (SceneAsset asset : assets.values()) {
        if (focusedContainerScene && !isContainedChild(asset, focusRef)) {
          continue;
        }
        Ref ref = selectRef(asset, lens, band, focusRef, selectionLevel);
        addNode(
            nodes,
            nodeIdsByFqn,
            countedAssetIdsByNode,
            syntheticCountKindsByNode,
            ref,
            asset,
            band,
            focusRef,
            false);
      }
    }
    for (EsLineageData edge : lineageEdges) {
      SceneAsset fromAsset = assetForRef(assets, edge.getFromEntity());
      SceneAsset toAsset = assetForRef(assets, edge.getToEntity());
      if (fromAsset == null || toAsset == null) {
        continue;
      }
      Ref fromRef = selectRef(fromAsset, lens, band, focusRef, selectionLevel);
      Ref toRef = selectRef(toAsset, lens, band, focusRef, selectionLevel);
      if (focusedContainerScene && isParentRollupEdge(focusRef, fromRef, toRef)) {
        continue;
      }
      if (fromRef == null || toRef == null || Objects.equals(fromRef.nodeId(), toRef.nodeId())) {
        continue;
      }
      addNode(
          nodes,
          nodeIdsByFqn,
          countedAssetIdsByNode,
          syntheticCountKindsByNode,
          fromRef,
          fromAsset,
          band,
          focusRef,
          isGhost(fromAsset, focusRef));
      addNode(
          nodes,
          nodeIdsByFqn,
          countedAssetIdsByNode,
          syntheticCountKindsByNode,
          toRef,
          toAsset,
          band,
          focusRef,
          isGhost(toAsset, focusRef));
      if (shouldExpandTemporaryLineage(edge, fromRef, toRef, fromAsset, toAsset, band)) {
        addTemporaryLineage(nodes, nodeIdsByFqn, edgeByKey, edge);
      } else {
        addEdges(edgeByKey, edge, fromRef, toRef, fromAsset, toAsset, band);
      }
    }
    if (nodes.isEmpty() && !assets.isEmpty()) {
      for (SceneAsset asset : assets.values()) {
        Ref ref = selectRef(asset, lens, band, focusRef, selectionLevel);
        addNode(
            nodes,
            nodeIdsByFqn,
            countedAssetIdsByNode,
            syntheticCountKindsByNode,
            ref,
            asset,
            band,
            focusRef,
            isGhost(asset, focusRef));
      }
    }

    int hiddenNodeCount = Math.max(0, nodes.size() - size);
    Set<String> visibleNodeIds = truncateNodes(nodes, edgeByKey, size);
    List<LineageSceneEdge> visibleEdges =
        edgeByKey.values().stream()
            .map(RollupEdge::toSceneEdge)
            .filter(edge -> visibleNodeIds.contains(nodeId(edge.getFrom())))
            .filter(edge -> visibleNodeIds.contains(nodeId(edge.getTo())))
            .toList();
    if (band == LineageBand.FIELD) {
      visibleEdges = limitFieldEdges(visibleEdges, size);
      trimFieldNodes(nodes.values(), visibleEdges);
    }
    return new SceneSelection(new ArrayList<>(nodes.values()), visibleEdges, hiddenNodeCount);
  }

  private static List<LineageSceneEdge> limitFieldEdges(List<LineageSceneEdge> edges, int size) {
    int edgeLimit = Math.max(1, Math.min(size, FIELD_EDGE_LIMIT));
    Map<String, Set<String>> selectedFieldsByNode = new LinkedHashMap<>();
    List<LineageSceneEdge> selectedEdges = new ArrayList<>();
    for (LineageSceneEdge edge : edges) {
      if (selectedEdges.size() >= edgeLimit) {
        break;
      }
      String fromNodeId = nodeId(edge.getFrom());
      String toNodeId = nodeId(edge.getTo());
      String fromFieldId = fieldHandle(edge.getFrom());
      String toFieldId = fieldHandle(edge.getTo());
      if (!canSelectFieldEndpoint(selectedFieldsByNode, fromNodeId, fromFieldId)
          || !canSelectFieldEndpoint(selectedFieldsByNode, toNodeId, toFieldId)) {
        continue;
      }
      selectFieldEndpoint(selectedFieldsByNode, fromNodeId, fromFieldId);
      selectFieldEndpoint(selectedFieldsByNode, toNodeId, toFieldId);
      selectedEdges.add(edge);
    }
    return selectedEdges;
  }

  private static boolean canSelectFieldEndpoint(
      Map<String, Set<String>> selectedFieldsByNode, String nodeId, String fieldId) {
    if (nullOrEmpty(fieldId)) {
      return true;
    }
    Set<String> selectedFields = selectedFieldsByNode.get(nodeId);
    return selectedFields == null
        || selectedFields.contains(fieldId)
        || selectedFields.size() < FIELD_ENDPOINTS_PER_NODE;
  }

  private static void selectFieldEndpoint(
      Map<String, Set<String>> selectedFieldsByNode, String nodeId, String fieldId) {
    if (nullOrEmpty(fieldId)) {
      return;
    }
    selectedFieldsByNode.computeIfAbsent(nodeId, ignored -> new LinkedHashSet<>()).add(fieldId);
  }

  private static void trimFieldNodes(
      Collection<LineageSceneNode> nodes, List<LineageSceneEdge> edges) {
    Map<String, Set<String>> selectedFieldsByNode = selectedFieldIdsByNode(edges);
    for (LineageSceneNode node : nodes) {
      List<LineageSceneField> originalFields =
          node.getFields() == null ? List.of() : node.getFields();
      if (originalFields.isEmpty()) {
        continue;
      }
      Set<String> selectedFields = selectedFieldsByNode.get(node.getId());
      List<LineageSceneField> visibleFields =
          nullOrEmpty(selectedFields)
              ? originalFields.stream().limit(FIELD_ENDPOINTS_PER_NODE).toList()
              : fieldSubset(originalFields, selectedFields);
      node.withFields(visibleFields)
          .withHiddenChildrenCount(Math.max(0, originalFields.size() - visibleFields.size()));
    }
  }

  private static Map<String, Set<String>> selectedFieldIdsByNode(List<LineageSceneEdge> edges) {
    Map<String, Set<String>> selectedFieldsByNode = new LinkedHashMap<>();
    for (LineageSceneEdge edge : edges) {
      selectFieldEndpoint(
          selectedFieldsByNode, nodeId(edge.getFrom()), fieldHandle(edge.getFrom()));
      selectFieldEndpoint(selectedFieldsByNode, nodeId(edge.getTo()), fieldHandle(edge.getTo()));
    }
    return selectedFieldsByNode;
  }

  private static List<LineageSceneField> fieldSubset(
      List<LineageSceneField> fields, Set<String> selectedFields) {
    Map<String, LineageSceneField> fieldsById = new LinkedHashMap<>();
    for (LineageSceneField field : fields) {
      fieldsById.put(field.getId(), field);
      if (!nullOrEmpty(field.getFullyQualifiedName())) {
        fieldsById.put(field.getFullyQualifiedName(), field);
      }
    }
    List<LineageSceneField> visibleFields = new ArrayList<>();
    for (String selectedField : selectedFields) {
      LineageSceneField field = fieldsById.get(selectedField);
      visibleFields.add(field == null ? syntheticField(selectedField) : field);
    }
    return visibleFields;
  }

  private static LineageSceneField syntheticField(String fieldId) {
    return new LineageSceneField()
        .withId(fieldId)
        .withName(lastFqnPart(fieldId))
        .withFullyQualifiedName(fieldId);
  }

  private static boolean isFocusedContainerScene(LineageBand band, Ref focusRef) {
    return band == LineageBand.ASSET && focusRef != null && !isAssetKind(focusRef.kind());
  }

  private static boolean shouldSeedRootLayerNodes(LineageBand band, Ref focusRef) {
    return band == LineageBand.LAYER && focusRef == null;
  }

  private static boolean isContainedChild(SceneAsset asset, Ref focusRef) {
    return asset.isDescendantOf(focusRef) && !Objects.equals(asset.self().fqn(), focusRef.fqn());
  }

  private static boolean isParentRollupEdge(Ref focusRef, Ref fromRef, Ref toRef) {
    return Objects.equals(fqn(fromRef), fqn(focusRef)) || Objects.equals(fqn(toRef), fqn(focusRef));
  }

  private static List<EsLineageData> allEdges(SearchLineageResult lineage) {
    List<EsLineageData> edges = new ArrayList<>();
    if (lineage == null) {
      return edges;
    }
    if (lineage.getUpstreamEdges() != null) {
      edges.addAll(lineage.getUpstreamEdges().values());
    }
    if (lineage.getDownstreamEdges() != null) {
      edges.addAll(lineage.getDownstreamEdges().values());
    }
    return edges;
  }

  private static SceneAsset assetForRef(
      Map<String, SceneAsset> assets, org.openmetadata.schema.api.lineage.RelationshipRef ref) {
    if (ref == null || nullOrEmpty(ref.getFullyQualifiedName())) {
      return null;
    }
    return assets.get(ref.getFullyQualifiedName());
  }

  private static Ref selectRef(
      SceneAsset asset,
      LineageLens lens,
      LineageBand band,
      Ref focusRef,
      SelectionLevel selectionLevel) {
    if (band == LineageBand.LAYER) {
      return lensRef(asset, lens).orElse(asset.self());
    }
    if (band == LineageBand.FIELD || focusRef == null || isAssetKind(focusRef.kind())) {
      return refForLevel(asset, selectionLevel.kind()).orElse(asset.self());
    }
    if (!asset.isDescendantOf(focusRef)) {
      return lensRef(asset, lens).orElse(asset.self());
    }
    if (focusRef.kind() == LineageLevelKind.DOMAIN
        || focusRef.kind() == LineageLevelKind.DATA_PRODUCT) {
      return asset.self();
    }
    return refForLevel(asset, selectionLevel.kind()).orElse(asset.self());
  }

  private static SelectionLevel selectionLevel(
      Collection<SceneAsset> assets, LineageLens lens, LineageBand band, Ref focusRef) {
    if (band == LineageBand.FIELD) {
      return new SelectionLevel(LineageLevelKind.ASSET);
    }
    if (band == LineageBand.LAYER) {
      return new SelectionLevel(lensKind(lens));
    }
    List<LineageLevelKind> candidates = descendantLevelCandidates(lens, focusRef);
    Collection<SceneAsset> scopedAssets =
        focusRef == null
            ? assets
            : assets.stream().filter(asset -> asset.isDescendantOf(focusRef)).toList();
    for (LineageLevelKind candidate : candidates) {
      Set<String> refs = new LinkedHashSet<>();
      for (SceneAsset asset : scopedAssets) {
        refForLevel(asset, candidate)
            .map(Ref::fqn)
            .filter(fqn -> !nullOrEmpty(fqn))
            .ifPresent(refs::add);
      }
      if (!refs.isEmpty()) {
        return new SelectionLevel(candidate);
      }
    }
    return new SelectionLevel(LineageLevelKind.ASSET);
  }

  private static List<LineageLevelKind> descendantLevelCandidates(LineageLens lens, Ref focusRef) {
    if (focusRef == null) {
      return switch (lens) {
        case SERVICE -> List.of(LineageLevelKind.DATABASE, LineageLevelKind.SCHEMA);
        case DOMAIN, DATA_PRODUCT -> List.of(LineageLevelKind.SERVICE);
      };
    }
    return switch (focusRef.kind()) {
      case SERVICE -> List.of(LineageLevelKind.DATABASE, LineageLevelKind.SCHEMA);
      case DATABASE -> List.of(LineageLevelKind.SCHEMA);
      case DOMAIN, DATA_PRODUCT -> List.of(LineageLevelKind.SERVICE);
      default -> List.of();
    };
  }

  private static Optional<Ref> refForLevel(SceneAsset asset, LineageLevelKind level) {
    return switch (level) {
      case SERVICE -> Optional.ofNullable(asset.service());
      case DATABASE -> Optional.ofNullable(asset.database());
      case SCHEMA -> Optional.ofNullable(asset.schema());
      case DOMAIN -> Optional.ofNullable(asset.domain());
      case DATA_PRODUCT -> Optional.ofNullable(asset.dataProduct());
      case ASSET -> Optional.of(asset.self());
      default -> Optional.empty();
    };
  }

  private static Optional<Ref> lensRef(SceneAsset asset, LineageLens lens) {
    return switch (lens) {
      case DOMAIN -> Optional.ofNullable(
          asset.self().kind() == LineageLevelKind.DOMAIN ? asset.self() : asset.domain());
      case DATA_PRODUCT -> Optional.ofNullable(
          asset.self().kind() == LineageLevelKind.DATA_PRODUCT
              ? asset.self()
              : asset.dataProduct());
      case SERVICE -> Optional.ofNullable(asset.service());
    };
  }

  private static boolean isAssetKind(LineageLevelKind kind) {
    return switch (kind) {
      case TABLE,
          TOPIC,
          DASHBOARD,
          DASHBOARD_DATA_MODEL,
          MODEL,
          PIPELINE,
          STORED_PROCEDURE,
          CONTAINER,
          SEARCH_INDEX,
          API_ENDPOINT,
          METRIC,
          DIRECTORY,
          FILE,
          SPREADSHEET,
          WORKSHEET,
          ASSET -> true;
      default -> false;
    };
  }

  @SafeVarargs
  private static <T> T firstNonNull(T... values) {
    for (T value : values) {
      if (value != null) {
        return value;
      }
    }
    return null;
  }

  private static boolean isGhost(SceneAsset asset, Ref focusRef) {
    return focusRef != null
        && !asset.isDescendantOf(focusRef)
        && !Objects.equals(asset.self().fqn(), focusRef.fqn());
  }

  private static void addNode(
      Map<String, LineageSceneNode> nodes,
      Map<String, String> nodeIdsByFqn,
      Map<String, Set<String>> countedAssetIdsByNode,
      Map<String, Set<String>> syntheticCountKindsByNode,
      Ref ref,
      SceneAsset asset,
      LineageBand band,
      Ref focusRef,
      boolean isGhost) {
    if (ref == null) {
      return;
    }
    LineageSceneNode node =
        nodes.computeIfAbsent(
            ref.nodeId(),
            ignored ->
                new LineageSceneNode()
                    .withId(ref.nodeId())
                    .withFullyQualifiedName(ref.fqn())
                    .withEntityType(ref.entityType())
                    .withLevelKind(ref.kind())
                    .withBand(nodeBand(ref.kind(), band))
                    .withServiceType(firstNonBlank(ref.serviceType(), asset.serviceType()))
                    .withLabel(ref.label())
                    .withDisplayName(stringValue(ref.sourceEntity(), "displayName"))
                    .withParentId(parentId(ref, asset))
                    .withParentFqn(parentFqn(ref, asset))
                    .withChildrenCount(0)
                    .withCounts(new LinkedHashMap<>())
                    .withFields(band == LineageBand.FIELD ? asset.fields() : List.of())
                    .withIsFocus(focusRef != null && Objects.equals(ref.fqn(), focusRef.fqn()))
                    .withIsOrigin(
                        focusRef != null && Objects.equals(asset.self().fqn(), focusRef.fqn()))
                    .withIsExpandable(isExpandable(ref, asset))
                    .withIsGhost(isGhost)
                    .withCertification(certification(asset.self().sourceEntity()))
                    .withSourceEntity(ref.sourceEntity()));
    if (!nullOrEmpty(node.getFullyQualifiedName())) {
      nodeIdsByFqn.putIfAbsent(node.getFullyQualifiedName(), node.getId());
    }
    mergeNodeCounts(node, countedAssetIdsByNode, syntheticCountKindsByNode, ref, asset);
  }

  private static void mergeNodeCounts(
      LineageSceneNode node,
      Map<String, Set<String>> countedAssetIdsByNode,
      Map<String, Set<String>> syntheticCountKindsByNode,
      Ref ref,
      SceneAsset asset) {
    Set<String> countedAssetIds =
        countedAssetIdsByNode.computeIfAbsent(node.getId(), ignored -> new LinkedHashSet<>());
    if (!countedAssetIds.add(asset.self().nodeId())) {
      return;
    }

    Map<String, Integer> mergedCounts = new LinkedHashMap<>();
    if (node.getCounts() != null) {
      mergedCounts.putAll(node.getCounts());
    }
    Set<String> syntheticKinds =
        syntheticCountKindsByNode.computeIfAbsent(node.getId(), ignored -> new LinkedHashSet<>());
    counts(ref, asset)
        .forEach(
            (kind, count) -> {
              if (asset.syntheticCount()) {
                syntheticKinds.add(kind);
              }
              if (asset.syntheticCount() || syntheticKinds.contains(kind)) {
                mergedCounts.merge(kind, count, Math::max);
              } else {
                mergedCounts.merge(kind, count, Integer::sum);
              }
            });
    node.withCounts(mergedCounts)
        .withChildrenCount(mergedCounts.values().stream().mapToInt(Integer::intValue).sum());
  }

  private static LineageBand nodeBand(LineageLevelKind kind, LineageBand sceneBand) {
    if (sceneBand == LineageBand.LAYER
        || kind == LineageLevelKind.SERVICE
        || kind == LineageLevelKind.DOMAIN
        || kind == LineageLevelKind.DATA_PRODUCT) {
      return LineageBand.LAYER;
    }
    if (kind == LineageLevelKind.COLUMN
        || kind == LineageLevelKind.FIELD
        || kind == LineageLevelKind.CHART
        || kind == LineageLevelKind.FEATURE
        || kind == LineageLevelKind.TASK) {
      return LineageBand.FIELD;
    }
    return LineageBand.ASSET;
  }

  private static String parentId(Ref ref, SceneAsset asset) {
    Ref parent = parentRef(ref, asset);
    return parent == null ? null : parent.nodeId();
  }

  private static String parentFqn(Ref ref, SceneAsset asset) {
    Ref parent = parentRef(ref, asset);
    return parent == null ? null : parent.fqn();
  }

  private static Ref parentRef(Ref ref, SceneAsset asset) {
    if (Objects.equals(ref.fqn(), asset.self().fqn())) {
      return firstNonNull(
          asset.schema(), asset.database(), asset.service(), asset.domain(), asset.dataProduct());
    }
    if (Objects.equals(ref.fqn(), fqn(asset.schema()))) {
      return firstNonNull(asset.database(), asset.service());
    }
    if (Objects.equals(ref.fqn(), fqn(asset.database()))) {
      return asset.service();
    }
    return null;
  }

  private static String fqn(Ref ref) {
    return ref == null ? null : ref.fqn();
  }

  private static Map<String, Integer> counts(Ref ref, SceneAsset asset) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    if (Objects.equals(ref.fqn(), asset.self().fqn()) && !asset.fields().isEmpty()) {
      counts.put(fieldKind(asset.self().kind()).value(), asset.fields().size());
    }
    if (!Objects.equals(ref.fqn(), asset.self().fqn())) {
      counts.put(asset.self().kind().value(), asset.count());
    }
    return counts;
  }

  private static LineageLevelKind fieldKind(LineageLevelKind kind) {
    return switch (kind) {
      case TOPIC, SEARCH_INDEX, API_ENDPOINT -> LineageLevelKind.FIELD;
      case DASHBOARD -> LineageLevelKind.CHART;
      case MODEL -> LineageLevelKind.FEATURE;
      case PIPELINE -> LineageLevelKind.TASK;
      default -> LineageLevelKind.COLUMN;
    };
  }

  private static boolean isExpandable(Ref ref, SceneAsset asset) {
    if (Objects.equals(ref.fqn(), asset.self().fqn())) {
      return isContainerKind(ref.kind()) || !asset.fields().isEmpty();
    }
    return isContainerKind(ref.kind()) || asset.isDescendantOf(ref);
  }

  private static boolean isContainerKind(LineageLevelKind kind) {
    return switch (kind) {
      case SERVICE, DATABASE, SCHEMA, DOMAIN, DATA_PRODUCT -> true;
      default -> false;
    };
  }

  private static String certification(Map<String, Object> entity) {
    Object certification = entity == null ? null : entity.get("certification");
    if (certification instanceof Map<?, ?> map) {
      return stringValue(map, "tagLabel");
    }
    return null;
  }

  private static void addEdges(
      Map<String, RollupEdge> edgeByKey,
      EsLineageData edge,
      Ref fromRef,
      Ref toRef,
      SceneAsset fromAsset,
      SceneAsset toAsset,
      LineageBand band) {
    if (band == LineageBand.FIELD && !nullOrEmpty(edge.getColumns())) {
      for (ColumnLineage column : edge.getColumns()) {
        String toColumn = column.getToColumn();
        if (nullOrEmpty(toColumn) || nullOrEmpty(column.getFromColumns())) {
          continue;
        }
        for (String fromColumn : column.getFromColumns()) {
          if (nullOrEmpty(fromColumn)) {
            continue;
          }
          String from = fieldId(fromRef.nodeId(), fieldEndpoint(fromAsset, fromColumn));
          String to = fieldId(toRef.nodeId(), fieldEndpoint(toAsset, toColumn));
          addRollup(edgeByKey, edge, from, to, LineageBand.FIELD, false);
        }
      }
      return;
    }
    boolean rollup =
        band == LineageBand.LAYER
            || !Objects.equals(fromRef.nodeId(), fromAsset.self().nodeId())
            || !Objects.equals(toRef.nodeId(), toAsset.self().nodeId());
    addRollup(edgeByKey, edge, fromRef.nodeId(), toRef.nodeId(), band, rollup);
  }

  private static boolean shouldExpandTemporaryLineage(
      EsLineageData edge,
      Ref fromRef,
      Ref toRef,
      SceneAsset fromAsset,
      SceneAsset toAsset,
      LineageBand band) {
    return band == LineageBand.ASSET
        && Objects.equals(fromRef.nodeId(), fromAsset.self().nodeId())
        && Objects.equals(toRef.nodeId(), toAsset.self().nodeId())
        && edge.getTempLineageTables() != null
        && edge.getTempLineageTables().stream()
            .anyMatch(
                hop ->
                    hop != null
                        && !nullOrEmpty(hop.getFromEntity())
                        && !nullOrEmpty(hop.getToEntity()));
  }

  private static void addTemporaryLineage(
      Map<String, LineageSceneNode> nodes,
      Map<String, String> nodeIdsByFqn,
      Map<String, RollupEdge> edgeByKey,
      EsLineageData edge) {
    for (TempLineageTable hop : edge.getTempLineageTables()) {
      if (hop == null || nullOrEmpty(hop.getFromEntity()) || nullOrEmpty(hop.getToEntity())) {
        continue;
      }
      String from = temporaryLineageNodeId(nodes, nodeIdsByFqn, hop.getFromEntity());
      String to = temporaryLineageNodeId(nodes, nodeIdsByFqn, hop.getToEntity());
      addRollup(edgeByKey, edge, from, to, LineageBand.ASSET, false);
    }
  }

  private static String temporaryLineageNodeId(
      Map<String, LineageSceneNode> nodes,
      Map<String, String> nodeIdsByFqn,
      String fullyQualifiedName) {
    String existingNodeId = nodeIdsByFqn.get(fullyQualifiedName);
    if (existingNodeId != null) {
      return existingNodeId;
    }

    String nodeId = "temp_" + fullyQualifiedName;
    Map<String, Object> sourceEntity = new LinkedHashMap<>();
    sourceEntity.put("name", fullyQualifiedName);
    sourceEntity.put("displayName", fullyQualifiedName);
    sourceEntity.put("fullyQualifiedName", fullyQualifiedName);
    sourceEntity.put("type", Entity.TABLE);
    sourceEntity.put("entityType", Entity.TABLE);
    sourceEntity.put("isTempTable", true);
    sourceEntity.put("columns", List.of());
    nodes.computeIfAbsent(
        nodeId,
        ignored ->
            new LineageSceneNode()
                .withId(nodeId)
                .withFullyQualifiedName(fullyQualifiedName)
                .withEntityType(Entity.TABLE)
                .withLevelKind(LineageLevelKind.TABLE)
                .withBand(LineageBand.ASSET)
                .withLabel(fullyQualifiedName)
                .withDisplayName(fullyQualifiedName)
                .withChildrenCount(0)
                .withCounts(new LinkedHashMap<>())
                .withFields(List.of())
                .withIsFocus(false)
                .withIsOrigin(false)
                .withIsExpandable(false)
                .withIsGhost(false)
                .withSourceEntity(sourceEntity));
    nodeIdsByFqn.put(fullyQualifiedName, nodeId);
    return nodeId;
  }

  private static void addRollup(
      Map<String, RollupEdge> edgeByKey,
      EsLineageData edge,
      String from,
      String to,
      LineageBand band,
      boolean rollup) {
    if (Objects.equals(from, to)) {
      return;
    }
    String key = from + "->" + to + ":" + band.value();
    edgeByKey.computeIfAbsent(key, ignored -> new RollupEdge(from, to, band, rollup)).add(edge);
  }

  private static String fieldId(String nodeId, String field) {
    return nodeId + FIELD_SEPARATOR + field;
  }

  private static String fieldEndpoint(SceneAsset asset, String column) {
    for (LineageSceneField field : asset.fields()) {
      if (Objects.equals(field.getId(), column)
          || Objects.equals(field.getFullyQualifiedName(), column)) {
        return field.getId();
      }
    }
    for (LineageSceneField field : asset.fields()) {
      if (Objects.equals(field.getName(), column)) {
        return field.getId();
      }
    }
    String columnName = lastFqnPart(column);
    for (LineageSceneField field : asset.fields()) {
      if (Objects.equals(field.getName(), columnName)) {
        return field.getId();
      }
    }
    return column;
  }

  private static String nodeId(String edgeEndpoint) {
    int index = edgeEndpoint.indexOf(FIELD_SEPARATOR);
    return index < 0 ? edgeEndpoint : edgeEndpoint.substring(0, index);
  }

  private static String fieldHandle(String edgeEndpoint) {
    int index = edgeEndpoint.indexOf(FIELD_SEPARATOR);
    return index < 0 ? null : edgeEndpoint.substring(index + FIELD_SEPARATOR.length());
  }

  private static Set<String> truncateNodes(
      Map<String, LineageSceneNode> nodes, Map<String, RollupEdge> edgeByKey, int size) {
    if (size <= 0 || nodes.size() <= size) {
      return new LinkedHashSet<>(nodes.keySet());
    }
    Map<String, Integer> degreeByNode = new LinkedHashMap<>();
    for (RollupEdge edge : edgeByKey.values()) {
      degreeByNode.merge(nodeId(edge.from), 1, Integer::sum);
      degreeByNode.merge(nodeId(edge.to), 1, Integer::sum);
    }
    Set<String> keep = new LinkedHashSet<>();
    for (LineageSceneNode node : nodes.values()) {
      if (Boolean.TRUE.equals(node.getIsFocus()) || Boolean.TRUE.equals(node.getIsOrigin())) {
        keep.add(node.getId());
      }
    }
    List<LineageSceneNode> rankedNodes =
        nodes.values().stream()
            .filter(node -> !keep.contains(node.getId()))
            .sorted(
                Comparator.comparingInt(
                        (LineageSceneNode node) ->
                            node.getChildrenCount() == null ? 0 : node.getChildrenCount())
                    .reversed()
                    .thenComparing(
                        Comparator.comparingInt(
                                (LineageSceneNode node) ->
                                    degreeByNode.getOrDefault(node.getId(), 0))
                            .reversed()))
            .toList();
    for (LineageSceneNode node : rankedNodes) {
      if (keep.size() >= size) {
        break;
      }
      keep.add(node.getId());
    }
    nodes.keySet().removeIf(id -> !keep.contains(id));
    return keep;
  }

  private static List<LineageSceneBreadcrumb> buildBreadcrumb(
      LineageLens lens, LineageBand band, SceneAsset focusAsset, Ref focusRef) {
    List<LineageSceneBreadcrumb> breadcrumb = new ArrayList<>();
    breadcrumb.add(
        new LineageSceneBreadcrumb()
            .withId("lens:" + lens.value())
            .withLabel(lens.value())
            .withLevelKind(lensKind(lens))
            .withBand(LineageBand.LAYER));
    if (focusAsset == null) {
      return breadcrumb;
    }
    List<Ref> refs =
        switch (lens) {
          case DOMAIN -> nullableList(focusAsset.domain(), focusAsset.self());
          case DATA_PRODUCT -> nullableList(focusAsset.dataProduct(), focusAsset.self());
          case SERVICE -> nullableList(
              focusAsset.service(), focusAsset.database(), focusAsset.schema(), focusAsset.self());
        };
    Set<String> seen = new LinkedHashSet<>();
    for (Ref ref : refs) {
      if (ref == null || nullOrEmpty(ref.fqn()) || !seen.add(ref.fqn())) {
        continue;
      }
      breadcrumb.add(
          new LineageSceneBreadcrumb()
              .withId(ref.nodeId())
              .withLabel(ref.label())
              .withFullyQualifiedName(ref.fqn())
              .withEntityType(ref.entityType())
              .withLevelKind(ref.kind())
              .withBand(nodeBand(ref.kind(), band)));
      if (focusRef != null && Objects.equals(ref.fqn(), focusRef.fqn())) {
        break;
      }
    }
    return breadcrumb;
  }

  private static List<Ref> nullableList(Ref... refs) {
    List<Ref> values = new ArrayList<>();
    for (Ref ref : refs) {
      values.add(ref);
    }
    return values;
  }

  private static LineageLevelKind lensKind(LineageLens lens) {
    return switch (lens) {
      case DOMAIN -> LineageLevelKind.DOMAIN;
      case DATA_PRODUCT -> LineageLevelKind.DATA_PRODUCT;
      case SERVICE -> LineageLevelKind.SERVICE;
    };
  }

  private static LineageLevelKind levelKind(String entityType) {
    if (entityType == null) {
      return LineageLevelKind.ASSET;
    }
    if (SERVICE_ENTITY_TYPES.contains(entityType)) {
      return LineageLevelKind.SERVICE;
    }
    return switch (entityType) {
      case Entity.DATABASE -> LineageLevelKind.DATABASE;
      case Entity.DATABASE_SCHEMA -> LineageLevelKind.SCHEMA;
      case Entity.TABLE -> LineageLevelKind.TABLE;
      case Entity.TOPIC -> LineageLevelKind.TOPIC;
      case Entity.DASHBOARD -> LineageLevelKind.DASHBOARD;
      case Entity.DASHBOARD_DATA_MODEL -> LineageLevelKind.DASHBOARD_DATA_MODEL;
      case Entity.CHART -> LineageLevelKind.CHART;
      case Entity.MLMODEL -> LineageLevelKind.MODEL;
      case Entity.PIPELINE -> LineageLevelKind.PIPELINE;
      case Entity.STORED_PROCEDURE -> LineageLevelKind.STORED_PROCEDURE;
      case Entity.DOMAIN -> LineageLevelKind.DOMAIN;
      case Entity.DATA_PRODUCT -> LineageLevelKind.DATA_PRODUCT;
      case Entity.CONTAINER -> LineageLevelKind.CONTAINER;
      case Entity.SEARCH_INDEX -> LineageLevelKind.SEARCH_INDEX;
      case Entity.API_ENDPOINT -> LineageLevelKind.API_ENDPOINT;
      case Entity.METRIC -> LineageLevelKind.METRIC;
      case Entity.DIRECTORY -> LineageLevelKind.DIRECTORY;
      case Entity.FILE -> LineageLevelKind.FILE;
      case Entity.SPREADSHEET -> LineageLevelKind.SPREADSHEET;
      case Entity.WORKSHEET -> LineageLevelKind.WORKSHEET;
      default -> LineageLevelKind.ASSET;
    };
  }

  private static List<LineageSceneField> fields(Map<String, Object> entity, Ref self) {
    List<LineageSceneField> fields = new ArrayList<>();
    addFields(fields, listValue(entity, "columns"));
    addFields(fields, nestedList(entity, "dataModel", "columns"));
    addFields(fields, listValue(entity, "charts"));
    addFields(fields, listValue(entity, "mlFeatures"));
    addFields(fields, listValue(entity, "fields"));
    addFields(fields, nestedList(entity, "messageSchema", "schemaFields"));
    addFields(fields, nestedList(entity, "requestSchema", "schemaFields"));
    addFields(fields, nestedList(entity, "responseSchema", "schemaFields"));
    return fields.stream()
        .collect(
            LinkedHashMap<String, LineageSceneField>::new,
            (map, field) -> map.putIfAbsent(field.getId(), field),
            LinkedHashMap::putAll)
        .values()
        .stream()
        .map(field -> ensureFieldFqn(self, field))
        .toList();
  }

  private static LineageSceneField ensureFieldFqn(Ref self, LineageSceneField field) {
    String fqn = field.getFullyQualifiedName();
    if (!nullOrEmpty(fqn)) {
      return field;
    }
    String syntheticFqn = self.fqn() + "." + field.getName();
    return field.withId(syntheticFqn).withFullyQualifiedName(syntheticFqn);
  }

  private static void addFields(List<LineageSceneField> target, List<Map<String, Object>> fields) {
    for (Map<String, Object> field : fields) {
      String name = label(field);
      if (nullOrEmpty(name)) {
        continue;
      }
      String fqn = stringValue(field, "fullyQualifiedName");
      target.add(
          new LineageSceneField()
              .withId(firstNonBlank(fqn, name))
              .withName(name)
              .withFullyQualifiedName(fqn)
              .withDataType(
                  firstNonBlank(
                      stringValue(field, "dataTypeDisplay"), stringValue(field, "dataType"))));
    }
  }

  private static List<Map<String, Object>> nestedList(
      Map<String, Object> entity, String objectKey, String listKey) {
    Map<String, Object> object = mapValue(entity.get(objectKey));
    return object == null ? List.of() : listValue(object, listKey);
  }

  private static Ref refValue(Map<String, Object> entity, String key, LineageLevelKind kind) {
    return refValue(entity, key, kind, LineageBand.ASSET);
  }

  private static Ref refValue(
      Map<String, Object> entity, String key, LineageLevelKind kind, LineageBand band) {
    Map<String, Object> ref = mapValue(entity.get(key));
    return ref == null ? null : refFromMap(ref, kind, stringValue(entity, "serviceType"), band);
  }

  private static Ref firstRef(Map<String, Object> entity, String key, LineageLevelKind kind) {
    return firstRef(entity, key, kind, LineageBand.ASSET);
  }

  private static Ref firstRef(
      Map<String, Object> entity, String key, LineageLevelKind kind, LineageBand band) {
    List<Map<String, Object>> refs = listValue(entity, key);
    return refs.isEmpty()
        ? null
        : refFromMap(refs.get(0), kind, stringValue(entity, "serviceType"), band);
  }

  private static Ref refFromMap(
      Map<String, Object> ref, LineageLevelKind kind, String serviceType) {
    return refFromMap(ref, kind, serviceType, LineageBand.ASSET);
  }

  private static Ref refFromMap(
      Map<String, Object> ref, LineageLevelKind kind, String serviceType, LineageBand band) {
    String entityType = stringValue(ref, "type");
    if (nullOrEmpty(entityType)) {
      entityType = stringValue(ref, "entityType");
    }
    return new Ref(
        stringValue(ref, "id"),
        stringValue(ref, "fullyQualifiedName"),
        entityType,
        label(ref),
        kind,
        serviceType,
        trimSourceEntity(ref, band));
  }

  static Map<String, Object> trimSourceEntity(Map<String, Object> entity, LineageBand band) {
    Set<String> allowedFields = new LinkedHashSet<>(sourceFieldList(band));
    allowedFields.add("type");
    allowedFields.add("lineageSceneCount");
    allowedFields.add("lineageSceneSyntheticCount");
    Map<String, Object> trimmed = new LinkedHashMap<>();
    for (String field : allowedFields) {
      if (entity.containsKey(field)) {
        trimmed.put(field, entity.get(field));
      }
    }
    return trimmed;
  }

  private static List<Map<String, Object>> listValue(Map<String, Object> entity, String key) {
    Object value = entity.get(key);
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    List<Map<String, Object>> values = new ArrayList<>();
    for (Object item : list) {
      Map<String, Object> map = mapValue(item);
      if (map != null) {
        values.add(map);
      }
    }
    return values;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> mapValue(Object value) {
    return value instanceof Map<?, ?> map ? (Map<String, Object>) map : null;
  }

  private static EntityReference entityReferenceValue(Object value) {
    if (value instanceof EntityReference entityReference) {
      return entityReference;
    }
    try {
      Map<String, Object> source =
          JsonUtils.convertValue(value, new TypeReference<Map<String, Object>>() {});
      Map<String, Object> reference = new LinkedHashMap<>();
      for (String field : ENTITY_REFERENCE_FIELDS) {
        if (source.containsKey(field)) {
          reference.put(field, source.get(field));
        }
      }
      return JsonUtils.convertValue(reference, EntityReference.class);
    } catch (IllegalArgumentException exception) {
      LOG.warn("Unable to parse lineage pipeline reference: {}", exception.getMessage());
      return null;
    }
  }

  private static String stringValue(Map<?, ?> map, String key) {
    if (map == null) {
      return null;
    }
    Object value = map.get(key);
    return value == null ? null : String.valueOf(value);
  }

  private static int count(Map<String, Object> entity) {
    Object count = entity.get("lineageSceneCount");
    if (count instanceof Number number) {
      return Math.max(0, number.intValue());
    }
    if (count instanceof String value) {
      try {
        return Math.max(0, Integer.parseInt(value));
      } catch (NumberFormatException ignored) {
        return 1;
      }
    }
    return 1;
  }

  private static boolean syntheticCount(Map<String, Object> entity) {
    Object synthetic = entity.get("lineageSceneSyntheticCount");
    return Boolean.TRUE.equals(synthetic) || "true".equalsIgnoreCase(String.valueOf(synthetic));
  }

  private static String label(Map<String, Object> entity) {
    return firstNonBlank(
        stringValue(entity, "displayName"),
        stringValue(entity, "name"),
        lastFqnPart(stringValue(entity, "fullyQualifiedName")));
  }

  private static String lastFqnPart(String fqn) {
    if (nullOrEmpty(fqn)) {
      return null;
    }
    int index = fqn.lastIndexOf('.');
    return index < 0 ? fqn : fqn.substring(index + 1);
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (!nullOrEmpty(value)) {
        return value;
      }
    }
    return null;
  }

  private record Ref(
      String id,
      String fqn,
      String entityType,
      String label,
      LineageLevelKind kind,
      String serviceType,
      Map<String, Object> sourceEntity) {
    String nodeId() {
      String raw = firstNonBlank(id, fqn, label);
      return kind.value() + ":" + raw;
    }

    Ref withKind(LineageLevelKind nextKind) {
      return new Ref(id, fqn, entityType, label, nextKind, serviceType, sourceEntity);
    }

    Ref withServiceType(String nextServiceType) {
      return new Ref(id, fqn, entityType, label, kind, nextServiceType, sourceEntity);
    }
  }

  private record LineageSeed(String fqn, String entityType) {}

  private record FocusedAssetsResult(List<LineageSeed> seeds, boolean sampled) {}

  private record SearchRootAssetsResult(List<Map<String, Object>> assets, int total) {}

  record RootAssetCounts(Map<String, Map<String, Integer>> counts, boolean truncated) {}

  @FunctionalInterface
  interface IOTask<T> {
    T call() throws IOException;
  }

  private record SceneAsset(
      Ref self,
      Ref service,
      Ref database,
      Ref schema,
      Ref domain,
      Ref dataProduct,
      List<LineageSceneField> fields,
      int count,
      boolean syntheticCount) {
    boolean hasFqn(String fqn) {
      return Objects.equals(fqn, fqn(self))
          || Objects.equals(fqn, fqn(service))
          || Objects.equals(fqn, fqn(database))
          || Objects.equals(fqn, fqn(schema))
          || Objects.equals(fqn, fqn(domain))
          || Objects.equals(fqn, fqn(dataProduct));
    }

    boolean isDescendantOf(Ref ref) {
      return ref != null && hasFqn(ref.fqn());
    }

    String serviceType() {
      return firstNonBlank(self.serviceType(), service == null ? null : service.serviceType());
    }

    Ref refForFqn(String fqn) {
      for (Ref ref : nullableList(service, database, schema, domain, dataProduct, self)) {
        if (ref != null && Objects.equals(fqn, ref.fqn())) {
          return ref;
        }
      }
      return null;
    }
  }

  private record SceneSelection(
      List<LineageSceneNode> nodes, List<LineageSceneEdge> edges, int hiddenNodeCount) {}

  private record SelectionLevel(LineageLevelKind kind) {}

  private static class RollupEdge {
    private final String from;
    private final String to;
    private final LineageBand band;
    private final boolean rollup;
    private final List<String> underlyingEdgeIds = new ArrayList<>();
    private final Set<String> seenEdgeIdentities = new LinkedHashSet<>();
    private String source;
    private String sqlQuery;
    private String description;
    private EntityReference pipeline;

    private RollupEdge(String from, String to, LineageBand band, boolean rollup) {
      this.from = from;
      this.to = to;
      this.band = band;
      this.rollup = rollup;
    }

    private void add(EsLineageData edge) {
      if (seenEdgeIdentities.add(concreteEdgeIdentity(edge))) {
        underlyingEdgeIds.add(
            firstNonBlank(edge.getDocUniqueId(), edge.getDocId(), edge.toString()));
        source = firstNonBlank(source, edge.getSource());
        sqlQuery = firstNonBlank(sqlQuery, edge.getSqlQuery());
        description = firstNonBlank(description, edge.getDescription());
        if (pipeline == null && edge.getPipeline() != null) {
          pipeline = entityReferenceValue(edge.getPipeline());
        }
      }
    }

    private static String concreteEdgeIdentity(EsLineageData edge) {
      String fromFqn =
          edge.getFromEntity() == null ? null : edge.getFromEntity().getFullyQualifiedName();
      String toFqn = edge.getToEntity() == null ? null : edge.getToEntity().getFullyQualifiedName();
      return firstNonBlank(fromFqn, "") + "->" + firstNonBlank(toFqn, "");
    }

    private LineageSceneEdge toSceneEdge() {
      int weight = Math.max(1, underlyingEdgeIds.size());
      return new LineageSceneEdge()
          .withId("scene-edge:" + from + "->" + to + ":" + band.value())
          .withFrom(from)
          .withTo(to)
          .withBand(band)
          .withIsRollup(rollup || weight > 1)
          .withWeight(weight)
          .withLabel(weight > 1 ? String.valueOf(weight) : null)
          .withSource(source)
          .withSqlQuery(sqlQuery)
          .withDescription(weight == 1 ? description : null)
          .withPipeline(weight == 1 ? pipeline : null)
          .withUnderlyingEdgeIds(underlyingEdgeIds);
    }
  }
}
