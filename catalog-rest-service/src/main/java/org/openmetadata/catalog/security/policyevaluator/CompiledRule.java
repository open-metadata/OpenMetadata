package org.openmetadata.catalog.security.policyevaluator;

import java.util.List;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.type.MetadataOperation;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;

/** This class is used in a single threaded model and hence does not have concurrency support */
public class CompiledRule extends Rule {
  private static final SpelExpressionParser EXPRESSION_PARSER = new SpelExpressionParser();
  private Expression expression;

  public CompiledRule(Rule rule) {
    super();
    this.withName(rule.getName())
        .withDescription(rule.getDescription())
        .withCondition(rule.getCondition())
        .withEffect(rule.getEffect())
        .withOperations(rule.getOperations())
        .withResources(rule.getResources());
  }

  public Expression getExpression() {
    if (this.getCondition() == null) {
      return null;
    }
    if (expression == null) {
      expression = EXPRESSION_PARSER.parseExpression(this.getCondition());
    }
    return expression;
  }

  public static boolean matchRule(
      CompiledRule rule,
      OperationContext operationContext,
      SubjectContext subjectContext,
      ResourceContextInterface resourceContext) {
    if (!matchResource(rule, operationContext.getResource())
        || !matchOperations(rule, operationContext.getOperations())) {
      return false;
    }
    Expression expression = rule.getExpression();
    RuleEvaluator policyContext = new RuleEvaluator(null, subjectContext, resourceContext);
    StandardEvaluationContext evaluationContext = new StandardEvaluationContext(policyContext);
    return expression == null ? true : rule.getExpression().getValue(evaluationContext, Boolean.class);
  }

  public static boolean matchRuleForPermissions(CompiledRule rule, SubjectContext subjectContext) {
    return matchResource(rule, "all") && rule.getCondition() == null;
  }

  public static boolean matchResource(CompiledRule rule, String resource) {
    return (rule.getResources().get(0).equalsIgnoreCase("all") || rule.getResources().contains(resource));
  }

  public static boolean matchOperations(Rule rule, List<MetadataOperation> operations) {
    if (rule.getOperations().get(0).equals(MetadataOperation.ALL) || rule.getOperations().containsAll(operations)) {
      return true;
    }
    if (rule.getOperations().contains(MetadataOperation.EDIT_ALL) && OperationContext.isEditOperation(operations)) {
      return true;
    }
    if (rule.getOperations().contains(MetadataOperation.VIEW_ALL) && OperationContext.isViewOperation(operations)) {
      return true;
    }
    return false;
  }
}
