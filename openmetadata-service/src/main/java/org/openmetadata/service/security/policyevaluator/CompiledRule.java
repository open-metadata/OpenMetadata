package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionDenied;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;

/** This class is used in a single threaded model and hence does not have concurrency support */
@Slf4j
public class CompiledRule extends Rule {
  private static final SpelExpressionParser EXPRESSION_PARSER = new SpelExpressionParser();
  @JsonIgnore private Expression expression;
  @JsonIgnore @Getter private boolean resourceBased = false;

  public CompiledRule(Rule rule) {
    super();
    this.withName(rule.getName())
        .withDescription(rule.getDescription())
        .withCondition(rule.getCondition())
        .withEffect(rule.getEffect())
        .withOperations(rule.getOperations())
        .withResources(rule.getResources());
  }

  public static Expression parseExpression(String condition) {
    if (condition == null) {
      return null;
    }
    try {
      return EXPRESSION_PARSER.parseExpression(condition);
    } catch (Exception exception) {
      throw new IllegalArgumentException(CatalogExceptionMessage.failedToParse(exception.getMessage()));
    }
  }

  /** Used only for validating the expressions when new rule is created */
  public static <T> void validateExpression(String condition, Class<T> clz) {
    if (condition == null) {
      return;
    }
    Expression expression = parseExpression(condition);
    RuleEvaluator ruleEvaluator = new RuleEvaluator(null, null, null);
    try {
      expression.getValue(ruleEvaluator, clz);
    } catch (Exception exception) {
      // Remove unnecessary class details in the exception message
      String message = exception.getMessage().replaceAll("on type .*$", "").replaceAll("on object .*$", "");
      throw new IllegalArgumentException(CatalogExceptionMessage.failedToEvaluate(message));
    }
  }

  public Expression getExpression() {
    if (this.getCondition() == null) {
      return null;
    }
    if (expression == null) {
      expression = parseExpression(getCondition());
      List<String> resourceBasedFunctions = CollectionRegistry.getInstance().getResourceBasedFunctions();
      for (String function : resourceBasedFunctions) {
        if (getCondition().contains(function)) {
          resourceBased = true;
          break;
        }
      }
    }
    return expression;
  }

  public void evaluateDenyRule(
      OperationContext operationContext,
      SubjectContext subjectContext,
      ResourceContextInterface resourceContext,
      PolicyContext policyContext) {
    if (getEffect() != Effect.DENY || !matchResource(operationContext.getResource())) {
      return;
    }

    List<MetadataOperation> operations = operationContext.getOperations();
    for (MetadataOperation operation : operations) {
      if (matchOperation(operation)) {
        LOG.debug(
            "operation {} denied by {}{}{}",
            operation,
            policyContext.getRoleName(),
            policyContext.getPolicyName(),
            getName());
        if (matchExpression(policyContext, subjectContext, resourceContext)) {
          throw new AuthorizationException(
              permissionDenied(
                  subjectContext.getUser().getName(),
                  operation,
                  policyContext.getRoleName(),
                  policyContext.getPolicyName(),
                  getName()));
        }
      }
    }
  }

  private Access getAccess() {
    if (getCondition() != null) {
      return getEffect() == Effect.DENY ? Access.CONDITIONAL_DENY : Access.CONDITIONAL_ALLOW;
    }
    return getEffect() == Effect.DENY ? Access.DENY : Access.ALLOW;
  }

  public void evaluateAllowRule(
      OperationContext operationContext,
      SubjectContext subjectContext,
      ResourceContextInterface resourceContext,
      PolicyContext policyContext) {
    if (getEffect() != Effect.ALLOW || !matchResource(operationContext.getResource())) {
      return;
    }

    Iterator<MetadataOperation> iterator = operationContext.getOperations().listIterator();
    while (iterator.hasNext()) {
      MetadataOperation operation = iterator.next();
      if (matchOperation(operation) && matchExpression(policyContext, subjectContext, resourceContext)) {
        LOG.info("operation {} allowed", operation);
        iterator.remove();
      }
    }
  }

  public void evaluatePermission(Map<String, ResourcePermission> resourcePermissionMap, PolicyContext policyContext) {
    for (ResourcePermission resourcePermission : resourcePermissionMap.values()) {
      evaluatePermission(resourcePermission.getResource(), resourcePermission, policyContext);
    }
  }

  public void evaluatePermission(String resource, ResourcePermission resourcePermission, PolicyContext policyContext) {
    if (!matchResource(resource)) {
      return;
    }
    Access access = getAccess();
    // Walk through all the operations in the rule and set permissions
    for (Permission permission : resourcePermission.getPermissions()) {
      if (matchOperation(permission.getOperation()) && overrideAccess(access, permission.getAccess())) {
        permission
            .withAccess(access)
            .withRole(policyContext.getRoleName())
            .withPolicy(policyContext.getPolicyName())
            .withRule(this);
        LOG.debug("Updated permission {}", permission);
      }
    }
  }

  public void evaluatePermission(
      SubjectContext subjectContext,
      ResourceContextInterface resourceContext,
      ResourcePermission resourcePermission,
      PolicyContext policyContext) {
    if (!matchResource(resourceContext.getResource())) {
      return;
    }
    // Walk through all the operations in the rule and set permissions
    for (Permission permission : resourcePermission.getPermissions()) {
      if (matchOperation(permission.getOperation())
          && matchExpression(policyContext, subjectContext, resourceContext)) {
        Access access = getEffect() == Effect.DENY ? Access.DENY : Access.ALLOW;
        if (overrideAccess(access, permission.getAccess())) {
          permission
              .withAccess(access)
              .withRole(policyContext.getRoleName())
              .withPolicy(policyContext.getPolicyName())
              .withRule(this);
          LOG.debug("Updated permission {}", permission);
        }
      }
    }
  }

  protected boolean matchResource(String resource) {
    return (getResources().get(0).equalsIgnoreCase("all") || getResources().contains(resource));
  }

  private boolean matchOperation(MetadataOperation operation) {
    if (getOperations().contains(MetadataOperation.ALL)) {
      LOG.debug("matched all operations");
      return true; // Match all operations
    }
    if (getOperations().contains(MetadataOperation.EDIT_ALL) && OperationContext.isEditOperation(operation)) {
      LOG.debug("matched editAll operations");
      return true;
    }
    if (getOperations().contains(MetadataOperation.VIEW_ALL) && OperationContext.isViewOperation(operation)) {
      LOG.debug("matched viewAll operations");
      return true;
    }
    return getOperations().contains(operation);
  }

  private boolean matchExpression(
      PolicyContext policyContext, SubjectContext subjectContext, ResourceContextInterface resourceContext) {
    Expression expression = getExpression();
    if (expression == null) {
      return true;
    }
    RuleEvaluator ruleEvaluator = new RuleEvaluator(policyContext, subjectContext, resourceContext);
    StandardEvaluationContext evaluationContext = new StandardEvaluationContext(ruleEvaluator);
    return Boolean.TRUE.equals(expression.getValue(evaluationContext, Boolean.class));
  }

  public static boolean overrideAccess(Access newAccess, Access currentAccess) {
    // Lower the ordinal number of access overrides higher ordinal number
    return currentAccess.ordinal() > newAccess.ordinal();
  }
}
