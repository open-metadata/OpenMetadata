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

package org.openmetadata.service.search.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.CatalogPrincipal;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Drops search-lineage nodes the caller cannot {@link MetadataOperation#VIEW_BASIC}, and every
 * trace of them in what is returned.
 *
 * <p>Authorizing the lineage root is not enough. Each node is a neighbour's search document, so an
 * unfiltered response hands a caller the name, description, owners and columns of assets their
 * policies hide, and each node's {@code upstreamLineage} names its upstream assets and the SQL
 * between them. So, as {@code LineagePermissionFilter} does for the entity lineage graph:
 *
 * <ul>
 *   <li>nodes the caller cannot view are removed, and so is every node reachable from the root only
 *       through one of them;
 *   <li>edges keep only kept endpoints, and lose a pipeline the caller cannot view;
 *   <li>a kept node's {@code upstreamLineage} keeps only entries from assets the caller can view.
 * </ul>
 *
 * <p>Decisions come from {@link ViewPermissionFilter}, which fails closed: anything past {@link
 * #MAX_FILTERED_REFERENCES} is hidden unchecked. Admins see everything.
 */
@Slf4j
public class SearchLineagePermissionFilter {
  private static final int MAX_FILTERED_REFERENCES = 1000;
  private static final String UPSTREAM_LINEAGE = "upstreamLineage";
  private static final String FROM_ENTITY = "fromEntity";
  private static final String PIPELINE = "pipeline";
  private static final String ID = "id";
  private static final String TYPE = "type";
  private static final String ENTITY_TYPE = "entityType";
  private static final String FQN = "fullyQualifiedName";

  // Never authorized and never viewable: it stands for a reference this filter cannot identify.
  private static final EntityReference UNRESOLVABLE =
      new EntityReference().withId(new UUID(0L, 0L)).withType("unresolvable");

  private final ViewPermissionFilter viewFilter;

  public SearchLineagePermissionFilter(Authorizer authorizer) {
    this.viewFilter = new ViewPermissionFilter(authorizer);
  }

  /**
   * For a lineage read after the request that asked for it, such as an export job, decided as the
   * user who asked.
   */
  public static SearchLineageResult filterFor(
      SubjectContext subjectContext, SearchLineageResult lineage, String rootFqn) {
    if (subjectContext == null || subjectContext.isAdmin()) {
      return lineage;
    }
    return new SearchLineagePermissionFilter(Entity.getAuthorizer())
        .filter(securityContextOf(subjectContext), subjectContext, lineage, rootFqn);
  }

  /**
   * The data-quality lineage response is a set of node documents and a set of edges rather than a
   * rooted graph, so nodes are kept by visibility alone; edges keep only kept endpoints.
   */
  public static void filterDataQualityLineageFor(
      SubjectContext subjectContext, Set<Map<String, Object>> nodes, Set<EsLineageData> edges) {
    if (subjectContext == null || subjectContext.isAdmin() || nullOrEmpty(nodes)) {
      return;
    }
    SearchLineageResult lineage = new SearchLineageResult().withNodes(new HashMap<>());
    for (Map<String, Object> node : nodes) {
      Object fqn = node.get(FQN);
      if (fqn != null) {
        lineage.getNodes().put(fqn.toString(), new NodeInformation().withEntity(node));
      }
    }
    Map<String, EsLineageData> edgesByKey = new HashMap<>();
    int key = 0;
    for (EsLineageData edge : edges) {
      edgesByKey.put(String.valueOf(key++), edge);
    }
    lineage.setUpstreamEdges(edgesByKey);
    filterFor(subjectContext, lineage, null);
    // Both sets hash their elements by content, which the filter may just have changed, so they are
    // refilled rather than edited in place.
    List<Map<String, Object>> keptNodes = new ArrayList<>();
    lineage.getNodes().values().forEach(node -> keptNodes.add(node.getEntity()));
    List<EsLineageData> keptEdges = new ArrayList<>(lineage.getUpstreamEdges().values());
    nodes.clear();
    nodes.addAll(keptNodes);
    edges.clear();
    edges.addAll(keptEdges);
  }

  /**
   * Prunes {@code lineage} in place. {@code rootFqn} is the node the caller asked about, which the
   * caller has already been authorized to view; without one, nodes are kept by visibility alone.
   */
  public SearchLineageResult filter(
      SecurityContext securityContext,
      SubjectContext subjectContext,
      SearchLineageResult lineage,
      String rootFqn) {
    if (lineage == null
        || nullOrEmpty(lineage.getNodes())
        || subjectContext == null
        || subjectContext.isAdmin()) {
      return lineage;
    }
    Map<String, EntityReference> nodeRefs = nodeReferences(lineage.getNodes());
    Set<UUID> viewable = viewableIds(securityContext, nodeRefs.values());
    Set<String> visible = new HashSet<>();
    nodeRefs.forEach(
        (key, ref) -> {
          if (viewable.contains(ref.getId())) {
            visible.add(key);
          }
        });
    boolean rooted = rootFqn != null && lineage.getNodes().containsKey(rootFqn);
    if (rooted) {
      visible.add(rootFqn);
    }
    Set<String> keep =
        rooted ? LineageDomainFilter.reachableFromRoot(lineage, visible, rootFqn) : visible;
    lineage.getNodes().keySet().retainAll(keep);
    LineageDomainFilter.retainEdges(lineage, keep);
    Set<UUID> keptIds = new HashSet<>();
    keep.forEach(key -> keptIds.add(nodeRefs.containsKey(key) ? nodeRefs.get(key).getId() : null));
    keptIds.remove(null);
    hideUnviewableReferences(securityContext, lineage, keptIds);
    return lineage;
  }

  /**
   * Edges and {@code upstreamLineage} entries can name assets that are not nodes of this response:
   * a pipeline on an edge, or an upstream asset past the requested depth. Each is authorized like a
   * node; one the caller cannot view is removed.
   */
  private void hideUnviewableReferences(
      SecurityContext securityContext, SearchLineageResult lineage, Set<UUID> keptIds) {
    List<EsLineageData> edges = new ArrayList<>();
    edges.addAll(edgesOf(lineage.getUpstreamEdges()));
    edges.addAll(edgesOf(lineage.getDownstreamEdges()));
    List<Map<String, Object>> upstreamEntries = new ArrayList<>();
    for (NodeInformation node : lineage.getNodes().values()) {
      upstreamEntries.addAll(upstreamLineageOf(node));
    }

    Map<UUID, EntityReference> referenced = new LinkedHashMap<>();
    for (EsLineageData edge : edges) {
      addReference(referenced, mapRef(edge.getPipeline(), edge.getPipelineEntityType()));
    }
    for (Map<String, Object> entry : upstreamEntries) {
      addReference(referenced, mapRef(entry.get(FROM_ENTITY), null));
      addReference(referenced, mapRef(entry.get(PIPELINE), null));
    }
    referenced.keySet().removeAll(keptIds);
    Set<UUID> viewable = new HashSet<>(viewableIds(securityContext, referenced.values()));
    viewable.addAll(keptIds);

    for (EsLineageData edge : edges) {
      if (!isViewable(mapRef(edge.getPipeline(), edge.getPipelineEntityType()), viewable)) {
        edge.setPipeline(null);
      }
    }
    for (NodeInformation node : lineage.getNodes().values()) {
      List<Map<String, Object>> entries = upstreamLineageOf(node);
      entries.removeIf(entry -> !isViewable(mapRef(entry.get(FROM_ENTITY), null), viewable));
      for (Map<String, Object> entry : entries) {
        if (!isViewable(mapRef(entry.get(PIPELINE), null), viewable)) {
          entry.remove(PIPELINE);
        }
      }
    }
  }

  private Set<UUID> viewableIds(
      SecurityContext securityContext, Collection<EntityReference> references) {
    List<EntityReference> checkable = new ArrayList<>(references);
    if (checkable.size() > MAX_FILTERED_REFERENCES) {
      LOG.warn(
          "Search lineage names {} assets; authorizing the first {} and hiding the rest unchecked",
          checkable.size(),
          MAX_FILTERED_REFERENCES);
      checkable = checkable.subList(0, MAX_FILTERED_REFERENCES);
    }
    return checkable.isEmpty() ? Set.of() : viewFilter.viewableIds(securityContext, checkable);
  }

  private static boolean isViewable(EntityReference ref, Set<UUID> viewable) {
    return ref == null || viewable.contains(ref.getId());
  }

  private static void addReference(Map<UUID, EntityReference> references, EntityReference ref) {
    if (ref != null && ref != UNRESOLVABLE) {
      references.putIfAbsent(ref.getId(), ref);
    }
  }

  /**
   * The node's {@code upstreamLineage}, made mutable in place. A node whose entries cannot be read
   * loses them, rather than keeping entries this filter could not check.
   */
  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> upstreamLineageOf(NodeInformation node) {
    Map<String, Object> entity = node == null ? null : node.getEntity();
    if (entity == null || !(entity.get(UPSTREAM_LINEAGE) instanceof List<?> entries)) {
      return new ArrayList<>();
    }
    List<Map<String, Object>> readable = new ArrayList<>();
    for (Object entry : entries) {
      if (entry instanceof Map<?, ?> map) {
        readable.add((Map<String, Object>) map);
      }
    }
    entity.put(UPSTREAM_LINEAGE, readable);
    return readable;
  }

  /** A node the filter cannot identify is not returned: it has no decision. */
  private static Map<String, EntityReference> nodeReferences(Map<String, NodeInformation> nodes) {
    Map<String, EntityReference> refs = new HashMap<>();
    nodes.forEach(
        (key, node) -> {
          Map<String, Object> entity = node == null ? null : node.getEntity();
          Object type = entity == null ? null : entity.getOrDefault(ENTITY_TYPE, entity.get(TYPE));
          EntityReference ref = entity == null ? null : reference(entity.get(ID), type);
          if (ref != null) {
            refs.put(key, ref);
          }
        });
    return refs;
  }

  /**
   * A reference stored as a map, or null when there is none. One that cannot be resolved to a type
   * and id cannot be checked, so it counts as naming an asset the caller cannot view.
   */
  private static EntityReference mapRef(Object value, String defaultType) {
    if (!(value instanceof Map<?, ?> map) || map.isEmpty()) {
      return null;
    }
    Object type = map.get(TYPE) != null ? map.get(TYPE) : defaultType;
    EntityReference ref = reference(map.get(ID), type);
    return ref != null ? ref : UNRESOLVABLE;
  }

  private static EntityReference reference(Object id, Object type) {
    if (id == null || type == null || nullOrEmpty(type.toString())) {
      return null;
    }
    try {
      return new EntityReference().withId(UUID.fromString(id.toString())).withType(type.toString());
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  private static Collection<EsLineageData> edgesOf(Map<String, EsLineageData> edges) {
    return edges == null ? List.of() : edges.values();
  }

  private static SecurityContext securityContextOf(SubjectContext subjectContext) {
    return new CatalogSecurityContext(
        new CatalogPrincipal(subjectContext.user().getName(), subjectContext.user().getEmail()),
        "https",
        SecurityContext.BASIC_AUTH,
        new HashSet<>());
  }
}
