package org.openmetadata.service.events.subscription.matching;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.events.AlertConditionCoverage;
import org.openmetadata.schema.entity.events.AlertShadowDisagreement;
import org.openmetadata.schema.entity.events.AlertShadowReport;

/**
 * What one tick learnt by evaluating the second engine beside the one that decides. It is kept in
 * memory and added to the alert's report row when the tick ends, so comparing costs a tick no
 * write per event.
 */
public final class ShadowTally {

  static final int LATEST_KEPT = 20;

  private long compared;
  private long matchedByAnEngine;
  private long notComparable;
  private long skipped;
  private final Map<String, Long> matchedBySubjectType = new LinkedHashMap<>();
  private final Map<String, long[]> yesAndNoByCondition = new LinkedHashMap<>();
  private final List<AlertShadowDisagreement> disagreements = new ArrayList<>();

  void compared(String subjectType, String storedText, String plan) {
    compared++;
    if ("yes".equals(storedText) || "yes".equals(plan)) {
      matchedByAnEngine++;
      matchedBySubjectType.merge(String.valueOf(subjectType), 1L, Long::sum);
    }
  }

  void disagreement(AlertShadowDisagreement disagreement) {
    disagreements.add(disagreement);
  }

  void notComparable() {
    notComparable++;
  }

  void skipped() {
    skipped++;
  }

  void answered(String condition, boolean yes) {
    yesAndNoByCondition.computeIfAbsent(condition, name -> new long[2])[yes ? 0 : 1]++;
  }

  public boolean isEmpty() {
    return compared + notComparable + skipped == 0;
  }

  public long disagreements() {
    return disagreements.size();
  }

  /** The stored report with this tick added to it. */
  public AlertShadowReport addedTo(AlertShadowReport stored) {
    AlertShadowReport report = stored == null ? new AlertShadowReport() : stored;
    report.setCompared(orZero(report.getCompared()) + compared);
    report.setMatchedByAnEngine(orZero(report.getMatchedByAnEngine()) + matchedByAnEngine);
    report.setNotComparable(orZero(report.getNotComparable()) + notComparable);
    report.setSkipped(orZero(report.getSkipped()) + skipped);
    report.setDisagreements(orZero(report.getDisagreements()) + disagreements.size());
    report.setMatchedBySubjectType(mergedCounts(report.getMatchedBySubjectType()));
    report.setConditions(mergedCoverage(report.getConditions()));
    report.setLatestDisagreements(latestOf(report.getLatestDisagreements()));
    return report.withTimestamp(System.currentTimeMillis());
  }

  private Map<String, Long> mergedCounts(Map<String, Long> stored) {
    Map<String, Long> merged = stored == null ? new LinkedHashMap<>() : new LinkedHashMap<>(stored);
    matchedBySubjectType.forEach((type, count) -> merged.merge(type, count, Long::sum));
    return merged;
  }

  private Map<String, AlertConditionCoverage> mergedCoverage(
      Map<String, AlertConditionCoverage> stored) {
    Map<String, AlertConditionCoverage> merged =
        stored == null ? new LinkedHashMap<>() : new LinkedHashMap<>(stored);
    yesAndNoByCondition.forEach(
        (condition, yesAndNo) -> {
          AlertConditionCoverage coverage =
              merged.computeIfAbsent(condition, name -> new AlertConditionCoverage());
          coverage.setYes(orZero(coverage.getYes()) + yesAndNo[0]);
          coverage.setNo(orZero(coverage.getNo()) + yesAndNo[1]);
        });
    return merged;
  }

  private List<AlertShadowDisagreement> latestOf(List<AlertShadowDisagreement> stored) {
    List<AlertShadowDisagreement> all =
        stored == null ? new ArrayList<>() : new ArrayList<>(stored);
    all.addAll(disagreements);
    return new ArrayList<>(all.subList(Math.max(0, all.size() - LATEST_KEPT), all.size()));
  }

  private static long orZero(Long value) {
    return value == null ? 0L : value;
  }
}
