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
import static org.openmetadata.service.lineage.LineageSceneCounts.syntheticCountEntity;
import static org.openmetadata.service.lineage.LineageSceneCounts.syntheticCountFqn;
import static org.openmetadata.service.lineage.LineageSceneEdges.allEdges;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.lensRef;
import static org.openmetadata.service.lineage.LineageSceneMapper.SERVICE_ENTITY_TYPES;
import static org.openmetadata.service.lineage.LineageSceneMapper.listValue;
import static org.openmetadata.service.lineage.LineageSceneMapper.mapValue;
import static org.openmetadata.service.lineage.LineageSceneMapper.sourceFieldsForBand;
import static org.openmetadata.service.lineage.LineageSceneMapper.stringValue;
import static org.openmetadata.service.lineage.LineageSceneMapper.toAsset;
import static org.openmetadata.service.lineage.LineageSceneQuery.rootLineageParticipantQuery;
import static org.openmetadata.service.lineage.LineageSceneSearch.DATABASE_FQN_KEYWORD_FIELD;
import static org.openmetadata.service.lineage.LineageSceneSearch.ENTITY_FQN_FIELD;
import static org.openmetadata.service.lineage.LineageSceneSearch.ROOT_ASSET_ENTITY_TYPES;
import static org.openmetadata.service.lineage.LineageSceneSearch.UPSTREAM_LINEAGE_DOC_ID_FIELD;
import static org.openmetadata.service.lineage.LineageSceneSearch.focusedAssetFieldName;
import static org.openmetadata.service.lineage.LineageSceneSearch.logDatabaseReindexRequired;
import static org.openmetadata.service.lineage.LineageSceneSearch.normalizedKey;
import static org.openmetadata.service.lineage.LineageSceneSearch.rootAssetFieldName;
import static org.openmetadata.service.lineage.LineageSceneTasks.bestEffortTask;
import static org.openmetadata.service.lineage.LineageSceneTasks.runBounded;
import static org.openmetadata.service.search.SearchClient.DATA_ASSET_SEARCH_ALIAS;
import static org.openmetadata.service.search.SearchUtils.getRequiredLineageFields;
import static org.openmetadata.service.search.SearchUtils.isConnectedVia;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.lineage.LineageSceneCounts.RootAssetCounts;
import org.openmetadata.service.lineage.LineageSceneMapper.Ref;
import org.openmetadata.service.lineage.LineageSceneMapper.SceneAsset;
import org.openmetadata.service.lineage.LineageSceneSearch.SearchRootAssetsResult;
import org.openmetadata.service.lineage.LineageSceneTasks.IOTask;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
final class LineageSceneLoader {
  private final SearchRepository repository;
  private final LineageSceneRequest request;
  private final LineageSceneSearch search;
  private final LineageSceneCounts counts;

  LineageSceneLoader(SearchRepository repository, LineageSceneRequest request) {
    this.repository = repository;
    this.request = request;
    this.search = new LineageSceneSearch(repository, request);
    this.counts = new LineageSceneCounts(repository, request, search);
  }

  private static final int ROOT_ASSET_PAGE_SIZE = 25;

  private static final int FOCUSED_CHILD_LINEAGE_LOOKUP_LIMIT = 50;

  private static final int FOCUSED_CHILD_LINEAGE_PARALLELISM = 6;

  private static final int FOCUSED_CHILD_LINEAGE_SIZE = 25;

  private static final int ROOT_LINEAGE_HYDRATION_BATCH_SIZE = 1000;

  static SearchLineageResult emptyLineage() {
    return new SearchLineageResult()
        .withNodes(new LinkedHashMap<>())
        .withUpstreamEdges(new LinkedHashMap<>())
        .withDownstreamEdges(new LinkedHashMap<>());
  }

  LoadedScene load() throws IOException {
    SearchLineageResult lineage = shouldLoadFocusedChildrenOnly() ? emptyLineage() : fetchLineage();
    boolean sampled = false;
    if (!request.hasFocus()) {
      sampled = enrichRootSceneAssets(lineage);
    } else if (request.band() != LineageBand.LAYER) {
      FocusedAssetsResult focused = enrichFocusedSceneAssets(lineage);
      sampled = focused.sampled();
      counts.enrichFocusedContainerTotals(lineage);
      sampled |= enrichFocusedChildLineage(lineage, focused.seeds());
    }
    return new LoadedScene(lineage, sampled);
  }

