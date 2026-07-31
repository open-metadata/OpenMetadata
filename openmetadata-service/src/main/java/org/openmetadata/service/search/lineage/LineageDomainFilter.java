/*
 *  Copyright 2024 Collate
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

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Prunes a {@link SearchLineageResult} so a domain-restricted user (one holding the
 * {@code DomainOnlyAccessRole}) only sees lineage nodes within their accessible domains — their own
 * domains, their sub-domains (via domain hierarchy), and domainless entities. Foreign-domain nodes
 * are removed; traversal through them is severed by keeping only nodes reachable from the root
 * through visible nodes, so a user-domain entity that is reachable only via a hidden foreign node
 * does not leak.
 */
public final class LineageDomainFilter {
  private static final String DOMAINS_FIELD = "domains";
  private static final String FQN_FIELD = "fullyQualifiedName";

  private LineageDomainFilter() {}

  public static boolean shouldApply(SubjectContext subjectContext) {
    return subjectContext != null
        && !subjectContext.isAdmin()
        && !subjectContext.isBot()
        && subjectContext.hasDomainOnlyAccessRole();
  }

  /**
   * Prunes a rooted lineage graph to nodes reachable from {@code rootFqn} through visible nodes.
   * When {@code rootFqn} is null/empty (e.g. platform lineage), prunes by visibility only.
   */
  public static SearchLineageResult prune(
      SearchLineageResult result, SubjectContext subjectContext, String rootFqn) {
    if (shouldApply(subjectContext) && result != null && !nullOrEmpty(result.getNodes())) {
      Set<String> visible = visibleNodes(result, subjectContext);
      Set<String> keep =
          nullOrEmpty(rootFqn) ? visible : reachableFromRoot(result, visible, rootFqn);
      result.getNodes().keySet().retainAll(keep);
      retainEdges(result, keep);
    }
    return result;
  }

  private static Set<String> visibleNodes(
      SearchLineageResult result, SubjectContext subjectContext) {
    Set<String> visible = new HashSet<>();
    for (Map.Entry<String, NodeInformation> entry : result.getNodes().entrySet()) {
      if (subjectContext.hasDomains(nodeDomains(entry.getValue()))) {
        visible.add(entry.getKey());
      }
    }
    return visible;
  }

  /**
   * Visibility-only prune for the data-quality lineage response, which is assembled as a Set of node
   * documents plus a Set of edges rather than a single rooted {@link SearchLineageResult}. Removes
   * nodes outside the user's accessible domains and any edge touching a removed node, closing the
   * same cross-domain leak as {@link #prune} for that endpoint.
   */
  public static void pruneDataQualityLineage(
      Set<Map<String, Object>> nodes, Set<EsLineageData> edges, SubjectContext subjectContext) {
    if (shouldApply(subjectContext) && !nullOrEmpty(nodes)) {
      Set<String> visible = new HashSet<>();
      for (Map<String, Object> node : nodes) {
        Object fqn = node.get(FQN_FIELD);
        if (fqn != null && subjectContext.hasDomains(domainsOf(node))) {
          visible.add(fqn.toString());
        }
      }
      nodes.removeIf(node -> !isNodeVisible(node, visible));
      edges.removeIf(edge -> !edgeKept(edge, visible));
    }
  }

  private static boolean isNodeVisible(Map<String, Object> node, Set<String> visible) {
    Object fqn = node.get(FQN_FIELD);
    return fqn != null && visible.contains(fqn.toString());
  }

  private static List<EntityReference> nodeDomains(NodeInformation node) {
    return domainsOf(node == null ? null : node.getEntity());
  }

  private static List<EntityReference> domainsOf(Map<String, Object> entity) {
    List<EntityReference> domainRefs = new ArrayList<>();
    Object domains = entity == null ? null : entity.get(DOMAINS_FIELD);
    if (domains instanceof List<?> domainList) {
      for (Object domain : domainList) {
        if (domain instanceof Map<?, ?> domainMap && domainMap.get(FQN_FIELD) != null) {
          domainRefs.add(
              new EntityReference().withFullyQualifiedName(domainMap.get(FQN_FIELD).toString()));
        }
      }
    }
    return domainRefs;
  }

  private static Set<String> reachableFromRoot(
      SearchLineageResult result, Set<String> visible, String rootFqn) {
    Set<String> reachable = new HashSet<>();
    if (visible.contains(rootFqn)) {
      Map<String, Set<String>> adjacency = buildAdjacency(result, visible);
      Deque<String> queue = new ArrayDeque<>();
      queue.add(rootFqn);
      reachable.add(rootFqn);
      while (!queue.isEmpty()) {
        for (String neighbor : adjacency.getOrDefault(queue.poll(), Set.of())) {
          if (reachable.add(neighbor)) {
            queue.add(neighbor);
          }
        }
      }
    }
    return reachable;
  }

  private static Map<String, Set<String>> buildAdjacency(
      SearchLineageResult result, Set<String> visible) {
    Map<String, Set<String>> adjacency = new HashMap<>();
    List<EsLineageData> edges = new ArrayList<>();
    edges.addAll(edgesOf(result.getUpstreamEdges()));
    edges.addAll(edgesOf(result.getDownstreamEdges()));
    for (EsLineageData edge : edges) {
      linkVisibleEndpoints(
          adjacency, visible, edgeFqn(edge.getFromEntity()), edgeFqn(edge.getToEntity()));
    }
    return adjacency;
  }

  private static Collection<EsLineageData> edgesOf(Map<String, EsLineageData> edges) {
    return edges == null ? Collections.emptyList() : edges.values();
  }

  private static void linkVisibleEndpoints(
      Map<String, Set<String>> adjacency, Set<String> visible, String from, String to) {
    if (from != null && to != null && visible.contains(from) && visible.contains(to)) {
      adjacency.computeIfAbsent(from, key -> new HashSet<>()).add(to);
      adjacency.computeIfAbsent(to, key -> new HashSet<>()).add(from);
    }
  }

  private static void retainEdges(SearchLineageResult result, Set<String> keep) {
    edgesOf(result.getUpstreamEdges()).removeIf(edge -> !edgeKept(edge, keep));
    edgesOf(result.getDownstreamEdges()).removeIf(edge -> !edgeKept(edge, keep));
  }

  private static boolean edgeKept(EsLineageData edge, Set<String> keep) {
    String from = edgeFqn(edge.getFromEntity());
    String to = edgeFqn(edge.getToEntity());
    return from != null && to != null && keep.contains(from) && keep.contains(to);
  }

  private static String edgeFqn(RelationshipRef ref) {
    return ref == null ? null : ref.getFullyQualifiedName();
  }
}
