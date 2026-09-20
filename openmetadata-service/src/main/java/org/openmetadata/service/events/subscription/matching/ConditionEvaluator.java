package org.openmetadata.service.events.subscription.matching;

import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.support.SimpleEvaluationContext;

/**
 * Answers conditions about one event. Whoever decides matching for an event, and whoever is only
 * compared with it, asks the same evaluator, so what one read from the store the other reads from
 * the cache, and both judge the same event in the same state.
 */
public final class ConditionEvaluator {

  private static final Cache<String, Expression> PARSED =
      Caffeine.newBuilder().maximumSize(1000).build();

  private final SimpleEvaluationContext context;
  private final EventFacts facts = new EventFacts();

  public ConditionEvaluator(ChangeEvent event) {
    this.context =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(new AlertsRuleEvaluator(event))
            .build();
  }

  /** What is known about this event, shared by everyone who judges it. */
  public EventFacts facts() {
    return facts;
  }

  public boolean isTrue(String condition) {
    Expression expression = PARSED.get(condition, text -> parseExpression(text));
    return Boolean.TRUE.equals(expression.getValue(context, Boolean.class));
  }
}
