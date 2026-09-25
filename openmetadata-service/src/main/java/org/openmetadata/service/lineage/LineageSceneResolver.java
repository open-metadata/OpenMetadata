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

import static org.openmetadata.service.lineage.LineageSceneEdges.enrichIndexedUpstreamLineage;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.buildBreadcrumb;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.findFocusAsset;
import static org.openmetadata.service.lineage.LineageSceneMapper.buildAssets;

import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.LineageScene;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.lineage.LineageSceneGraph.SceneSelection;
import org.openmetadata.service.lineage.LineageSceneLoader.LoadedScene;
import org.openmetadata.service.lineage.LineageSceneMapper.Ref;
import org.openmetadata.service.lineage.LineageSceneMapper.SceneAsset;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.lineage.LineageDomainFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

public class LineageSceneResolver {
  private final LineageHydrator hydrator;
  private final SearchRepository repository;

  LineageSceneResolver() {
    this(null, null);
  }

  public LineageSceneResolver(LineageHydrator hydrator) {
    this(hydrator, Entity.getSearchRepository());
  }

  LineageSceneResolver(LineageHydrator hydrator, SearchRepository repository) {
    this.hydrator = hydrator;
    this.repository = repository;
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
    LineageSceneRequest request =
        new LineageSceneRequest(
            focusFqn,
            entityType,
            lens,
            band,
            upstreamDepth,
            downstreamDepth,
            size,
            LineageSceneQuery.parseQueryFilter(queryFilter),
            includeDeleted,
            securityContext,
            subjectContext);
    return getScene(request);
  }

  private LineageScene getScene(LineageSceneRequest request) throws IOException {
    boolean cacheable = request.canUseSharedRootCache();
    LineageSceneCache.Key cacheKey = request.cacheKey();
    if (cacheable) {
      Optional<LineageScene> cached = LineageSceneCache.getInstance().get(cacheKey);
      if (cached.isPresent()) {
        return cached.get();
      }
    }
    LoadedScene loaded = new LineageSceneLoader(repository, request).load();
    SearchLineageResult lineage = loaded.lineage();
    boolean sampled = loaded.sampled();
    if (request.requiresEntityAuthorization()) {
      hydrator.pruneUnauthorizedLineage(
          request.securityContext(), lineage, request.include(), false);
      sampled = true;
    }
    pruneLineage(lineage, request.subjectContext(), request.focusFqn());
    LineageScene scene =
        resolveScene(
            request.focusFqn(),
            request.entityType(),
            request.lens(),
            request.band(),
            lineage,
            request.size(),
            sampled);
    if (cacheable) {
      LineageSceneCache.getInstance().put(cacheKey, scene);
    }
    return scene;
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
        new LineageSceneGraph(assets, sceneLens, sceneBand, focusRef).buildSelection(lineage, size);

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

  private static void pruneLineage(
      SearchLineageResult lineage, SubjectContext subjectContext, String focusFqn) {
    String rootFqn =
        lineage != null && lineage.getNodes() != null && lineage.getNodes().containsKey(focusFqn)
            ? focusFqn
            : null;
    LineageDomainFilter.prune(lineage, subjectContext, rootFqn);
  }
}
