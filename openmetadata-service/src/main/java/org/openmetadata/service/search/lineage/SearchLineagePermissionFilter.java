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
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.EntityCountLineageRequest;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.LineageDirection;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.schema.utils.JsonUtils;
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
 * ADR:2026-10-30-search-lineage-returns-only-assets-the-caller-can-view
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
    return needsFiltering(subjectContext)
        ? new SearchLineagePermissionFilter(Entity.getAuthorizer())
            .filter(securityContextOf(subjectContext), subjectContext, lineage, rootFqn)
        : lineage;
  }

  /** {@link #filterPage} for an entity-count page read after its request, such as an export job. */
  public static SearchLineageResult filterPageFor(
      SubjectContext subjectContext, SearchLineageResult page, EntityCountLineageRequest request) {
    return needsFiltering(subjectContext)
        ? new SearchLineagePermissionFilter(Entity.getAuthorizer())
            .filterPage(securityContextOf(subjectContext), subjectContext, page, request)
        : page;
  }

  /**
   * The data-quality lineage response is a set of node documents and a set of edges rather than a
   * rooted graph, so nodes are kept by visibility alone; edges keep only kept endpoints.
   */
  public static void filterDataQualityLineageFor(
      SubjectContext subjectContext, Set<Map<String, Object>> nodes, Set<EsLineageData> edges) {
    if (needsFiltering(subjectContext) && !nullOrEmpty(nodes)) {
      SearchLineageResult view = filterFor(subjectContext, asLineage(nodes, edges), null);
      refill(nodes, view.getNodes().values().stream().map(NodeInformation::getEntity).toList());
      refill(edges, List.copyOf(view.getUpstreamEdges().values()));
    }
  }

  /**
   * {@code lineage} as the caller may see it. The graph builders cache the graph they return and
   * hand the same one to the next caller, so the caller's view is cut from a copy and {@code
   * lineage} is left as it was. {@code rootFqn} is the node the caller asked about, which the caller
   * has already been authorized to view; without one, nodes are kept by visibility alone.
   */
  public SearchLineageResult filter(
      SecurityContext securityContext,
      SubjectContext subjectContext,
      SearchLineageResult lineage,
      String rootFqn) {
    if (!needsFiltering(subjectContext) || isEmpty(lineage)) {
      return lineage;
    }
    SearchLineageResult view = JsonUtils.deepCopy(lineage, SearchLineageResult.class);
    retainOnly(securityContext, view, reachableThroughViewable(securityContext, view, rootFqn));
    return view;
  }

  /**
   * An entity-count page holds a slice of one depth's nodes, so the node that links one of them to
   * the root can sit on another page. Which nodes the root reaches through nodes the caller can view
   * is decided on the graph the page was cut from, and the page keeps only those of its nodes.
   */
  public SearchLineageResult filterPage(
      SecurityContext securityContext,
      SubjectContext subjectContext,
      SearchLineageResult page,
      EntityCountLineageRequest request) {
    if (!needsFiltering(subjectContext) || isEmpty(page)) {
      return page;
    }
    SearchLineageResult wholeGraph = wholeGraphOf(request, subjectContext);
    Set<String> keep =
        isEmpty(wholeGraph)
            ? new HashSet<>()
            : reachableThroughViewable(securityContext, wholeGraph, request.getFqn());
    // The caller was authorized to view the root before the page was read.
    keep.add(request.getFqn());
    SearchLineageResult view = JsonUtils.deepCopy(page, SearchLineageResult.class);
    retainOnly(securityContext, view, keep);
    return view;
  }

  /** The depth-based request for the graph an entity-count page is cut from. */
  static SearchLineageRequest wholeGraphRequest(EntityCountLineageRequest page) {
    int depth = AbstractLineageGraphBuilder.traversalDepth(page.getNodeDepth(), page.getMaxDepth());
    boolean upstream = page.getDirection() == LineageDirection.UPSTREAM;
    return new SearchLineageRequest()
        .withFqn(page.getFqn())
        .withDirection(page.getDirection())
        .withUpstreamDepth(upstream ? depth : 0)
        .withDownstreamDepth(upstream ? 0 : depth)
        .withQueryFilter(page.getQueryFilter())
        .withIncludeDeleted(page.getIncludeDeleted())
        .withIsConnectedVia(page.getIsConnectedVia())
        .withStartTime(page.getStartTime())
        .withEndTime(page.getEndTime());
  }

  private static SearchLineageResult wholeGraphOf(
      EntityCountLineageRequest page, SubjectContext subjectContext) {
    try {
      return Entity.getSearchRepository().searchLineage(wholeGraphRequest(page), subjectContext);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private static boolean needsFiltering(SubjectContext subjectContext) {
    return subjectContext != null && !subjectContext.isAdmin();
  }

  private static boolean isEmpty(SearchLineageResult lineage) {
    return lineage == null || nullOrEmpty(lineage.getNodes());
  }

  /** The nodes of {@code lineage} its root reaches through nodes the caller can view. */
  private Set<String> reachableThroughViewable(
      SecurityContext securityContext, SearchLineageResult lineage, String rootFqn) {
    Map<String, EntityReference> nodeRefs = nodeReferences(lineage.getNodes());
    Set<String> visible = visibleNodeKeys(securityContext, nodeRefs, lineage, rootFqn);
    return isRooted(lineage, rootFqn)
        ? LineageDomainFilter.reachableFromRoot(lineage, visible, rootFqn)
        : visible;
  }

  private void retainOnly(
      SecurityContext securityContext, SearchLineageResult lineage, Set<String> keep) {
    Map<String, EntityReference> nodeRefs = nodeReferences(lineage.getNodes());
    lineage.getNodes().keySet().retainAll(keep);
    LineageDomainFilter.retainEdges(lineage, keep);
    hideUnviewableReferences(securityContext, lineage, idsOf(keep, nodeRefs));
  }

  private Set<String> visibleNodeKeys(
      SecurityContext securityContext,
      Map<String, EntityReference> nodeRefs,
      SearchLineageResult lineage,
      String rootFqn) {
    Set<UUID> viewable = viewableIds(securityContext, nodeRefs.values());
    Set<String> visible = new HashSet<>();
    nodeRefs.forEach(
        (key, ref) -> {
          if (viewable.contains(ref.getId())) {
            visible.add(key);
          }
        });
    if (isRooted(lineage, rootFqn)) {
      visible.add(rootFqn);
    }
    return visible;
  }

  private static boolean isRooted(SearchLineageResult lineage, String rootFqn) {
    return rootFqn != null && lineage.getNodes().containsKey(rootFqn);
  }

  private static Set<UUID> idsOf(Set<String> keys, Map<String, EntityReference> nodeRefs) {
    return keys.stream()
        .map(nodeRefs::get)
        .filter(Objects::nonNull)
        .map(EntityReference::getId)
        .collect(Collectors.toSet());
  }

  /**
   * Edges and {@code upstreamLineage} entries can name assets that are not nodes of this response:
   * a pipeline on an edge, or an upstream asset past the requested depth. Each is authorized like a
   * node; one the caller cannot view is removed.
   */
  private void hideUnviewableReferences(
      SecurityContext securityContext, SearchLineageResult lineage, Set<UUID> keptIds) {
    List<EsLineageData> edges = allEdges(lineage);
    Set<UUID> viewable =
        viewableReferences(securityContext, edges, lineage.getNodes().values(), keptIds);
    edges.stream()
        .filter(edge -> !isViewable(edgePipeline(edge), viewable))
        .forEach(edge -> edge.setPipeline(null));
    lineage.getNodes().values().forEach(node -> hideUnviewableUpstreamLineage(node, viewable));
  }

  private Set<UUID> viewableReferences(
      SecurityContext securityContext,
      List<EsLineageData> edges,
      Collection<NodeInformation> nodes,
      Set<UUID> keptIds) {
    Map<UUID, EntityReference> referenced = new LinkedHashMap<>();
    edges.forEach(edge -> addReference(referenced, edgePipeline(edge)));
    for (NodeInformation node : nodes) {
      for (Map<String, Object> entry : upstreamLineageOf(node)) {
        addReference(referenced, mapRef(entry.get(FROM_ENTITY), null));
        addReference(referenced, mapRef(entry.get(PIPELINE), null));
      }
    }
    referenced.keySet().removeAll(keptIds);
    Set<UUID> viewable = new HashSet<>(viewableIds(securityContext, referenced.values()));
    viewable.addAll(keptIds);
    return viewable;
  }

  private static void hideUnviewableUpstreamLineage(NodeInformation node, Set<UUID> viewable) {
    List<Map<String, Object>> entries = upstreamLineageOf(node);
    entries.removeIf(entry -> !isViewable(mapRef(entry.get(FROM_ENTITY), null), viewable));
    entries.stream()
        .filter(entry -> !isViewable(mapRef(entry.get(PIPELINE), null), viewable))
        .forEach(entry -> entry.remove(PIPELINE));
  }

  private static EntityReference edgePipeline(EsLineageData edge) {
    return mapRef(edge.getPipeline(), edge.getPipelineEntityType());
  }

  private static List<EsLineageData> allEdges(SearchLineageResult lineage) {
    List<EsLineageData> edges = new ArrayList<>(edgesOf(lineage.getUpstreamEdges()));
    edges.addAll(edgesOf(lineage.getDownstreamEdges()));
    return edges;
  }

  private static SearchLineageResult asLineage(
      Set<Map<String, Object>> nodes, Set<EsLineageData> edges) {
    Map<String, NodeInformation> nodesByFqn = new HashMap<>();
    for (Map<String, Object> node : nodes) {
      if (node.get(FQN) != null) {
        nodesByFqn.put(node.get(FQN).toString(), new NodeInformation().withEntity(node));
      }
    }
    Map<String, EsLineageData> edgesByKey = new HashMap<>();
    edges.forEach(edge -> edgesByKey.put(String.valueOf(edgesByKey.size()), edge));
    return new SearchLineageResult().withNodes(nodesByFqn).withUpstreamEdges(edgesByKey);
  }

  // Both sets hash their elements by content, which the filter may just have changed, so they are
  // refilled rather than edited in place.
  private static <T> void refill(Set<T> target, List<T> kept) {
    target.clear();
    target.addAll(kept);
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
