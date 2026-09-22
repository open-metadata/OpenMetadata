package org.openmetadata.service.governance.onboarding;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingFollowUps;
import org.openmetadata.schema.governance.onboarding.OnboardingReminderKind;
import org.openmetadata.schema.governance.onboarding.OnboardingReviewTimeliness;
import org.openmetadata.schema.governance.onboarding.OnboardingStageDuration;
import org.openmetadata.schema.governance.onboarding.OnboardingSummary;
import org.openmetadata.service.jdbi3.OnboardingDAO;

/**
 * How onboarding is going for one asset type, measured from what actually happened: the stage
 * timings the gates recorded and the reminders that were sent. Every measure is null when its window
 * holds no sample - a board that shows a confident 0% it never measured is worse than one that says
 * it has no data yet.
 */
public final class OnboardingSummaryService {
  private static final int REVIEW_THRESHOLD_DAYS = 7;
  private static final int COHORT_WINDOW_DAYS = 30;
  private static final int FOLLOW_UP_WINDOW_DAYS = 7;
  private static final Duration CACHE_TTL = Duration.ofSeconds(60);

  /**
   * Bounded by asset type, not by caller: there are four onboarding types, and the numbers move on
   * the scale of days, so a short shared entry keeps a board refresh off the aggregation queries.
   */
  private static final Cache<String, OnboardingSummary> CACHE =
      Caffeine.newBuilder().maximumSize(8).expireAfterWrite(CACHE_TTL).build();

  private OnboardingSummaryService() {}

  public static OnboardingSummary get(String entityType) {
    OnboardingService.requireType(entityType);
    return CACHE.get(entityType, type -> compute(type, System.currentTimeMillis()));
  }

  /**
   * The aggregates as of a given instant, straight from storage. {@link #get} serves a short-lived
   * cached view of "now"; this is the point-in-time computation behind it.
   */
  public static OnboardingSummary compute(String entityType, long now) {
    OnboardingConfiguration configuration = lifecycle(entityType);
    String entryStage = OnboardingLifecycle.firstAfterCreation(configuration);
    return new OnboardingSummary()
        .withEntityType(entityType)
        .withReachedReviewInTime(reviewTimeliness(entityType, entryStage, now))
        .withDaysInEntryStage(stageDuration(entityType, entryStage, now))
        .withFollowUps(followUps(entityType, now));
  }

  private static OnboardingConfiguration lifecycle(String entityType) {
    OnboardingPlaybook playbook = OnboardingService.configured(entityType);
    return playbook == null ? null : playbook.getOnboarding();
  }

  /**
   * Share of a creation cohort that left the entry stage within the threshold. The cohort ends one
   * threshold before now so every asset in it has had its full seven days to get there.
   */
  private static OnboardingReviewTimeliness reviewTimeliness(
      String entityType, String stage, long now) {
    long threshold = TimeUnit.DAYS.toMillis(REVIEW_THRESHOLD_DAYS);
    long window = TimeUnit.DAYS.toMillis(COHORT_WINDOW_DAYS);
    long currentEnd = now - threshold;
    long currentStart = currentEnd - window;
    Double current = share(entityType, stage, currentStart, currentEnd, threshold);
    Double previous = share(entityType, stage, currentStart - window, currentStart, threshold);
    return new OnboardingReviewTimeliness()
        .withStage(stage)
        .withThresholdDays(REVIEW_THRESHOLD_DAYS)
        .withWindowDays(COHORT_WINDOW_DAYS)
        .withShare(current)
        .withPreviousShare(previous)
        .withDeltaPoints(current == null || previous == null ? null : round(current - previous))
        .withCohortSize(dao().countCohort(entityType, currentStart, currentEnd))
        .withPreviousCohortSize(dao().countCohort(entityType, currentStart - window, currentStart));
  }

  private static Double share(
      String entityType, String stage, long from, long to, long withinMillis) {
    int cohort = dao().countCohort(entityType, from, to);
    if (cohort == 0) return null;
    int inTime = dao().countCohortAdvancedInTime(entityType, stage, from, to, withinMillis);
    return round(inTime * 100.0 / cohort);
  }

  private static OnboardingStageDuration stageDuration(String entityType, String stage, long now) {
    long window = TimeUnit.DAYS.toMillis(COHORT_WINDOW_DAYS);
    Double current = medianDays(entityType, stage, now - window, now);
    Double previous = medianDays(entityType, stage, now - 2 * window, now - window);
    return new OnboardingStageDuration()
        .withStage(stage)
        .withWindowDays(COHORT_WINDOW_DAYS)
        .withMedianDays(current)
        .withPreviousMedianDays(previous)
        .withDeltaDays(current == null || previous == null ? null : round(previous - current))
        .withSampleSize(dao().countStageDurations(entityType, stage, now - window, now))
        .withPreviousSampleSize(
            dao().countStageDurations(entityType, stage, now - 2 * window, now - window));
  }

  /** Exact median, read as the one or two rows at the middle rather than the whole population. */
  private static Double medianDays(String entityType, String stage, long from, long to) {
    int sample = dao().countStageDurations(entityType, stage, from, to);
    if (sample == 0) return null;
    int offset = (sample - 1) / 2;
    int limit = sample % 2 == 0 ? 2 : 1;
    List<Long> middle = dao().listStageDurations(entityType, stage, from, to, offset, limit);
    if (middle.isEmpty()) return null;
    double millis = middle.stream().mapToLong(Long::longValue).average().orElse(0);
    return round(millis / TimeUnit.DAYS.toMillis(1));
  }

  private static OnboardingFollowUps followUps(String entityType, long now) {
    long window = TimeUnit.DAYS.toMillis(FOLLOW_UP_WINDOW_DAYS);
    return new OnboardingFollowUps()
        .withWindowDays(FOLLOW_UP_WINDOW_DAYS)
        .withManual(count(entityType, OnboardingReminderKind.MANUAL, now - window, now))
        .withPreviousManual(
            count(entityType, OnboardingReminderKind.MANUAL, now - 2 * window, now - window))
        .withStallNotices(count(entityType, OnboardingReminderKind.STALL_NOTICE, now - window, now))
        .withReassignments(
            count(entityType, OnboardingReminderKind.STALL_REASSIGNMENT, now - window, now));
  }

  private static int count(String entityType, OnboardingReminderKind kind, long from, long to) {
    return dao().countReminders(entityType, kind.value(), from, to);
  }

  private static double round(double value) {
    return Math.round(value * 10.0) / 10.0;
  }

  private static OnboardingDAO dao() {
    return OnboardingStore.dao();
  }
}
