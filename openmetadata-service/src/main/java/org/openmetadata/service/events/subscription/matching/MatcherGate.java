package org.openmetadata.service.events.subscription.matching;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import org.openmetadata.schema.api.events.AlertMatcherGate;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertConditionCoverage;
import org.openmetadata.schema.entity.events.AlertShadowReport;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.events.subscription.AlertDefinition;
import org.openmetadata.service.events.subscription.AlertingSettings;

/**
 * May the plan decide for the alerts of one type? Every alert reads every change event, so most
 * compared events are ones both engines reject because the source does not match, and agreeing on
 * those proves nothing. The gate therefore counts what was exercised.
 */
public final class MatcherGate {

  static final long MATCHED_EVENTS_NEEDED = 1_000;
  static final long MATCHED_EVENTS_NEEDED_PER_SOURCE = 100;
  static final long ANSWERS_NEEDED_EACH_WAY = 20;
  private static final String EVERYTHING = "all";

  /**
   * Conditions production cannot exercise, each with the unit test that covers it instead. A name
   * belongs here only with that test beside it.
   */
  static final Map<String, String> COVERED_BY_A_TEST_INSTEAD = Map.of();

  private MatcherGate() {}

  public static AlertMatcherGate read(
      AlertType alertType,
      List<EventSubscription> everyAlert,
      Function<EventSubscription, AlertShadowReport> reportOf) {
    AlertMatcherGate gate =
        new AlertMatcherGate()
            .withAlertType(alertType)
            .withMode(AlertingSettings.current().matcherModeOf(alertType));
    Totals totals = new Totals();
    for (EventSubscription alert : everyAlert) {
      boolean counted =
          alert.getAlertType() == alertType
              && alert.getFilteringRules() != null
              && AlertDefinition.isCompiledFromSelections(alert, alert.getFilteringRules());
      if (counted) {
        totals.add(alert, reportOf.apply(alert));
      }
    }
    return totals.into(gate);
  }

  private static final class Totals {
    private int alerts;
    private long compared;
    private long matched;
    private long disagreements;
    private long notComparable;
    private long skipped;
    private final Map<String, Long> matchedBySource = new LinkedHashMap<>();
    private final Map<String, long[]> yesAndNoByCondition = new LinkedHashMap<>();
    private final List<String> neverCompared = new ArrayList<>();

    void add(EventSubscription alert, AlertShadowReport stored) {
      AlertShadowReport report = stored == null ? new AlertShadowReport() : stored;
      alerts++;
      compared += orZero(report.getCompared());
      matched += orZero(report.getMatchedByAnEngine());
      disagreements += orZero(report.getDisagreements());
      notComparable += orZero(report.getNotComparable());
      skipped += orZero(report.getSkipped());
      if (orZero(report.getCompared()) == 0 && orZero(report.getNotComparable()) > 0) {
        neverCompared.add(alert.getName());
      }
      addSources(alert, report);
      addConditions(alert, report);
    }

    // The wildcard has no subject type of its own: whatever it matched counts for it.
    private void addSources(EventSubscription alert, AlertShadowReport report) {
      Map<String, Long> bySubject =
          report.getMatchedBySubjectType() == null ? Map.of() : report.getMatchedBySubjectType();
      for (String source : listOrEmpty(alert.getFilteringRules().getResources())) {
        long ofThisSource =
            EVERYTHING.equals(source)
                ? orZero(report.getMatchedByAnEngine())
                : bySubject.getOrDefault(source, 0L);
        matchedBySource.merge(source, ofThisSource, Long::sum);
      }
    }

    // Every condition an alert uses is listed, also one no report has an answer for yet.
    private void addConditions(EventSubscription alert, AlertShadowReport report) {
      Map<String, AlertConditionCoverage> coverage =
          report.getConditions() == null ? Map.of() : report.getConditions();
      List<ArgumentsInput> used = new ArrayList<>();
      if (alert.getInput() != null) {
        used.addAll(listOrEmpty(alert.getInput().getFilters()));
        used.addAll(listOrEmpty(alert.getInput().getActions()));
      }
      for (ArgumentsInput chosen : used) {
        long[] yesAndNo =
            yesAndNoByCondition.computeIfAbsent(chosen.getName(), name -> new long[2]);
        AlertConditionCoverage answered = coverage.get(chosen.getName());
        yesAndNo[0] += answered == null ? 0 : orZero(answered.getYes());
        yesAndNo[1] += answered == null ? 0 : orZero(answered.getNo());
      }
    }

    AlertMatcherGate into(AlertMatcherGate gate) {
      Set<String> sourcesLacking = new TreeSet<>();
      matchedBySource.forEach(
          (source, count) -> {
            if (count < MATCHED_EVENTS_NEEDED_PER_SOURCE) {
              sourcesLacking.add(source);
            }
          });
      Set<String> conditionsLacking = new TreeSet<>();
      yesAndNoByCondition.forEach(
          (condition, yesAndNo) -> {
            boolean exercised =
                yesAndNo[0] >= ANSWERS_NEEDED_EACH_WAY && yesAndNo[1] >= ANSWERS_NEEDED_EACH_WAY;
            if (!exercised && !COVERED_BY_A_TEST_INSTEAD.containsKey(condition)) {
              conditionsLacking.add(condition);
            }
          });
      boolean passes =
          matched >= MATCHED_EVENTS_NEEDED
              && disagreements == 0
              && sourcesLacking.isEmpty()
              && conditionsLacking.isEmpty()
              && neverCompared.isEmpty();
      return gate.withPasses(passes)
          .withAlerts(alerts)
          .withCompared(compared)
          .withMatchedByAnEngine(matched)
          .withDisagreements(disagreements)
          .withNotComparable(notComparable)
          .withSkipped(skipped)
          .withSourcesLackingCoverage(new ArrayList<>(sourcesLacking))
          .withConditionsLackingCoverage(new ArrayList<>(conditionsLacking))
          .withAlertsNeverCompared(neverCompared);
    }

    private static long orZero(Long value) {
      return value == null ? 0L : value;
    }
  }
}
