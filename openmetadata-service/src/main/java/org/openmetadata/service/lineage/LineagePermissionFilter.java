package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Drops lineage nodes the caller cannot {@link MetadataOperation#VIEW_BASIC}.
 *
 * <p>Authorizing the root entity is not enough. A lineage node carries its neighbour's fully
 * qualified name, display name, type and description, and its edges carry column-level lineage and
 * (on request) the transformation SQL. A caller under a policy such as {@code Deny +
 * !matchAnyTag('X')} is allowed to read the one tagged asset and denied everything else, so
 * returning its unfiltered graph hands them the identity of assets the policy exists to hide.
 *
 * <p>Each node is checked with the same {@code authorize} call the root gets, so a node decision
 * can never diverge from a root decision on the same entity. {@code authorize} rather than {@code
 * getPermission}: it keeps the admin/bot short-circuit, and {@code getPermission} would evaluate
 * every {@link MetadataOperation} - re-running each policy condition per operation - to answer one
 * yes/no.
 *
 * <p>Denied nodes are dropped, not raised as errors: a graph the caller can partly see is still
 * useful, and failing the whole call would make lineage unusable under any entity-scoped policy.
 * The count is returned so the caller can say so rather than presenting a pruned graph as complete.
 */
@Slf4j
public class LineagePermissionFilter {

  /**
   * Above this many nodes the per-node checks stop being worth their latency on a hub asset. The
   * graph is returned unfiltered and {@link Result#filterSkipped()} is set, so the caller reports
   * "not filtered" instead of implying a filtered result.
   */
  private static final int MAX_FILTERED_NODES = 500;

  /** The pruned graph, plus what had to be said about it. */
  public record Result(EntityLineage lineage, int hiddenNodes, boolean filterSkipped) {
    static Result unchanged(EntityLineage lineage) {
      return new Result(lineage, 0, false);
    }
  }

  private final Authorizer authorizer;

  public LineagePermissionFilter(Authorizer authorizer) {
    this.authorizer = authorizer;
  }

  public Result filter(
      SecurityContext securityContext, SubjectContext subjectContext, EntityLineage lineage) {
    if (lineage == null || nullOrEmpty(lineage.getNodes()) || isUnrestricted(subjectContext)) {
      return Result.unchanged(lineage);
    }
    if (lineage.getNodes().size() > MAX_FILTERED_NODES) {
      LOG.warn(
          "Skipping lineage permission filter: {} nodes exceeds the {} node limit",
          lineage.getNodes().size(),
          MAX_FILTERED_NODES);
      return new Result(lineage, 0, true);
    }
    int hidden =
        LineageGraphPruner.retainReachable(lineage, visibleNodeIds(securityContext, lineage));
    return new Result(lineage, hidden, false);
  }

  private static boolean isUnrestricted(SubjectContext subjectContext) {
    return subjectContext != null && (subjectContext.isAdmin() || subjectContext.isBot());
  }

  private Set<UUID> visibleNodeIds(SecurityContext securityContext, EntityLineage lineage) {
    Set<UUID> visible = new HashSet<>();
    // The root is already authorized by the calling tool; re-checking it would only risk pruning
    // the graph the caller was just granted.
    visible.add(lineage.getEntity().getId());
    for (EntityReference node : lineage.getNodes()) {
      if (canView(securityContext, node)) {
        visible.add(node.getId());
      }
    }
    return visible;
  }

  private boolean canView(SecurityContext securityContext, EntityReference node) {
    boolean viewable = false;
    try {
      authorizer.authorize(
          securityContext,
          // OperationContext is stateful - it drops operations as they are satisfied - so each
          // node needs its own.
          new OperationContext(node.getType(), MetadataOperation.VIEW_BASIC),
          new ResourceContext<>(node.getType(), node.getId(), node.getFullyQualifiedName()));
      viewable = true;
    } catch (AuthorizationException | EntityNotFoundException e) {
      // EntityNotFoundException too: a node whose type has no registered repository cannot be
      // authorized, and an unauthorizable node must not be returned.
      LOG.debug("Hiding lineage node {} the caller cannot view: {}", node.getId(), e.getMessage());
    }
    return viewable;
  }
}
