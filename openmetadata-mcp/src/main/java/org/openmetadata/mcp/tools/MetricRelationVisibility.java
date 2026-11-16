package org.openmetadata.mcp.tools;

import jakarta.ws.rs.core.SecurityContext;
import java.util.Arrays;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.MetricGroupRepository;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.resources.metrics.MetricResource;
import org.openmetadata.service.security.Authorizer;

/**
 * A metric or metric group an MCP tool answers with carries the same relations as its REST
 * response: parent, children, related metrics, group, members and the counts derived from them.
 * Each answers the caller's view permission on the entity it names, through the repository
 * sanitizers the metric resources apply, so a caller with an unconditional view gets the entity
 * unchanged.
 *
 * <p>ADR:2026-10-31-metric-and-metric-group-responses-hide-relations-the-viewer-cannot-see
 */
final class MetricRelationVisibility {

  private MetricRelationVisibility() {}

  static EntityInterface<?> visibleTo(
      EntityInterface<?> entity, Authorizer authorizer, SecurityContext securityContext) {
    EntityInterface<?> visible = entity;
    // MCP tools answer with any entity type through one path as EntityInterface, so the two types
    // whose relations answer to a per-reference view check are told apart here.
    if (entity instanceof Metric metric
        && !hasUnconditionalView(authorizer, securityContext, Entity.METRIC, Entity.METRIC_GROUP)) {
      visible =
          metricRepository()
              .sanitizeMetricRelations(
                  metric,
                  MetricResource.viewBasicDecisions(authorizer, securityContext),
                  MetricResource.viewBasicDecisions(authorizer, securityContext));
    } else if (entity instanceof MetricGroup group
        && !hasUnconditionalView(authorizer, securityContext, Entity.METRIC)) {
      visible =
          groupRepository()
              .sanitizeMembership(
                  group, MetricResource.viewBasicDecisions(authorizer, securityContext));
    }
    return visible;
  }

  private static boolean hasUnconditionalView(
      Authorizer authorizer, SecurityContext securityContext, String... resources) {
    String user = securityContext.getUserPrincipal().getName();
    return Arrays.stream(resources)
        .allMatch(
            resource ->
                MetricResource.hasUnconditionalView(
                    authorizer.getPermission(securityContext, user, resource)));
  }

  private static MetricRepository metricRepository() {
    return (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
  }

  private static MetricGroupRepository groupRepository() {
    return (MetricGroupRepository) Entity.getEntityRepository(Entity.METRIC_GROUP);
  }
}
