package org.openmetadata.service.security;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.policyevaluator.BulkFieldHydrator;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Decides which of many entity references the caller may {@link MetadataOperation#VIEW_BASIC}, for
 * responses that mix entities the caller asked about with others they did not: lineage neighbours,
 * activity feeds.
 *
 * <p>Each reference is checked with the same {@code authorize} call a direct read gets, so a
 * decision here can never diverge from one on the entity itself. {@code authorize} rather than
 * {@code getPermission}: the latter evaluates every {@link MetadataOperation}, re-running each
 * policy condition per operation, to answer one yes/no - and it reports a conditional rule as
 * CONDITIONAL_ALLOW, which a filter must not read as "allowed".
 *
 * <p><b>Cost.</b> {@code DefaultAuthorizer.authorize} resolves the entity before any policy runs
 * (its reviewer check reads it), so a lazily-built {@code ResourceContext} per reference would be an
 * N+1 of entity loads. References are therefore bucketed by type, loaded one batch per type with
 * exactly the fields authorization reads, and handed to the pre-resolved {@code ResourceContext} so
 * the authorizer re-fetches nothing. Tags have unbounded cardinality and are excluded from that set,
 * so they are batch-loaded through a {@link BulkFieldHydrator} the first time a policy actually
 * reads them - a deployment with no tag conditions never pays for them.
 *
 * <p><b>Failure is closed.</b> Denied references and references whose check throws are both
 * treated as not viewable. Admins are not exempted here; callers that know the subject skip the
 * filter for them.
 */
@Slf4j
public class ViewPermissionFilter {

  private final Authorizer authorizer;

  public ViewPermissionFilter(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  /** Ids of the {@code references} the caller may view. Never throws. */
  public Set<UUID> viewableIds(SecurityContext securityContext, List<EntityReference> references) {
    Set<UUID> viewable = new HashSet<>();
    bucketByType(references)
        .forEach((type, refs) -> addViewableFromBucket(securityContext, type, refs, viewable));
    return viewable;
  }

  /** Whether the caller may view one reference. Never throws; anything but a clear allow denies. */
  public boolean canView(SecurityContext securityContext, EntityReference reference) {
    return reference != null
        && reference.getType() != null
        && authorizeQuietly(securityContext, reference, null);
  }

  /** One batch load and one hydrator per entity type, so cost scales with types, not references. */
  private <T extends EntityInterface> void addViewableFromBucket(
      SecurityContext securityContext,
      String entityType,
      List<EntityReference> refs,
      Set<UUID> viewable) {
    EntityRepository<T> repository = repositoryOrNull(entityType);
    if (repository == null) {
      return;
    }
    List<T> entities = loadForAuthorization(repository, entityType, refs);
    BulkFieldHydrator hydrator = tagHydrator(repository, entities);
    for (T entity : entities) {
      ResourceContext<T> context = new ResourceContext<>(entityType, entity, repository, hydrator);
      if (authorizeQuietly(securityContext, entity.getEntityReference(), context)) {
        viewable.add(entity.getId());
      }
    }
  }

  private <T extends EntityInterface> BulkFieldHydrator tagHydrator(
      EntityRepository<T> repository, List<T> entities) {
    return new BulkFieldHydrator(
        Map.of(Entity.FIELD_TAGS, () -> repository.batchLoadTags(new ArrayList<>(entities))));
  }

  @SuppressWarnings("unchecked")
  private <T extends EntityInterface> EntityRepository<T> repositoryOrNull(String entityType) {
    EntityRepository<T> repository = null;
    try {
      repository = (EntityRepository<T>) Entity.getEntityRepository(entityType);
    } catch (RuntimeException e) {
      // No repository means no decision for the whole bucket, so none of its references survive.
      LOG.warn("Hiding all '{}' references: no repository: {}", entityType, e.getMessage());
    }
    return repository;
  }

  private <T extends EntityInterface> List<T> loadForAuthorization(
      EntityRepository<T> repository, String entityType, List<EntityReference> refs) {
    List<T> entities = List.of();
    List<UUID> ids = refs.stream().map(EntityReference::getId).filter(Objects::nonNull).toList();
    try {
      // Include.ALL: a soft-deleted entity still needs its policy evaluated rather than resolving
      // to nothing and re-entering the unloaded-attribute failure mode.
      List<T> loaded =
          repository.get(null, ids, ResourceContext.authorizationFields(repository), Include.ALL);
      entities = loaded == null ? List.of() : loaded;
    } catch (RuntimeException e) {
      LOG.warn(
          "Hiding all '{}' references: authorization load failed: {}", entityType, e.getMessage());
    }
    return entities;
  }

  /**
   * Broad on purpose, against the usual no-catch-RuntimeException rule: this is a fail-closed
   * security decision, and one malformed reference - a null type reaching a {@code @NonNull}
   * parameter, a bad SpEL condition in a policy - must hide that reference rather than fail the
   * caller's request.
   */
  private boolean authorizeQuietly(
      SecurityContext securityContext, EntityReference reference, ResourceContext<?> resolved) {
    boolean viewable = false;
    try {
      authorizer.authorize(
          securityContext,
          // OperationContext is stateful - it drops operations as they are satisfied - so each
          // decision needs its own.
          new OperationContext(reference.getType(), MetadataOperation.VIEW_BASIC),
          resolved != null ? resolved : lazyContext(reference));
      viewable = true;
    } catch (RuntimeException e) {
      LOG.debug("Hiding reference {}: {}", reference.getId(), e.getMessage());
    }
    return viewable;
  }

  private static ResourceContext<?> lazyContext(EntityReference reference) {
    return new ResourceContext<>(
        reference.getType(), reference.getId(), reference.getFullyQualifiedName());
  }

  private static Map<String, List<EntityReference>> bucketByType(List<EntityReference> refs) {
    Map<String, List<EntityReference>> byType = new LinkedHashMap<>();
    for (EntityReference ref : refs) {
      if (ref != null && ref.getType() != null && ref.getId() != null) {
        byType.computeIfAbsent(ref.getType(), key -> new ArrayList<>()).add(ref);
      }
    }
    byType.replaceAll((type, typed) -> new ArrayList<>(new LinkedHashSet<>(typed)));
    return byType;
  }
}
