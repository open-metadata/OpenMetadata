package org.openmetadata.service.events.subscription.matching;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.AlertMatcherMode;
import org.openmetadata.schema.entity.events.AlertShadowDisagreement;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.subscription.AlertTelemetry;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.AlertingSettings;

/**
 * Decides, for the length of one tick, which events belong to one alert. One engine decides: the
 * stored condition text, which is what a server of the previous release evaluates too, or the
 * plan. The other is evaluated beside it on the same event, and what that shows is tallied; it
 * never changes the decision. The mode is the one read when the tick opened.
 */
@Slf4j
public final class AlertMatching {

  static final Duration SHADOW_TIME_PER_TICK = Duration.ofSeconds(10);
  private static final String YES = "yes";
  private static final String NO = "no";

  private final EventSubscription alert;
  private final Long watermark;
  private final AlertMatcherMode mode;
  private final Optional<MatchingPlan> plan;
  private final boolean comparable;
  private final ShadowTally tally;
  private final LongSupplier nanoClock;
  private long shadowNanos;
  private Long offsetOfNextEvent;

  private AlertMatching(
      EventSubscription alert, Long watermark, ShadowTally tally, LongSupplier nanoClock) {
    this.nanoClock = nanoClock;
    this.alert = alert;
    this.watermark = watermark;
    this.tally = tally;
    this.mode = AlertingSettings.current().matcherModeOf(alert.getAlertType());
    this.plan = mode == AlertMatcherMode.STORED ? Optional.empty() : MatchingPlan.of(alert);
    this.comparable = plan.isPresent() && storedTextIsWhatThisCatalogCompiles(alert);
  }

  public static AlertMatching forTick(EventSubscription alert, Long watermark) {
    return forTick(alert, watermark, System::nanoTime);
  }

  static AlertMatching forTick(EventSubscription alert, Long watermark, LongSupplier nanoClock) {
    return new AlertMatching(alert, watermark, new ShadowTally(), nanoClock);
  }

  /** Decides as a tick would, and tallies nothing: a page view is not evidence. */
  public static AlertMatching forDiagnostics(EventSubscription alert, Long watermark) {
    return new AlertMatching(alert, watermark, null, System::nanoTime);
  }

  public void nextEventIsAt(Long offset) {
    this.offsetOfNextEvent = offset;
  }

  public AlertMatcherMode mode() {
    return mode;
  }

  public ShadowTally tally() {
    return tally;
  }

  /** May throw what a condition throws. The caller sets that one event aside. */
  public boolean matches(ChangeEvent event) {
    boolean decided = false;
    if (!AlertUtil.isStalePipelineExecution(event, watermark)) {
      ConditionEvaluator evaluator = new ConditionEvaluator(event);
      boolean planDecides = mode == AlertMatcherMode.PLAN && plan.isPresent();
      decided =
          planDecides
              ? PlanMatcher.matches(plan.get(), event, evaluator, this::answered)
              : AlertUtil.storedTextMatches(event, alert.getFilteringRules(), evaluator);
      compareBeside(event, evaluator, decided, planDecides);
    }
    return decided;
  }

  private void compareBeside(
      ChangeEvent event, ConditionEvaluator evaluator, boolean decided, boolean planDecided) {
    boolean comparing = tally != null && plan.isPresent();
    if (comparing && !comparable) {
      tally.notComparable();
    } else if (comparing && shadowNanos >= SHADOW_TIME_PER_TICK.toNanos()) {
      tally.skipped();
    } else if (comparing) {
      long startedAt = nanoClock.getAsLong();
      String other = answerOfTheOther(event, evaluator, planDecided);
      shadowNanos += nanoClock.getAsLong() - startedAt;
      String storedText = planDecided ? other : (decided ? YES : NO);
      String planned = planDecided ? (decided ? YES : NO) : other;
      record(event, storedText, planned);
    }
  }

  // Whatever the second engine throws is its answer, never this tick's problem.
  private String answerOfTheOther(
      ChangeEvent event, ConditionEvaluator evaluator, boolean planDecided) {
    String answer;
    try {
      boolean matched =
          planDecided
              ? AlertUtil.storedTextMatches(event, alert.getFilteringRules(), evaluator)
              : PlanMatcher.matches(plan.get(), event, evaluator, this::answered);
      answer = matched ? YES : NO;
    } catch (RuntimeException e) {
      answer = "threw:" + e.getClass().getSimpleName();
    }
    return answer;
  }

  private void record(ChangeEvent event, String storedText, String planned) {
    String subjectType = subjectTypeOf(event);
    tally.compared(subjectType, storedText, planned);
    if (!storedText.equals(planned)) {
      tally.disagreement(
          new AlertShadowDisagreement()
              .withEventId(event.getId())
              .withOffset(offsetOfNextEvent)
              .withSubjectType(subjectType)
              .withStoredText(storedText)
              .withPlan(planned)
              .withTimestamp(System.currentTimeMillis()));
      AlertTelemetry.shadowDisagreement(alert.getAlertType());
      LOG.warn(
          "Alert matching disagreement: alert {} event {} offset {} subject {} stored text {} plan {}",
          alert.getId(),
          event.getId(),
          offsetOfNextEvent,
          subjectType,
          storedText,
          planned);
    }
  }

  private void answered(String condition, boolean yes) {
    if (tally != null) {
      tally.answered(condition, yes);
    }
  }

  private static String subjectTypeOf(ChangeEvent event) {
    String subjectType;
    try {
      subjectType = EventSubject.of(event).subjectType();
    } catch (RuntimeException e) {
      subjectType = event.getEntityType();
    }
    return subjectType;
  }

  // Only like is compared with like. Text stored under a catalog that has since changed means
  // something else than the plan this server builds, and a difference between them would say
  // nothing about the engines. Saving the alert compiles it again and makes it comparable.
  private static boolean storedTextIsWhatThisCatalogCompiles(EventSubscription alert) {
    boolean same = false;
    try {
      FilteringRules stored = alert.getFilteringRules();
      FilteringRules compiled =
          AlertUtil.rebuildStoredFilteringConditions(
              stored.getResources(), alert.getAlertType(), alert.getInput());
      same =
          textOf(stored.getRules()).equals(textOf(compiled.getRules()))
              && textOf(stored.getActions()).equals(textOf(compiled.getActions()));
    } catch (RuntimeException e) {
      LOG.debug(
          "The definition of alert {} does not compile here: {}", alert.getName(), e.getMessage());
    }
    return same;
  }

  private static List<String> textOf(List<EventFilterRule> rules) {
    return listOrEmpty(rules).stream()
        .map(rule -> rule.getName() + "|" + rule.getEffect() + "|" + rule.getCondition())
        .sorted()
        .toList();
  }
}
