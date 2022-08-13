package org.openmetadata.catalog.security.policyevaluator;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.permissionDenied;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.Iterator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.security.AuthorizationException;
import org.openmetadata.catalog.security.policyevaluator.SubjectContext.PolicyContext;
import org.openmetadata.catalog.type.MetadataOperation;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;

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
    try {
      return EXPRESSION_PARSER.parseExpression(condition);
    } catch (Exception exception) {
      throw new IllegalArgumentException(CatalogExceptionMessage.failedToParse(exception.getMessage()));
    }
  }

  /** Used only for validating the expressions when new rule is created */
  public static <T> T validateExpression(String condition, Class<T> clz) {
    if (condition == null) {
      return null;
    }
    Expression expression = parseExpression(condition);
    RuleEvaluator ruleEvaluator = new RuleEvaluator(null, null, null);
    try {
      return expression.getValue(ruleEvaluator, clz);
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
    }
    return expression;
  }

  public void evaluateDenyRule(
      PolicyContext policyContext,
      OperationContext operationContext,
      SubjectContext subjectContext,
      ResourceContextInterface resourceContext) {
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
        if (matchExpression(subjectContext, resourceContext)) {
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

  public void evaluateAllowRule(
      OperationContext operationContext, SubjectContext subjectContext, ResourceContextInterface resourceContext) {
    if (getEffect() != Effect.ALLOW || !matchResource(operationContext.getResource())) {
      return;
    }

    Iterator<MetadataOperation> iterator = operationContext.getOperations().listIterator();
    while (iterator.hasNext()) {
      MetadataOperation operation = iterator.next();
      if (matchOperation(operation)) {
        if (matchExpression(subjectContext, resourceContext)) {
          LOG.info("operation {} allowed", operation);
          iterator.remove();
        }
      }
    }
  }

  public boolean matchRuleForPermissions(SubjectContext subjectContext) {
    return matchResource("all");
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

  private boolean matchExpression(SubjectContext subjectContext, ResourceContextInterface resourceContext) {
    Expression expression = getExpression();
    if (expression == null) {
      return true;
    }
    RuleEvaluator ruleEvaluator = new RuleEvaluator(null, subjectContext, resourceContext);
    StandardEvaluationContext evaluationContext = new StandardEvaluationContext(ruleEvaluator);
    return Boolean.TRUE.equals(expression.getValue(evaluationContext, Boolean.class));
  }
}
