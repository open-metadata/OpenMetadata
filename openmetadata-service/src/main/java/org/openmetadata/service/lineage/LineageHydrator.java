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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.HydrateLineageRequest;
import org.openmetadata.schema.api.lineage.HydrateLineageResponse;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
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
public class LineageHydrator {

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
              request.getFields(),
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

  private <T extends EntityInterface> List<T> hydrateAndAuthorize(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String entityType,
      List<UUID> ids,
      String fieldsParam,
      Include include,
      EntityRepository<T> repo) {
    Fields fields = repo.getFields(fieldsParam);
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

  /**
   * Return {@code true} when the resolved permission set explicitly allows VIEW_BASIC on the
   * resource (either unconditionally or conditionally — both let the caller read the entity).
   */
  private static boolean isViewBasicAllowed(ResourcePermission permission) {
    for (Permission p : permission.getPermissions()) {
      if (p.getOperation() == MetadataOperation.VIEW_BASIC) {
        Access access = p.getAccess();
        return access == Access.ALLOW || access == Access.CONDITIONAL_ALLOW;
      }
    }
    return false;
  }
}
