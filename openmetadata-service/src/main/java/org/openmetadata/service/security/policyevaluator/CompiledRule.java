package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.service.Entity.ALL_RESOURCES;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionDenied;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Permission;
import org.openmetadata.schema.type.Permission.Access;
import org.openmetadata.schema.type.ResourcePermission;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;

/** This class is used in a single threaded model and hence does not have concurrency support */
@Slf4j
public class CompiledRule extends Rule {
  private static final SpelExpressionParser EXPRESSION_PARSER = new SpelExpressionParser();
  @JsonIgnore private Expression expression;

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

    // Apply safety validation before parsing expressions
    ExpressionValidator.validateExpressionSafety(condition);

    try {
      return EXPRESSION_PARSER.parseExpression(condition);
    } catch (Exception exception) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.failedToParse(exception.getMessage()));
    }
  }

  /** Used only for validating the expressions when new rule is created */
  public static <T> void validateExpression(String condition, Class<T> clz) {
    if (condition == null) {
      return;
    }

    // parseExpression already includes safety validation
    Expression expression = parseExpression(condition);
    RuleEvaluator ruleEvaluator = new RuleEvaluator();
    SimpleEvaluationContext context =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(ruleEvaluator)
            .build();
    try {
      expression.getValue(context, clz);
    } catch (Exception exception) {
      // Remove unnecessary class details in the exception message
      String message =
          exception.getMessage().replaceAll("on type .*$", "").replaceAll("on object .*$", "");
      throw new IllegalArgumentException(CatalogExceptionMessage.failedToEvaluate(message));
    }
  }

  public Expression getExpression() {
    if (this.getCondition() == null) {
      return null;
    }
    if (expression == null) {
      expression = parseExpression(getCondition());
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

    List<MetadataOperation> operations = operationContext.getOperations(resourceContext);
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
                  subjectContext.user().getName(),
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

    Iterator<MetadataOperation> iterator =
        operationContext.getOperations(resourceContext).listIterator();
    while (iterator.hasNext()) {
      MetadataOperation operation = iterator.next();
      if (matchOperation(operation)
          && matchExpression(policyContext, subjectContext, resourceContext)) {
        LOG.debug("operation {} allowed", operation);
        iterator.remove();
      }
    }
  }

  public void evaluatePermission(
      Map<String, ResourcePermission> resourcePermissionMap, PolicyContext policyContext) {
    for (ResourcePermission resourcePermission : resourcePermissionMap.values()) {
      evaluatePermission(resourcePermission.getResource(), resourcePermission, policyContext);
    }
  }

  public void evaluatePermission(
      String resource, ResourcePermission resourcePermission, PolicyContext policyContext) {
    if (!matchResource(resource)) {
      return;
    }
    Access access = getAccess();
    // Walk through all the operations in the rule and set permissions
    for (Permission permission : resourcePermission.getPermissions()) {
      if (matchOperation(permission.getOperation())
          && overrideAccess(access, permission.getAccess())) {
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

  /** Returns true if this rule applies to the given resource name. */
  protected boolean matchResource(String resource) {
    if (getResources().stream().anyMatch(r -> r.equalsIgnoreCase(resource))) {
      return true;
    }
    if (getResources().stream().anyMatch(r -> r.equalsIgnoreCase(ALL_RESOURCES))) {
      return !resource.equalsIgnoreCase("scim");
    }
    return false;
  }

  private boolean matchOperation(MetadataOperation operation) {
    List<MetadataOperation> operations = getOperations();
    if (operations.contains(MetadataOperation.ALL)) {
      LOG.debug("matched all operations");
      return true; // Match all operations
    }
    if (operations.contains(MetadataOperation.EDIT_ALL)
        && OperationContext.isEditOperation(operation)) {
      LOG.debug("matched editAll operations");
      return true;
    }
    if (operations.contains(MetadataOperation.VIEW_ALL)
        && OperationContext.isViewOperation(operation)) {
      LOG.debug("matched viewAll operations");
      return true;
    }
    return getOperations().contains(operation);
  }

  private boolean matchExpression(
      PolicyContext policyContext,
      SubjectContext subjectContext,
      ResourceContextInterface resourceContext) {
    Expression expr = getExpression();
    if (expr == null) {
      return true;
    }
    RuleEvaluator ruleEvaluator = new RuleEvaluator(policyContext, subjectContext, resourceContext);
    SimpleEvaluationContext context =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(ruleEvaluator)
            .build();
    return Boolean.TRUE.equals(expr.getValue(context, Boolean.class));
  }

  public static boolean overrideAccess(Access newAccess, Access currentAccess) {
    // Lower the ordinal number of access overrides higher ordinal number
    return currentAccess.ordinal() > newAccess.ordinal();
  }
}
