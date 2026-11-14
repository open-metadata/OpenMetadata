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
import org.openmetadata.schema.type.lineage.NodeInformation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ViewOperations;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Bulk-hydrate lineage nodes into full entity objects with per-entity read authorization.
 *
 * <p>The lineage UI consumes a graph of {@link EntityReference}s and used to issue one
 * {@code GET /{type}/{id}} per node to hydrate each into its concrete entity. On a 50-node graph
 * that's 50 sequential auth + cache + DB round-trips before first paint. This class folds those N
 * requests into one server-side pass:
 *
 * <ol>
 *   <li>Bucket ids by entityType so each type goes through its own repository exactly once
 *       ({@link EntityRepository#get(UriInfo, List, Fields, Include)}).
 *   <li>For each bucket, load the entities with every attribute a policy condition reads and drop
 *       the ones the caller may not read with the requested fields (the view operations a GET of
 *       those fields needs, from {@link ViewOperations}); the survivors are trimmed back to the
 *       requested fields. The decision runs on the loaded entities, so nothing is fetched twice.
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

  /**
   * The data assets lineage draws as nodes. Their own GET returns the stored entity trimmed to the
   * requested fields and redacts nothing, so authorizing and trimming here answers as that GET
   * would. Every other type is refused: a service's connection, a user's credentials and email, an
   * MCP server's environment are redacted only by their own GET
   * (ADR:2026-11-03-every-read-path-checks-the-fields-it-returns).
   */
  private static final Set<String> HYDRATABLE_TYPES =
      Set.of(
          Entity.TABLE,
          Entity.TOPIC,
          Entity.DASHBOARD,
          Entity.DASHBOARD_DATA_MODEL,
          Entity.CHART,
          Entity.PIPELINE,
          Entity.MLMODEL,
          Entity.CONTAINER,
          Entity.SEARCH_INDEX,
          Entity.STORED_PROCEDURE,
          Entity.API_ENDPOINT,
          Entity.METRIC,
          Entity.DIRECTORY,
          Entity.FILE,
          Entity.SPREADSHEET,
          Entity.WORKSHEET);

  private final ViewPermissionFilter viewPermissionFilter;

  public LineageHydrator(Authorizer authorizer) {
    this.viewPermissionFilter = new ViewPermissionFilter(authorizer);
  }

  /**
   * Validate, group, hydrate, authorize.
   *
   * @throws IllegalArgumentException if {@code request} is null, the entities list is empty, or
   *     any entry has a blank {@code type}, a missing {@code id} or a type that is not a lineage
   *     data asset.
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
      EntityRepository<? extends EntityInterface<?>> repository =
          Entity.getEntityRepository(entry.getKey());
      List<? extends EntityInterface<?>> hydrated =
          hydrateAndAuthorize(
              uriInfo,
              securityContext,
              entry.getKey(),
              entry.getValue(),
              repository.getFields(request.getFields()),
              include,
              repository);
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
      requireHydratable(ref.getType());
      uniqueIdsByType.computeIfAbsent(ref.getType(), k -> new LinkedHashSet<>()).add(ref.getId());
    }
    Map<String, List<UUID>> idsByType = new LinkedHashMap<>(uniqueIdsByType.size());
    uniqueIdsByType.forEach((type, ids) -> idsByType.put(type, new ArrayList<>(ids)));
    return idsByType;
  }

  private static void requireHydratable(String entityType) {
    if (!HYDRATABLE_TYPES.contains(entityType)) {
      throw new IllegalArgumentException(
          String.format(
              "Entity type '%s' cannot be hydrated: hydrate serves lineage data assets only, so read"
                  + " it from its own endpoint",
              entityType));
    }
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
      EntityRepository<? extends EntityInterface<?>> repository =
          Entity.getEntityRepository(entry.getKey());
      List<? extends EntityInterface<?>> entities =
          hydrateAndAuthorize(
              null,
              securityContext,
              entry.getKey(),
              entry.getValue(),
              Fields.EMPTY_FIELDS,
              include,
              repository);
      for (EntityInterface<?> entity : entities) {
        authorized.add(new EntityKey(entry.getKey(), entity.getId()));
      }
    } catch (EntityNotFoundException exception) {
      LOG.warn("Skipping lineage nodes with unsupported entity type '{}'.", entry.getKey());
    }
  }

  /**
   * The entities of {@code ids} the caller may read with {@code fields}, as a GET with those fields
   * would return them: loaded with every attribute a condition reads, checked for the view
   * operations the fields need, and trimmed back to {@code fields}
   * (ADR:2026-11-03-every-read-path-checks-the-fields-it-returns).
   */
  private <T extends EntityInterface<?>> List<T> hydrateAndAuthorize(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String entityType,
      List<UUID> ids,
      Fields fields,
      Include include,
      EntityRepository<T> repo) {
    List<T> entities =
        repo.get(uriInfo, ids, ResourceContext.authorizationFields(repo, fields), include);
    List<T> permitted =
        viewPermissionFilter.retainPermitted(
            securityContext,
            entityType,
            repo,
            entities,
            ViewOperations.forFields(entityType, fields));
    permitted.forEach(entity -> repo.clearFieldsInternal(entity, fields));
    return permitted;
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

  private record EntityKey(String type, UUID id) {}

  private record LineageNode(String nodeKey, EntityKey entityKey) {}
}