  private boolean shouldLoadFocusedChildrenOnly() {
    return request.hasFocus()
        && request.band() == LineageBand.ASSET
        && !nullOrEmpty(focusedAssetFieldName(request.entityType()));
  }

  SearchLineageResult fetchLineage() throws IOException {
    if (!request.hasFocus()) {
      if (request.requiresEntityAuthorization()) {
        SearchLineageResult lineage =
            repository.searchPlatformLineage(
                DATA_ASSET_SEARCH_ALIAS,
                rootLineageParticipantQuery(request),
                request.includeDeleted(),
                request.subjectContext());
        hydrateMissingRootLineageAssets(lineage);
        return lineage;
      }
      return repository.searchPlatformLineage(
          request.lens().value(),
          request.queryFilterJson(),
          request.includeDeleted(),
          request.subjectContext());
    }
    return fetchFocusedLineage(request.focusFqn(), request.entityType(), request.size());
  }

  private SearchLineageResult fetchFocusedLineage(String focusFqn, String entityType, int size)
      throws IOException {
    return repository.searchLineage(
        new SearchLineageRequest()
            .withFqn(focusFqn)
            .withUpstreamDepth(request.upstreamDepth())
            .withDownstreamDepth(request.downstreamDepth())
            .withQueryFilter(request.queryFilterJson())
            .withPreservePaths(true)
            .withIncludeDeleted(request.includeDeleted())
            .withLayerSize(size)
            .withIsConnectedVia(isConnectedVia(entityType))
            .withIncludeSourceFields(getRequiredLineageFields(sourceFieldsForBand(request.band()))),
        request.subjectContext());
  }

