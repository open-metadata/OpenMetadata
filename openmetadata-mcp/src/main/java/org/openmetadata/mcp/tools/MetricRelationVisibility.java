package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC;

import jakarta.ws.rs.core.SecurityContext;
import java.util.Arrays;
import java.util.HashMap;
import java.util.function.Predicate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.MetricGroupRepository;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.resources.metrics.MetricResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * A metric or metric group read through get_entity_details carries the same relations as its REST
 * read: parent, children, related metrics, group, members and the counts derived from them. Each
 * answers the caller's view permission on the entity it names, through the repository sanitizers
 * the metric resources apply, so a caller with an unconditional view gets the entity unchanged.
 *
 * <p>ADR:2026-10-31-metric-and-metric-group-responses-hide-relations-the-viewer-cannot-see
 */
final class MetricRelationVisibility {

  private MetricRelationVisibility() {}

  static EntityInterface<?> visibleTo(
      EntityInterface<?> entity, Authorizer authorizer, SecurityContext securityContext) {
    EntityInterface<?> visible = entity;
    // get_entity_details reads every entity type through one path as EntityInterface, so the two
    // types whose relations answer to a per-reference view check are told apart here.
    if (entity instanceof Metric metric
        && !hasUnconditionalView(authorizer, securityContext, Entity.METRIC, Entity.METRIC_GROUP)) {
      visible =
          metricRepository()
              .sanitizeMetricRelations(
                  metric,
                  viewableBy(authorizer, securityContext),
                  viewableBy(authorizer, securityContext));
    } else if (entity instanceof MetricGroup group
        && !hasUnconditionalView(authorizer, securityContext, Entity.METRIC)) {
      visible =
          groupRepository().sanitizeMembership(group, viewableBy(authorizer, securityContext));
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

  private static Predicate<EntityReference> viewableBy(
      Authorizer authorizer, SecurityContext securityContext) {
    return MetricResource.cachedDecisions(
        new HashMap<>(), reference -> canViewBasic(authorizer, securityContext, reference));
  }

  // The check MetricResource applies to each relation it returns: a reference the caller may not
  // view, or one that no longer resolves, is withheld.
  private static boolean canViewBasic(
      Authorizer authorizer, SecurityContext securityContext, EntityReference reference) {
    boolean visible = true;
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(reference.getType(), VIEW_BASIC),
          new ResourceContext<>(
              reference.getType(), reference.getId(), reference.getFullyQualifiedName()));
    } catch (AuthorizationException | EntityNotFoundException | IllegalArgumentException e) {
      visible = false;
    }
    return visible;
  }

  private static MetricRepository metricRepository() {
    return (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
  }

  private static MetricGroupRepository groupRepository() {
    return (MetricGroupRepository) Entity.getEntityRepository(Entity.METRIC_GROUP);
  }
}
