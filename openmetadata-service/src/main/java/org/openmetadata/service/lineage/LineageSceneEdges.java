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
import static org.openmetadata.service.lineage.LineageSceneLoader.upstreamEdgeMap;
import static org.openmetadata.service.lineage.LineageSceneMapper.firstNonBlank;
import static org.openmetadata.service.lineage.LineageSceneMapper.lastFqnPart;
import static org.openmetadata.service.lineage.LineageSceneMapper.stringValue;
import static org.openmetadata.service.search.SearchUtils.getRelationshipRef;
import static org.openmetadata.service.search.SearchUtils.getUpstreamLineageListIfExist;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLevelKind;
import org.openmetadata.schema.api.lineage.LineageSceneEdge;
import org.openmetadata.schema.api.lineage.LineageSceneField;
import org.openmetadata.schema.api.lineage.LineageSceneNode;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TempLineageTable;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.lineage.LineageSceneMapper.Ref;
import org.openmetadata.service.lineage.LineageSceneMapper.SceneAsset;

@Slf4j
final class LineageSceneEdges {
  private LineageSceneEdges() {}

  private static final String FIELD_SEPARATOR = "::field::";

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

  static void enrichIndexedUpstreamLineage(SearchLineageResult lineage) {
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

  static List<LineageSceneEdge> limitFieldEdges(List<LineageSceneEdge> edges, int size) {
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

  static void trimFieldNodes(Collection<LineageSceneNode> nodes, List<LineageSceneEdge> edges) {
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

  static List<EsLineageData> allEdges(SearchLineageResult lineage) {
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

  static void addEdges(
      Map<String, RollupEdge> edgeByKey,
      EsLineageData edge,
      Endpoint fromEndpoint,
      Endpoint toEndpoint,
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
          String from = fromEndpoint.fieldId(fromColumn);
          String to = toEndpoint.fieldId(toColumn);
          addRollup(edgeByKey, edge, from, to, LineageBand.FIELD, false);
        }
      }
      return;
    }
    boolean rollup = band == LineageBand.LAYER || !fromEndpoint.isAsset() || !toEndpoint.isAsset();
    addRollup(
        edgeByKey, edge, fromEndpoint.ref().nodeId(), toEndpoint.ref().nodeId(), band, rollup);
  }

  static boolean shouldExpandTemporaryLineage(
      EsLineageData edge, Endpoint fromEndpoint, Endpoint toEndpoint, LineageBand band) {
    return band == LineageBand.ASSET
        && fromEndpoint.isAsset()
        && toEndpoint.isAsset()
        && edge.getTempLineageTables() != null
        && edge.getTempLineageTables().stream()
            .anyMatch(
                hop ->
                    hop != null
                        && !nullOrEmpty(hop.getFromEntity())
                        && !nullOrEmpty(hop.getToEntity()));
  }

  static void addTemporaryLineage(
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

  record Endpoint(Ref ref, SceneAsset asset) {
    boolean isAsset() {
      return Objects.equals(ref.nodeId(), asset.self().nodeId());
    }

    String fieldId(String column) {
      return ref.nodeId() + FIELD_SEPARATOR + asset.fieldIndex().endpoint(column);
    }
  }

  static String nodeId(String edgeEndpoint) {
    int index = edgeEndpoint.indexOf(FIELD_SEPARATOR);
    return index < 0 ? edgeEndpoint : edgeEndpoint.substring(0, index);
  }

  private static String fieldHandle(String edgeEndpoint) {
    int index = edgeEndpoint.indexOf(FIELD_SEPARATOR);
    return index < 0 ? null : edgeEndpoint.substring(index + FIELD_SEPARATOR.length());
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

  static class RollupEdge {
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
        String identity = firstNonBlank(edge.getDocUniqueId(), edge.getDocId());
        underlyingEdgeIds.add(nullOrEmpty(identity) ? concreteEdgeIdentity(edge) : identity);
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

    String from() {
      return from;
    }

    String to() {
      return to;
    }

    LineageSceneEdge toSceneEdge() {
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
