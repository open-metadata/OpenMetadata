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
import static org.openmetadata.service.lineage.LineageSceneEdges.addEdges;
import static org.openmetadata.service.lineage.LineageSceneEdges.addTemporaryLineage;
import static org.openmetadata.service.lineage.LineageSceneEdges.allEdges;
import static org.openmetadata.service.lineage.LineageSceneEdges.limitFieldEdges;
import static org.openmetadata.service.lineage.LineageSceneEdges.nodeId;
import static org.openmetadata.service.lineage.LineageSceneEdges.shouldExpandTemporaryLineage;
import static org.openmetadata.service.lineage.LineageSceneEdges.trimFieldNodes;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.fieldKind;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.isContainedChild;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.isExpandable;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.isFocusedContainerScene;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.isGhost;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.isParentRollupEdge;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.nodeBand;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.parentFqn;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.parentId;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.selectRef;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.selectionLevel;
import static org.openmetadata.service.lineage.LineageSceneHierarchy.shouldSeedRootLayerNodes;
import static org.openmetadata.service.lineage.LineageSceneMapper.assetForRef;
import static org.openmetadata.service.lineage.LineageSceneMapper.firstNonBlank;
import static org.openmetadata.service.lineage.LineageSceneMapper.stringValue;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.LineageSceneEdge;
import org.openmetadata.schema.api.lineage.LineageSceneNode;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.service.lineage.LineageSceneEdges.Endpoint;
import org.openmetadata.service.lineage.LineageSceneEdges.RollupEdge;
import org.openmetadata.service.lineage.LineageSceneHierarchy.SelectionLevel;
import org.openmetadata.service.lineage.LineageSceneMapper.Ref;
import org.openmetadata.service.lineage.LineageSceneMapper.SceneAsset;

final class LineageSceneGraph {
  private final Map<String, SceneAsset> assets;
  private final LineageLens lens;
  private final LineageBand band;
  private final Ref focusRef;
  private final SelectionLevel selectionLevel;
  private final boolean focusedContainerScene;
  private final Map<String, LineageSceneNode> nodes = new LinkedHashMap<>();
  private final Map<String, String> nodeIdsByFqn = new LinkedHashMap<>();
  private final Map<String, Set<String>> countedAssetIdsByNode = new LinkedHashMap<>();
  private final Map<String, Set<String>> syntheticCountKindsByNode = new LinkedHashMap<>();
  private final Map<String, RollupEdge> edgeByKey = new LinkedHashMap<>();

  LineageSceneGraph(
      Map<String, SceneAsset> assets, LineageLens lens, LineageBand band, Ref focusRef) {
    this.assets = assets;
    this.lens = lens;
    this.band = band;
    this.focusRef = focusRef;
    this.selectionLevel = selectionLevel(assets.values(), lens, band, focusRef);
    this.focusedContainerScene = isFocusedContainerScene(band, focusRef);
  }

  SceneSelection buildSelection(SearchLineageResult lineage, int size) {
    List<EsLineageData> lineageEdges = allEdges(lineage);
    if (lineageEdges.isEmpty()
        || focusedContainerScene
        || shouldSeedRootLayerNodes(band, focusRef)) {
      seedNodes(focusedContainerScene, false);
    }
    lineageEdges.forEach(this::addEdge);
    if (nodes.isEmpty()) {
      seedNodes(false, true);
    }
    return visibleSelection(size);
  }

  private void seedNodes(boolean containedOnly, boolean markGhosts) {
    for (SceneAsset asset : assets.values()) {
      if (!containedOnly || isContainedChild(asset, focusRef)) {
        Ref ref = selectRef(asset, lens, band, focusRef, selectionLevel);
        addNode(ref, asset, markGhosts && isGhost(asset, focusRef));
      }
    }
  }

