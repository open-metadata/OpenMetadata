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

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.api.lineage.HydrateLineageRequest;
import org.openmetadata.schema.api.lineage.HydrateLineageResponse;
import org.openmetadata.schema.api.lineage.RelationshipRef;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Bulk-hydrate lineage nodes into full entity objects with per-entity VIEW_BASIC authorization.
 *
 * <p>The lineage UI consumes a graph of {@link EntityReference}s and used to issue one
 * {@code GET /{type}/{id}} per node to hydrate each into its concrete entity. On a 50-node graph
 * that's 50 sequential auth + cache + DB round-trips before first paint. This class folds those N
 * requests into one server-side pass:
 *
 * <ol>
 *   <li>Bucket ids by entityType so each type goes through its own repository exactly once
 *       ({@link EntityRepository#get(UriInfo, List, Fields, Include)}).
 *   <li>For each bucket, walk the loaded entities and drop the ones the caller can't
 *       {@link MetadataOperation#VIEW_BASIC}. Auth uses the entity-aware
 *       {@link ResourceContext#ResourceContext(String, EntityInterface, EntityRepository)
 *       constructor} so {@code authorizer.getPermission} sees a pre-resolved entity — no second
 *       repository fetch (or parent lookup, for glossary terms / tags / data products) per id.
 *   <li>Drops are <i>silent</i>: not-found ids and denied entities both vanish from the response.
 *       The aggregate count surfaces in {@link HydrateLineageResponse#getDroppedCount}.
 * </ol>
 *
 * <p>Silent-drop matches normal GET semantics — a user who can't see entity X just doesn't see it
 * on the page; the page-load doesn't fail. The dropped count lets the UI surface "N items hidden
 * by permissions" instead of swallowing that information completely.
 *
 * <p>This class is stateless apart from the injected {@link Authorizer}; safe to share across
 * threads.
 */
@Slf4j
public class LineageHydrator {
  private static final String LINEAGE_SCENE_SYNTHETIC_COUNT = "lineageSceneSyntheticCount";
  private static final String AUTHORIZATION_FIELDS =
      String.join(
          ",",
          Entity.FIELD_OWNERS,
          Entity.FIELD_TAGS,
          Entity.FIELD_DOMAINS,
          Entity.FIELD_REVIEWERS);

  private final Authorizer authorizer;

  public LineageHydrator(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  /**
   * Validate, group, hydrate, authorize.
   *
   * @throws IllegalArgumentException if {@code request} is null, the entities list is empty, or
   *     any entry has a blank {@code type} or missing {@code id}.
   */
  public HydrateLineageResponse hydrate(
      UriInfo uriInfo, SecurityContext securityContext, HydrateLineageRequest request) {
    if (request == null || nullOrEmpty(request.getEntities())) {
      throw new IllegalArgumentException("entities is required and non-empty");
    }
    Map<String, List<UUID>> idsByType = groupIdsByType(request.getEntities());
    int requestedCount = idsByType.values().stream().mapToInt(List::size).sum();
    Include include = request.getInclude() == null ? Include.NON_DELETED : request.getInclude();
    Map<String, List<Object>> entitiesByType = new LinkedHashMap<>(idsByType.size());
    int returnedCount = 0;
    for (Map.Entry<String, List<UUID>> entry : idsByType.entrySet()) {
      List<? extends EntityInterface> hydrated =
          hydrateAndAuthorize(
              uriInfo,
              securityContext,
              entry.getKey(),
              entry.getValue(),
              Entity.getEntityRepository(entry.getKey()).getFields(request.getFields()),
              include,
              Entity.getEntityRepository(entry.getKey()));
      if (!hydrated.isEmpty()) {
        entitiesByType.put(entry.getKey(), new ArrayList<>(hydrated));
        returnedCount += hydrated.size();
      }
    }
    return new HydrateLineageResponse()
        .withEntitiesByType(entitiesByType)
        .withDroppedCount(requestedCount - returnedCount);
  }

  /**
   * Removes lineage nodes the caller cannot VIEW_BASIC and every edge touching a removed node.
   * Synthetic counts may be retained only when their search aggregation was restricted to the
   * caller's authorized domains. Other nodes without a resolvable entity identity are removed.
   */
  public SearchLineageResult pruneUnauthorizedLineage(
      SecurityContext securityContext,
      SearchLineageResult lineage,
      Include include,
      boolean preserveSyntheticCounts) {
    if (lineage == null || nullOrEmpty(lineage.getNodes())) {
      return lineage;
    }
    List<LineageNode> candidates = lineageNodes(lineage.getNodes());
    Set<EntityKey> authorized = authorizeLineageNodes(securityContext, candidates, include);
    Set<String> visibleNodeKeys =
        preserveSyntheticCounts ? syntheticCountNodeKeys(lineage.getNodes()) : new HashSet<>();
    for (LineageNode candidate : candidates) {
      if (authorized.contains(candidate.entityKey())) {
        visibleNodeKeys.add(candidate.nodeKey());
      }
    }
    lineage.getNodes().keySet().retainAll(visibleNodeKeys);
    retainAuthorizedEdges(lineage.getUpstreamEdges(), authorized);
    retainAuthorizedEdges(lineage.getDownstreamEdges(), authorized);
    return lineage;
  }

  private static Set<String> syntheticCountNodeKeys(Map<String, NodeInformation> nodes) {
    Set<String> nodeKeys = new HashSet<>();
    for (Map.Entry<String, NodeInformation> entry : nodes.entrySet()) {
      NodeInformation nodeInformation = entry.getValue();
      Map<String, Object> entity = nodeInformation == null ? null : nodeInformation.getEntity();
      if (entity != null && isSyntheticCount(entity.get(LINEAGE_SCENE_SYNTHETIC_COUNT))) {
        nodeKeys.add(entry.getKey());
      }
    }
    return nodeKeys;
  }

  private static boolean isSyntheticCount(Object value) {
    return Boolean.TRUE.equals(value) || "true".equalsIgnoreCase(String.valueOf(value));
  }

  private static Map<String, List<UUID>> groupIdsByType(List<EntityReference> refs) {
    Map<String, LinkedHashSet<UUID>> uniqueIdsByType = new LinkedHashMap<>();
    for (EntityReference ref : refs) {
      if (ref == null || ref.getType() == null || ref.getType().isBlank() || ref.getId() == null) {
        throw new IllegalArgumentException("each entity must have non-blank type and non-null id");
      }
      uniqueIdsByType.computeIfAbsent(ref.getType(), k -> new LinkedHashSet<>()).add(ref.getId());
    }
    Map<String, List<UUID>> idsByType = new LinkedHashMap<>(uniqueIdsByType.size());
    uniqueIdsByType.forEach((type, ids) -> idsByType.put(type, new ArrayList<>(ids)));
    return idsByType;
  }

  private Set<EntityKey> authorizeLineageNodes(
      SecurityContext securityContext, List<LineageNode> nodes, Include include) {
    Map<String, List<UUID>> idsByType = groupLineageIdsByType(nodes);
    Set<EntityKey> authorized = new HashSet<>();
    for (Map.Entry<String, List<UUID>> entry : idsByType.entrySet()) {
      authorizeLineageType(securityContext, include, authorized, entry);
    }
    return authorized;
  }

  private void authorizeLineageType(
      SecurityContext securityContext,
      Include include,
      Set<EntityKey> authorized,
      Map.Entry<String, List<UUID>> entry) {
    try {
      EntityRepository<? extends EntityInterface> repository =
          Entity.getEntityRepository(entry.getKey());
      Fields fields = repository.getOnlySupportedFields(AUTHORIZATION_FIELDS);
      List<? extends EntityInterface> entities =
          hydrateAndAuthorize(
              null, securityContext, entry.getKey(), entry.getValue(), fields, include, repository);
      for (EntityInterface entity : entities) {
        authorized.add(new EntityKey(entry.getKey(), entity.getId()));
      }
    } catch (EntityNotFoundException exception) {
      LOG.warn("Skipping lineage nodes with unsupported entity type '{}'.", entry.getKey());
    }
  }

  private <T extends EntityInterface> List<T> hydrateAndAuthorize(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String entityType,
      List<UUID> ids,
      Fields fields,
      Include include,
      EntityRepository<T> repo) {
    List<T> entities = repo.get(uriInfo, ids, fields, include);
    String userName = securityContext.getUserPrincipal().getName();
    List<T> authorized = new ArrayList<>(entities.size());
    for (T entity : entities) {
      ResourceContext<T> resourceContext = new ResourceContext<>(entityType, entity, repo);
      ResourcePermission permission =
          authorizer.getPermission(securityContext, userName, resourceContext);
      if (isViewBasicAllowed(permission)) {
        authorized.add(entity);
      }
    }
    return authorized;
  }

  private static List<LineageNode> lineageNodes(Map<String, NodeInformation> nodes) {
    List<LineageNode> lineageNodes = new ArrayList<>(nodes.size());
    for (Map.Entry<String, NodeInformation> entry : nodes.entrySet()) {
      Map<String, Object> entity = entry.getValue() == null ? null : entry.getValue().getEntity();
      LineageNode node = lineageNode(entry.getKey(), entity);
      if (node != null) {
        lineageNodes.add(node);
      }
    }
    return lineageNodes;
  }

  private static LineageNode lineageNode(String nodeKey, Map<String, Object> entity) {
    if (entity == null) {
      return null;
    }
    String type = stringValue(entity, "entityType");
    if (nullOrEmpty(type)) {
      type = stringValue(entity, "type");
    }
    String fqn = stringValue(entity, "fullyQualifiedName");
    UUID id = uuidValue(entity.get("id"));
    return nullOrEmpty(type) || nullOrEmpty(fqn) || id == null
        ? null
        : new LineageNode(nodeKey, new EntityKey(type, id));
  }

  private static Map<String, List<UUID>> groupLineageIdsByType(List<LineageNode> nodes) {
    Map<String, LinkedHashSet<UUID>> uniqueIdsByType = new LinkedHashMap<>();
    for (LineageNode node : nodes) {
      uniqueIdsByType
          .computeIfAbsent(node.entityKey().type(), ignored -> new LinkedHashSet<>())
          .add(node.entityKey().id());
    }
    Map<String, List<UUID>> idsByType = new LinkedHashMap<>(uniqueIdsByType.size());
    uniqueIdsByType.forEach((type, ids) -> idsByType.put(type, new ArrayList<>(ids)));
    return idsByType;
  }

  private static void retainAuthorizedEdges(
      Map<String, EsLineageData> edges, Set<EntityKey> authorized) {
    if (edges != null) {
      edges.values().removeIf(edge -> !isAuthorizedEdge(edge, authorized));
    }
  }

  private static boolean isAuthorizedEdge(EsLineageData edge, Set<EntityKey> authorized) {
    return edge != null
        && authorized.contains(entityKey(edge.getFromEntity()))
        && authorized.contains(entityKey(edge.getToEntity()));
  }

  private static EntityKey entityKey(RelationshipRef ref) {
    return ref == null || nullOrEmpty(ref.getType()) || ref.getId() == null
        ? null
        : new EntityKey(ref.getType(), ref.getId());
  }

  private static String stringValue(Map<String, Object> entity, String field) {
    Object value = entity.get(field);
    return value == null ? null : value.toString();
  }

  private static UUID uuidValue(Object value) {
    if (value instanceof UUID id) {
      return id;
    }
    try {
      return value == null ? null : UUID.fromString(value.toString());
    } catch (IllegalArgumentException ignored) {
      return null;
    }
  }

  /**
   * Return {@code true} when the resolved permission set explicitly allows VIEW_BASIC on the
   * resource (either unconditionally or conditionally — both let the caller read the entity).
   */
  private static boolean isViewBasicAllowed(ResourcePermission permission) {
    if (permission == null || nullOrEmpty(permission.getPermissions())) {
      return false;
    }
    for (Permission p : permission.getPermissions()) {
      if (p.getOperation() == MetadataOperation.VIEW_BASIC) {
        Access access = p.getAccess();
        return access == Access.ALLOW || access == Access.CONDITIONAL_ALLOW;
      }
    }
    return false;
  }

  private record EntityKey(String type, UUID id) {}

  private record LineageNode(String nodeKey, EntityKey entityKey) {}
}
