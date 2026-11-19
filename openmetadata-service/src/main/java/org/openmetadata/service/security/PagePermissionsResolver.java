package org.openmetadata.service.security;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.policyevaluator.BulkFieldHydrator;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Resolves each row's {@link ResourcePermission} for one page of a list response.
 *
 * <p>The rows the page returns are serialized as they were loaded, so the entities the decision
 * reads are loaded separately with exactly the attributes authorization needs ({@link
 * ResourceContext#authorizationFields}). Hydrating the response rows instead would add owners and
 * domains to JSON the caller never asked for.
 *
 * <p>One batch load plus one {@link BulkFieldHydrator} per page keeps the cost proportional to
 * pages rather than rows, mirroring {@code LineagePermissionFilter}, which solved the same N+1 for
 * lineage nodes. A row the batch could not resolve falls back to the lazy per-id context so the map
 * always describes every row the page returned.
 */
public final class PagePermissionsResolver {

  private PagePermissionsResolver() {}

  public static <T extends EntityInterface> Map<String, ResourcePermission> resolve(
      Authorizer authorizer,
      SecurityContext securityContext,
      String entityType,
      EntityRepository<T> repository,
      List<T> page) {
    List<UUID> ids = idsOf(page);
    if (ids.isEmpty()) {
      return Map.of();
    }
    String user = securityContext.getUserPrincipal().getName();
    Map<UUID, T> resolved = loadForAuthorization(repository, ids);
    BulkFieldHydrator hydrator = tagHydrator(repository, resolved.values());
    Map<String, ResourcePermission> permissions = new LinkedHashMap<>();
    for (UUID id : ids) {
      ResourceContext<T> context =
          contextFor(entityType, repository, resolved.get(id), id, hydrator);
      permissions.put(id.toString(), authorizer.getPermission(securityContext, user, context));
    }
    return permissions;
  }

  private static <T extends EntityInterface> List<UUID> idsOf(List<T> page) {
    if (page == null) {
      return List.of();
    }
    return page.stream().map(EntityInterface::getId).filter(Objects::nonNull).distinct().toList();
  }

  /**
   * Include.ALL: a soft-deleted row still needs its policy evaluated rather than resolving to
   * nothing and leaving every conditional rule reading an absent attribute.
   */
  private static <T extends EntityInterface> Map<UUID, T> loadForAuthorization(
      EntityRepository<T> repository, List<UUID> ids) {
    List<T> entities =
        repository.get(null, ids, ResourceContext.authorizationFields(repository), Include.ALL);
    if (entities == null) {
      return Map.of();
    }
    return entities.stream()
        .collect(
            Collectors.toMap(EntityInterface::getId, entity -> entity, (first, second) -> first));
  }

  private static <T extends EntityInterface> BulkFieldHydrator tagHydrator(
      EntityRepository<T> repository, Collection<T> entities) {
    return new BulkFieldHydrator(
        Map.of(Entity.FIELD_TAGS, () -> repository.batchLoadTags(new ArrayList<>(entities))));
  }

  private static <T extends EntityInterface> ResourceContext<T> contextFor(
      String entityType,
      EntityRepository<T> repository,
      T resolved,
      UUID id,
      BulkFieldHydrator hydrator) {
    return resolved != null
        ? new ResourceContext<>(entityType, resolved, repository, hydrator)
        : new ResourceContext<>(entityType, id, null);
  }
}
