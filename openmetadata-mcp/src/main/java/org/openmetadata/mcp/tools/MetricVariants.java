package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.schema.api.data.MetricExpression;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.EntityRelationshipNotFoundException;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * A parent metric's children are its variants. Each visible child's reference carries its
 * expression, so an agent picks the right variant from the parent read alone instead of one
 * get_entity_details call per child.
 */
final class MetricVariants {
  private static final int MAX_VARIANTS_WITH_EXPRESSION = 25;
  private static final String TRUNCATED_KEY = "childrenExpressionsTruncated";
  private static final String CHILDREN_KEY = "children";
  private static final String EXPRESSION_KEY = "metricExpression";

  private MetricVariants() {}

  static void addExpressions(
      Map<String, Object> response, Metric parent, Predicate<EntityReference> canView) {
    List<EntityReference> children = listOrEmpty(parent.getChildren());
    List<UUID> visibleIds =
        children.stream()
            .limit(MAX_VARIANTS_WITH_EXPRESSION)
            .filter(canView)
            .map(EntityReference::getId)
            .toList();
    attach(response, loadExpressions(visibleIds));
    if (children.size() > MAX_VARIANTS_WITH_EXPRESSION) {
      response.put(TRUNCATED_KEY, Boolean.TRUE);
    }
  }

  /**
   * The same check get_entity_details applies before it returns a metric. A child whose policy
   * inputs cannot be loaded, such as one with a dangling owner, is left without its expression
   * rather than failing the parent read.
   */
  static Predicate<EntityReference> viewableBy(
      Authorizer authorizer, SecurityContext securityContext) {
    return child -> {
      boolean visible = true;
      try {
        authorizer.authorize(
            securityContext,
            new OperationContext(Entity.METRIC, VIEW_ALL),
            new ResourceContext<>(Entity.METRIC, child.getId(), null));
      } catch (AuthorizationException
          | EntityNotFoundException
          | EntityRelationshipNotFoundException e) {
        visible = false;
      }
      return visible;
    };
  }

  @SuppressWarnings("unchecked")
  private static void attach(
      Map<String, Object> response, Map<String, MetricExpression> expressionsById) {
    if (response.get(CHILDREN_KEY) instanceof List<?> children) {
      for (Object child : children) {
        if (child instanceof Map<?, ?> reference
            && expressionsById.get(String.valueOf(reference.get("id")))
                instanceof MetricExpression expression) {
          ((Map<String, Object>) reference)
              .put(
                  EXPRESSION_KEY,
                  McpResponseTrim.cappedMetricExpression(JsonUtils.getMap(expression)));
        }
      }
    }
  }

  private static Map<String, MetricExpression> loadExpressions(List<UUID> ids) {
    MetricRepository repository = (MetricRepository) Entity.getEntityRepository(Entity.METRIC);
    return repository.getDao().findEntitiesByIds(ids, Include.NON_DELETED).stream()
        .filter(metric -> metric.getMetricExpression() != null)
        .collect(
            Collectors.toMap(metric -> metric.getId().toString(), Metric::getMetricExpression));
  }
}
