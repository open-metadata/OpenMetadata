package org.openmetadata.service.lineage;

import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import jakarta.ws.rs.core.SecurityContext;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.CompactLineage;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * One page of an entity's lineage, authorized node by node, optionally narrowed to one column. The
 * single implementation behind the MCP {@code get_entity_lineage} tool and the compact lineage REST
 * endpoint, so the two cannot drift on what a caller is allowed to see.
 */
@Slf4j
public class CompactLineageService {

  private final Authorizer authorizer;
  private final LineageRepository lineageRepository;

  public CompactLineageService(Authorizer authorizer, LineageRepository lineageRepository) {
    this.authorizer = authorizer;
    this.lineageRepository = lineageRepository;
  }

  /** The graph left after every removal, and what was removed. */
  private record VisibleGraph(
      EntityLineage lineage,
      Predicate<EntityReference> pipelineVisible,
      LineagePermissionFilter.Result filtered,
      int domainHiddenNodes,
      Integer columnUnmappedEdges,
      Integer filteredEdges) {}

  public CompactLineage getLineage(CompactLineageRequest request, SecurityContext securityContext) {
    authorizeRoot(request, securityContext);
    requireKnownEntityTypes(request.edgeFilter());
    String column = requireExistingColumn(request, securityContext);
    LOG.info(
        "Getting compact lineage for {} '{}', upstreamDepth: {}, downstreamDepth: {}, column: {}",
        request.entityType(),
        request.fqn(),
        request.upstreamDepth(),
        request.downstreamDepth(),
        column);
    VisibleGraph graph = visibleGraph(request, column, securityContext);
    CompactLineage page =
        LineageEdgePager.page(
            CompactLineageSlimmer.toSlim(
                graph.lineage(), request.edgeOptions(), graph.pipelineVisible()),
            request.from(),
            request.limit(),
            request.maxResponseChars());
    return page.withFilteredEdges(graph.filteredEdges())
        .withColumnUnmappedEdges(graph.columnUnmappedEdges())
        .withHiddenNodes(graph.filtered().hiddenNodes() + graph.domainHiddenNodes())
        .withHiddenNodesUnchecked(graph.filtered().hiddenUnchecked())
        .withUncheckedNodes(graph.filtered().uncheckedNodes());
  }

  /**
   * Authorize by FQN so entity-scoped tag/owner/domain policies are evaluated, not just the
   * resource-type permission. A ResourceContext with no id and no name never resolves an entity,
   * leaving every attribute unread: matchAnyTag then reads false whether or not the tag is present,
   * so a Deny fires on every entity in one polarity and on none in the other.
   */
  private void authorizeRoot(CompactLineageRequest request, SecurityContext securityContext) {
    authorizer.authorize(
        securityContext,
        new OperationContext(request.entityType(), MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(request.entityType(), null, request.fqn()));
  }

  /** A misspelt type such as "tables" would otherwise filter the graph down to nothing, silently. */
  private static void requireKnownEntityTypes(LineageEdgeFilter filter) {
    Set<String> known =
        Entity.getEntityList().stream()
            .map(type -> type.toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());
    List<String> unknown =
        Stream.concat(filter.entityTypes().stream(), filter.excludedEntityTypes().stream())
            .filter(type -> !known.contains(type))
            .distinct()
            .sorted()
            .toList();
    if (!unknown.isEmpty()) {
      throw new IllegalArgumentException(
          String.format(
              "Unknown entity type(s) in entityTypes or excludeEntityTypes: %s", unknown));
    }
  }

  /** The cheap FQN check first, so a column of another entity never costs an entity read. */
  private static String requireExistingColumn(
      CompactLineageRequest request, SecurityContext securityContext) {
    String column = request.column();
    if (column != null) {
      ColumnLineageScope.requireColumnOf(request.fqn(), column);
      EntityInterface entity =
          Entity.getEntityByName(
              request.entityType(),
              request.fqn(),
              ContextMemoryVisibility.guardFields(request.entityType(), ""),
              Include.NON_DELETED);
      ContextMemoryVisibility.enforceVisibility(entity, securityContext);
      ColumnLineageScope.requireColumnExists(entity, column);
    }
    return column;
  }

  private VisibleGraph visibleGraph(
      CompactLineageRequest request, String column, SecurityContext securityContext) {
    // The subject context applies the caller's domain restrictions
    // (LineageRepository.pruneLineageByDomain); the overload without it prunes nothing. The
    // reporting overload counts those removals, or hiddenNodes would understate what was withheld.
    SubjectContext subjectContext = getSubjectContext(securityContext);
    LineageRepository.DomainPrunedLineage pruned =
        lineageRepository.getByNameReportingPrune(
            request.entityType(),
            request.fqn(),
            request.upstreamDepth(),
            request.downstreamDepth(),
            subjectContext);
    // Before the permission filter, so its node ceiling is spent on the column's graph, not on
    // every table around a busy root.
    Integer unmapped = column == null ? null : ColumnLineageScope.narrow(pruned.lineage(), column);
    // Authorizing the root only grants the root. Neighbour nodes carry their own FQNs, names and
    // descriptions, so an entity-scoped policy has to be applied to them as well or the graph
    // discloses exactly the assets the policy hides.
    LineagePermissionFilter permissionFilter = new LineagePermissionFilter(authorizer);
    LineagePermissionFilter.Result filtered =
        permissionFilter.filter(securityContext, subjectContext, pruned.lineage());
    // After the permission filter, unlike the column walk: that filter keeps only what is still
    // connected to the root, so an edge dropped here first would cut off, for every caller but an
    // admin, the wanted assets past it. It also keeps filteredEdges to edges the caller may see.
    // ponytail: the node ceiling is still spent on assets this then drops; pre-pruning nodes on no
    // path to a wanted asset would save it, if a filtered busy graph is seen hitting the ceiling.
    Integer filteredEdges = filterEdges(request.edgeFilter(), filtered.lineage());
    return new VisibleGraph(
        filtered.lineage(),
        pipelineVisibility(permissionFilter, securityContext, filtered.lineage()),
        filtered,
        pruned.hiddenNodes(),
        unmapped,
        filteredEdges);
  }

  /** Null when no filter was asked for, so the response carries no count. */
  private static Integer filterEdges(LineageEdgeFilter filter, EntityLineage lineage) {
    return filter.isActive() ? filter.apply(lineage) : null;
  }

  /**
   * A pipeline is edge metadata, not a graph node, so the node filter never saw it. It is its own
   * entity with its own policy, and its FQN, description and name would otherwise ride out on an
   * edge whose two endpoints are both visible. Each distinct pipeline is decided once; a graph
   * commonly repeats one pipeline across many edges.
   */
  private static Predicate<EntityReference> pipelineVisibility(
      LineagePermissionFilter filter, SecurityContext securityContext, EntityLineage lineage) {
    if (lineage == null) {
      return pipeline -> true;
    }
    Map<UUID, Boolean> decisions = new HashMap<>();
    // No pipeline at all is nothing to hide. A pipeline we cannot identify is one we cannot
    // authorize, so it is withheld rather than waved through.
    return pipeline ->
        pipeline == null
            || (pipeline.getId() != null
                && decisions.computeIfAbsent(
                    pipeline.getId(), id -> filter.canView(securityContext, pipeline)));
  }
}