  private void addEdge(EsLineageData edge) {
    SceneAsset fromAsset = assetForRef(assets, edge.getFromEntity());
    SceneAsset toAsset = assetForRef(assets, edge.getToEntity());
    if (fromAsset == null || toAsset == null) {
      return;
    }
    Ref fromRef = selectRef(fromAsset, lens, band, focusRef, selectionLevel);
    Ref toRef = selectRef(toAsset, lens, band, focusRef, selectionLevel);
    if (!isVisibleEdge(fromRef, toRef)) {
      return;
    }
    addNode(fromRef, fromAsset, isGhost(fromAsset, focusRef));
    addNode(toRef, toAsset, isGhost(toAsset, focusRef));
    Endpoint fromEndpoint = new Endpoint(fromRef, fromAsset);
    Endpoint toEndpoint = new Endpoint(toRef, toAsset);
    if (shouldExpandTemporaryLineage(edge, fromEndpoint, toEndpoint, band)) {
      addTemporaryLineage(nodes, nodeIdsByFqn, edgeByKey, edge);
    } else {
      addEdges(edgeByKey, edge, fromEndpoint, toEndpoint, band);
    }
  }

  private boolean isVisibleEdge(Ref fromRef, Ref toRef) {
    return fromRef != null
        && toRef != null
        && !Objects.equals(fromRef.nodeId(), toRef.nodeId())
        && !(focusedContainerScene && isParentRollupEdge(focusRef, fromRef, toRef));
  }

  private SceneSelection visibleSelection(int size) {
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

  private void addNode(Ref ref, SceneAsset asset, boolean isGhost) {
    if (ref == null) {
      return;
    }
    LineageSceneNode node =
        nodes.computeIfAbsent(ref.nodeId(), ignored -> createNode(ref, asset, isGhost));
    if (!nullOrEmpty(node.getFullyQualifiedName())) {
      nodeIdsByFqn.putIfAbsent(node.getFullyQualifiedName(), node.getId());
    }
    mergeNodeCounts(node, ref, asset);
  }

  private LineageSceneNode createNode(Ref ref, SceneAsset asset, boolean isGhost) {
    return new LineageSceneNode()
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
        .withIsOrigin(focusRef != null && Objects.equals(asset.self().fqn(), focusRef.fqn()))
        .withIsExpandable(isExpandable(ref, asset))
        .withIsGhost(isGhost)
        .withCertification(certification(asset.self().sourceEntity()))
        .withSourceEntity(ref.sourceEntity());
  }

  private void mergeNodeCounts(LineageSceneNode node, Ref ref, SceneAsset asset) {
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

  static Map<String, Integer> counts(Ref ref, SceneAsset asset) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    if (Objects.equals(ref.fqn(), asset.self().fqn()) && !asset.fields().isEmpty()) {
      counts.put(fieldKind(asset.self().kind()).value(), asset.fields().size());
    }
    if (!Objects.equals(ref.fqn(), asset.self().fqn())) {
      counts.put(asset.self().kind().value(), asset.count());
    }
    return counts;
  }

  static String certification(Map<String, Object> entity) {
    Object certification = entity == null ? null : entity.get("certification");
    if (certification instanceof Map<?, ?> map) {
      return stringValue(map, "tagLabel");
    }
    return null;
  }

  private static Set<String> truncateNodes(
      Map<String, LineageSceneNode> nodes, Map<String, RollupEdge> edgeByKey, int size) {
    if (size <= 0 || nodes.size() <= size) {
      return new LinkedHashSet<>(nodes.keySet());
    }
    Map<String, Integer> degreeByNode = new LinkedHashMap<>();
    for (RollupEdge edge : edgeByKey.values()) {
      degreeByNode.merge(nodeId(edge.from()), 1, Integer::sum);
      degreeByNode.merge(nodeId(edge.to()), 1, Integer::sum);
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

  record SceneSelection(
      List<LineageSceneNode> nodes, List<LineageSceneEdge> edges, int hiddenNodeCount) {}
}
