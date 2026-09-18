package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

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
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.BulkFieldHydrator;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Drops lineage nodes the caller cannot {@link MetadataOperation#VIEW_BASIC}.
 *
 * <p>Authorizing the root entity is not enough. A lineage node carries its neighbour's fully
 * qualified name, display name, type and description, so a caller under a policy such as {@code Deny
 * + !matchAnyTag('X')} - allowed to read the one tagged asset, denied everything else - would
 * otherwise receive the identity of exactly the assets the policy exists to hide.
 *
 * <p>Each node is checked with the same {@code authorize} call the root gets, so a node decision can
 * never diverge from a root decision on the same entity. {@code authorize} rather than {@code
 * getPermission}: the latter evaluates every {@link MetadataOperation}, re-running each policy
 * condition per operation, to answer one yes/no - and it reports a conditional rule as
 * CONDITIONAL_ALLOW, which a filter must not read as "allowed".
 *
 * <p><b>Cost.</b> {@code DefaultAuthorizer.authorize} resolves the entity before any policy runs
 * (its reviewer check reads it), so a lazily-built {@code ResourceContext} per node would be an N+1
 * of entity loads. Nodes are therefore bucketed by type, loaded one batch per type with exactly the
 * fields authorization reads, and handed to the pre-resolved {@code ResourceContext} so the
 * authorizer re-fetches nothing. Tags have unbounded cardinality and are excluded from that set, so
 * they are batch-loaded through a {@link BulkFieldHydrator} the first time a policy actually reads
 * them - a deployment with no tag conditions never pays for them. This mirrors {@link
 * LineageHydrator}, which solved the same N+1 for the REST hydrate endpoint.
 *
 * <p><b>Failure is closed.</b> Denied nodes, nodes whose check throws, and nodes past {@link
 * #MAX_FILTERED_NODES} are all treated as not viewable and removed. A filter that returned an
 * unchecked graph would hand the caller precisely what it exists to withhold, so no path here
 * returns a node without a decision.
 */
@Slf4j
public class LineagePermissionFilter {

  /**
   * Ceiling on nodes to authorize in one request. Batching makes the common graph cheap, but a hub
   * asset at max depth can still reach thousands of nodes and each one costs a policy evaluation.
   * Nodes past this limit are <b>removed</b>, never returned unchecked, and {@link
   * Result#hiddenUnchecked()} reports that the ceiling was reached.
   */
  private static final int MAX_FILTERED_NODES = 500;

  /**
   * The pruned graph, plus what has to be said about it. {@code hiddenNodes} counts every node
   * removed - denied, cut off behind a denied one, or past the ceiling - while {@code
   * uncheckedNodes} counts only the last group, so a message can name each accurately instead of
   * attributing every removal to the ceiling.
   */
  public record Result(EntityLineage lineage, int hiddenNodes, int uncheckedNodes) {
    static Result unchanged(EntityLineage lineage) {
      return new Result(lineage, 0, 0);
    }

    public boolean hiddenUnchecked() {
      return uncheckedNodes > 0;
    }
  }

  private final Authorizer authorizer;

  public LineagePermissionFilter(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  public Result filter(
      SecurityContext securityContext, SubjectContext subjectContext, EntityLineage lineage) {
    if (lineage == null || nullOrEmpty(lineage.getNodes()) || isAdmin(subjectContext)) {
      return Result.unchanged(lineage);
    }
    List<EntityReference> nodes = List.copyOf(lineage.getNodes());
    List<EntityReference> checkable = withinCeiling(nodes);
    Set<UUID> visible = visibleIds(securityContext, checkable);
    // The root is already authorized by the caller; re-checking it could only prune the graph the
    // caller was just granted.
    visible.add(lineage.getEntity().getId());
    int hidden = LineageGraphPruner.retainReachable(lineage, visible);
    return new Result(lineage, hidden, nodes.size() - checkable.size());
  }

  /**
   * The nodes this request will actually authorize. Anything past the ceiling is left out, which
   * makes it invisible rather than unchecked-but-returned - the caller controls depth, so a
   * returned-unchecked branch would be a way to ask for the unfiltered graph.
   */
  private static List<EntityReference> withinCeiling(List<EntityReference> nodes) {
    if (nodes.size() <= MAX_FILTERED_NODES) {
      return nodes;
    }
    LOG.warn(
        "Lineage graph has {} nodes; authorizing the first {} and hiding the remainder unchecked",
        nodes.size(),
        MAX_FILTERED_NODES);
    return nodes.subList(0, MAX_FILTERED_NODES);
  }

  /**
   * Whether the caller may view one reference that is not a graph node - an edge's pipeline, say.
   * Never throws; anything other than a clear allow is a deny.
   */
  public boolean canView(SecurityContext securityContext, EntityReference reference) {
    return reference != null
        && reference.getType() != null
        && authorizeQuietly(securityContext, reference, null);
  }

  /**
   * Only admins bypass. {@code DefaultAuthorizer.authorize} short-circuits admins alone - a bot's
   * root entity is policy-evaluated in full - so exempting bots here would let a tag-scoped bot read
   * neighbours that {@code get_entity_details} denies it.
   */
  private static boolean isAdmin(SubjectContext subjectContext) {
    return subjectContext != null && subjectContext.isAdmin();
  }

  private Set<UUID> visibleIds(SecurityContext securityContext, List<EntityReference> nodes) {
    Set<UUID> visible = new HashSet<>();
    bucketByType(nodes)
        .forEach((type, refs) -> addVisibleFromBucket(securityContext, type, refs, visible));
    return visible;
  }

  /** One batch load and one hydrator per entity type, so cost scales with types, not nodes. */
  private <T extends EntityInterface> void addVisibleFromBucket(
      SecurityContext securityContext,
      String entityType,
      List<EntityReference> refs,
      Set<UUID> visible) {
    EntityRepository<T> repository = repositoryOrNull(entityType);
    if (repository == null) {
      return;
    }
    List<T> entities = loadForAuthorization(repository, entityType, refs);
    BulkFieldHydrator hydrator = tagHydrator(repository, entities);
    for (T entity : entities) {
      ResourceContext<T> context = new ResourceContext<>(entityType, entity, repository, hydrator);
      if (authorizeQuietly(securityContext, entity.getEntityReference(), context)) {
        visible.add(entity.getId());
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
      // No repository means no decision for the whole bucket, so none of its nodes may be returned.
      LOG.warn("Hiding all '{}' lineage nodes: no repository: {}", entityType, e.getMessage());
    }
    return repository;
  }

  private <T extends EntityInterface> List<T> loadForAuthorization(
      EntityRepository<T> repository, String entityType, List<EntityReference> refs) {
    List<T> entities = List.of();
    List<UUID> ids = refs.stream().map(EntityReference::getId).filter(Objects::nonNull).toList();
    try {
      // Include.ALL: a soft-deleted node still needs its policy evaluated rather than resolving to
      // nothing and re-entering the unloaded-attribute failure mode.
      List<T> loaded =
          repository.get(null, ids, ResourceContext.authorizationFields(repository), Include.ALL);
      entities = loaded == null ? List.of() : loaded;
    } catch (RuntimeException e) {
      LOG.warn(
          "Hiding all '{}' lineage nodes: authorization load failed: {}",
          entityType,
          e.getMessage());
    }
    return entities;
  }

  /**
   * Broad on purpose, against the usual no-catch-RuntimeException rule: this is a fail-closed
   * security decision, and one malformed node - a null type reaching a {@code @NonNull} parameter, a
   * bad SpEL condition in a policy - must hide that node rather than fail the caller's request.
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
      LOG.debug("Hiding lineage reference {}: {}", reference.getId(), e.getMessage());
    }
    return viewable;
  }

  private static ResourceContext<?> lazyContext(EntityReference reference) {
    return new ResourceContext<>(
        reference.getType(), reference.getId(), reference.getFullyQualifiedName());
  }

  private static Map<String, List<EntityReference>> bucketByType(List<EntityReference> nodes) {
    Map<String, List<EntityReference>> byType = new LinkedHashMap<>();
    for (EntityReference node : nodes) {
      if (node != null && node.getType() != null && node.getId() != null) {
        byType.computeIfAbsent(node.getType(), key -> new ArrayList<>()).add(node);
      }
    }
    byType.replaceAll((type, refs) -> new ArrayList<>(new LinkedHashSet<>(refs)));
    return byType;
  }
}