  boolean enrichRootSceneAssets(SearchLineageResult lineage) throws IOException {
    if (lineage == null || lineage.getNodes() == null || lineage.getNodes().isEmpty()) {
      return false;
    }
    List<Ref> roots = rootRefs(lineage, request.lens());
    if (roots.isEmpty()) {
      return false;
    }

    String fieldName = rootAssetFieldName(request.lens());
    if (nullOrEmpty(fieldName)) {
      return false;
    }
    RootAssetCounts rootAssetCounts = counts.fetchRootAssetCountsByLens(fieldName);
    if (rootAssetCounts.truncated()) {
      LOG.warn(
          "Lineage scene root aggregation exceeded its bucket limit for lens field {}", fieldName);
    }
    if (request.band() == LineageBand.LAYER && !request.requiresEntityAuthorization()) {
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
                        .withEntity(syntheticCountEntity(root, request.lens(), entityType, count)));
          }
        }
      }
      return rootAssetCounts.truncated();
    }

    int remainingBudget = Math.max(1, request.size() + 1);
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
        tasks.add(() -> search.searchRootAssets(fieldName, root.fqn(), entityType, fetchSize));
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

  FocusedAssetsResult enrichFocusedSceneAssets(SearchLineageResult lineage) throws IOException {
    if (lineage == null || lineage.getNodes() == null) {
      return new FocusedAssetsResult(List.of(), false);
    }
    String fieldName = focusedAssetFieldName(request.entityType());
    if (nullOrEmpty(fieldName)) {
      return new FocusedAssetsResult(List.of(), false);
    }
    if (DATABASE_FQN_KEYWORD_FIELD.equals(fieldName) && !search.isDatabaseKeywordFieldMapped()) {
      logDatabaseReindexRequired();
      return new FocusedAssetsResult(List.of(), false);
    }

    FocusedAssets assets = new FocusedAssets(lineage, Math.max(1, request.size() + 1));
    assets.add(
        search.searchFocusedAssets(
            fieldName, request.focusFqn(), assets.remaining, UPSTREAM_LINEAGE_DOC_ID_FIELD));
    if (assets.remaining > 0) {
      enrichFocusedFeeders(assets);
    }
    if (assets.remaining > 0) {
      assets.add(
          search.searchFocusedAssets(
              fieldName, request.focusFqn(), assets.remaining + assets.seedsByFqn.size(), null));
    }
    return assets.result();
  }

  private void enrichFocusedFeeders(FocusedAssets assets) throws IOException {
    SearchRootAssetsResult feederHits =
        search.searchFeederDocuments(request.focusFqn(), assets.remaining * 4);
    assets.sampled |= feederHits.total() > feederHits.assets().size();
    List<String> feederFqns = feederChildFqns(feederHits.assets(), request.focusFqn());
    if (!feederFqns.isEmpty()) {
      assets.add(
          search.searchAssetsByTerms(
              ENTITY_FQN_FIELD,
              feederFqns.stream().map(LineageSceneSearch::normalizedKey).toList(),
              DATA_ASSET_SEARCH_ALIAS,
              assets.remaining));
    }
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

  boolean enrichFocusedChildLineage(SearchLineageResult lineage, List<LineageSeed> lineageSeeds)
      throws IOException {
    List<LineageSeed> seeds =
        lineageSeeds.stream()
            .filter(seed -> !nullOrEmpty(seed.fqn()) && !nullOrEmpty(seed.entityType()))
            .limit(FOCUSED_CHILD_LINEAGE_LOOKUP_LIMIT)
            .toList();
    if (seeds.isEmpty()) {
      return false;
    }
    List<IOTask<SearchLineageResult>> tasks =
        seeds.stream()
            .map(
                seed ->
                    bestEffortTask(
                        "child lineage for " + seed.entityType() + " " + seed.fqn(),
                        () ->
                            fetchFocusedLineage(
                                seed.fqn(), seed.entityType(), FOCUSED_CHILD_LINEAGE_SIZE)))
            .toList();
    List<SearchLineageResult> results = runBounded(tasks, FOCUSED_CHILD_LINEAGE_PARALLELISM);
    for (SearchLineageResult childLineage : results) {
      mergeLineage(lineage, childLineage);
    }
    return results.size() < seeds.size() || lineageSeeds.size() > seeds.size();
  }

  private static void mergeLineage(SearchLineageResult target, SearchLineageResult source) {
    if (target == null || source == null) {
      return;
    }
    nodeMap(target).putAll(nodeMap(source));
    upstreamEdgeMap(target).putAll(upstreamEdgeMap(source));
    downstreamEdgeMap(target).putAll(downstreamEdgeMap(source));
  }

  private void hydrateMissingRootLineageAssets(SearchLineageResult lineage) throws IOException {
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
          search.searchAssetsByTerms(
              ENTITY_FQN_FIELD,
              batch.stream().map(LineageSceneSearch::normalizedKey).toList(),
              DATA_ASSET_SEARCH_ALIAS,
              batch.size());
      for (Map<String, Object> asset : searchResult.assets()) {
        String fqn = stringValue(asset, "fullyQualifiedName");
        if (!nullOrEmpty(fqn)) {
          nodeMap(lineage).putIfAbsent(fqn, new NodeInformation().withEntity(asset));
        }
      }
    }
  }

  private static Map<String, NodeInformation> nodeMap(SearchLineageResult lineage) {
    if (lineage.getNodes() == null) {
      lineage.setNodes(new LinkedHashMap<>());
    }
    return lineage.getNodes();
  }

  static Map<String, EsLineageData> upstreamEdgeMap(SearchLineageResult lineage) {
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

  private static final class FocusedAssets {
    private final SearchLineageResult lineage;
    private final Map<String, LineageSeed> seedsByFqn = new LinkedHashMap<>();
    private int remaining;
    private boolean sampled;

    private FocusedAssets(SearchLineageResult lineage, int limit) {
      this.lineage = lineage;
      this.remaining = limit;
    }

    private void add(SearchRootAssetsResult result) {
      remaining -= addFocusedAssets(lineage, seedsByFqn, result.assets(), remaining);
      sampled |= result.total() > result.assets().size();
    }

    private FocusedAssetsResult result() {
      return new FocusedAssetsResult(
          List.copyOf(seedsByFqn.values()),
          sampled || remaining == 0 || seedsByFqn.size() > FOCUSED_CHILD_LINEAGE_LOOKUP_LIMIT);
    }
  }

  record LoadedScene(SearchLineageResult lineage, boolean sampled) {}

  record LineageSeed(String fqn, String entityType) {}

  record FocusedAssetsResult(List<LineageSeed> seeds, boolean sampled) {}
}
