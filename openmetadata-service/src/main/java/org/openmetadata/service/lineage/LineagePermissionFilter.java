package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Drops lineage nodes the caller cannot {@link MetadataOperation#VIEW_BASIC}.
 *
 * <p>Authorizing the root entity is not enough. A lineage node carries its neighbour's fully
 * qualified name, display name, type and description, so a caller under a policy such as {@code Deny
 * + !matchAnyTag('X')} - allowed to read the one tagged asset, denied everything else - would
 * otherwise receive the identity of exactly the assets the policy exists to hide.
 *
 * <p>The per-node decisions come from {@link ViewPermissionFilter}, which batches them by entity
 * type and fails closed.
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

  private final ViewPermissionFilter viewFilter;

  public LineagePermissionFilter(Authorizer authorizer) {
    this.viewFilter = new ViewPermissionFilter(authorizer);
  }

  public Result filter(
      SecurityContext securityContext, SubjectContext subjectContext, EntityLineage lineage) {
    if (lineage == null || nullOrEmpty(lineage.getNodes()) || isAdmin(subjectContext)) {
      return Result.unchanged(lineage);
    }
    List<EntityReference> nodes = List.copyOf(lineage.getNodes());
    List<EntityReference> checkable = withinCeiling(nodes);
    Set<UUID> visible = new HashSet<>(viewFilter.viewableIds(securityContext, checkable));
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
    return viewFilter.canView(securityContext, reference);
  }

  /**
   * Only admins bypass. {@code DefaultAuthorizer.authorize} short-circuits admins alone - a bot's
   * root entity is policy-evaluated in full - so exempting bots here would let a tag-scoped bot read
   * neighbours that {@code get_entity_details} denies it.
   */
  private static boolean isAdmin(SubjectContext subjectContext) {
    return subjectContext != null && subjectContext.isAdmin();
  }
}
