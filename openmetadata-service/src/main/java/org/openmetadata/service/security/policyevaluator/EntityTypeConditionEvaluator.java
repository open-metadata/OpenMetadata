package org.openmetadata.service.security.policyevaluator;

import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.SpelNode;
import org.springframework.expression.spel.ast.OpAnd;
import org.springframework.expression.spel.ast.OpOr;
import org.springframework.expression.spel.ast.OperatorNot;
import org.springframework.expression.spel.standard.SpelExpression;

/**
 * Decides a deny condition on an entity-type request, where there is no asset. Each operand of
 * {@code &&}, {@code ||} and {@code !} is evaluated on its own; one whose value read the asset is
 * unknown, and the operators combine with three-valued logic. The condition holds only when it is
 * true whatever the asset is, so {@code !matchTeam() || !isImpersonated()} and its reverse decide
 * alike, unlike SpEL's left-to-right short circuit.
 */
final class EntityTypeConditionEvaluator {
  private enum Truth {
    TRUE,
    FALSE,
    UNKNOWN
  }

  private final PolicyContext policyContext;
  private final SubjectContext subjectContext;
  private final ResourceContextInterface resourceContext;

  private EntityTypeConditionEvaluator(
      PolicyContext policyContext,
      SubjectContext subjectContext,
      ResourceContextInterface resourceContext) {
    this.policyContext = policyContext;
    this.subjectContext = subjectContext;
    this.resourceContext = resourceContext;
  }

  static boolean holdsForEveryAsset(
      Expression condition,
      PolicyContext policyContext,
      SubjectContext subjectContext,
      ResourceContextInterface resourceContext) {
    EntityTypeConditionEvaluator evaluator =
        new EntityTypeConditionEvaluator(policyContext, subjectContext, resourceContext);
    return condition instanceof SpelExpression spelExpression
        && evaluator.evaluate(spelExpression.getAST()) == Truth.TRUE;
  }

  private Truth evaluate(SpelNode node) {
    return switch (node) {
      case OpAnd and -> and(evaluate(and.getChild(0)), evaluate(and.getChild(1)));
      case OpOr or -> or(evaluate(or.getChild(0)), evaluate(or.getChild(1)));
      case OperatorNot not -> negate(evaluate(not.getChild(0)));
      default -> evaluateOperand(node);
    };
  }

  private Truth evaluateOperand(SpelNode operand) {
    AssetReadRecorder recorder = new AssetReadRecorder(resourceContext);
    boolean value =
        Boolean.TRUE.equals(
            CompiledRule.parseExpression(operand.toStringAST())
                .getValue(
                    CompiledRule.evaluationContext(
                        policyContext, subjectContext, recorder.context()),
                    Boolean.class));
    if (recorder.hasReadAsset()) {
      return Truth.UNKNOWN;
    }
    return value ? Truth.TRUE : Truth.FALSE;
  }

  private static Truth and(Truth left, Truth right) {
    if (left == Truth.FALSE || right == Truth.FALSE) {
      return Truth.FALSE;
    }
    return left == Truth.TRUE && right == Truth.TRUE ? Truth.TRUE : Truth.UNKNOWN;
  }

  private static Truth or(Truth left, Truth right) {
    if (left == Truth.TRUE || right == Truth.TRUE) {
      return Truth.TRUE;
    }
    return left == Truth.FALSE && right == Truth.FALSE ? Truth.FALSE : Truth.UNKNOWN;
  }

  private static Truth negate(Truth truth) {
    return switch (truth) {
      case TRUE -> Truth.FALSE;
      case FALSE -> Truth.TRUE;
      case UNKNOWN -> Truth.UNKNOWN;
    };
  }
}
