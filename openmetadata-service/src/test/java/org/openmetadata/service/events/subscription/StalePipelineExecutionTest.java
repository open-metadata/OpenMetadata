package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.service.Entity;

/**
 * The historical-execution cut-off for #31782. Every case here is a way the rule could either
 * silence a real failure or fail to silence a backfilled one.
 */
class StalePipelineExecutionTest {

  private static final long WATERMARK = 1_700_000_000_000L;
  private static final long HOUR = 3_600_000L;

  private static ChangeEvent pipelineStatusEvent(PipelineStatus status) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(Entity.PIPELINE)
        .withChangeDescription(
            new ChangeDescription()
                .withFieldsUpdated(
                    List.of(new FieldChange().withName("pipelineStatus").withNewValue(status)))
                .withFieldsAdded(Collections.emptyList()));
  }

  private static PipelineStatus status(Long timestamp, Long taskEnd) {
    return new PipelineStatus()
        .withTimestamp(timestamp)
        .withExecutionStatus(StatusType.Failed)
        .withTaskStatus(
            List.of(
                new Status()
                    .withName("t1")
                    .withExecutionStatus(StatusType.Failed)
                    .withEndTime(taskEnd)));
  }

  @Test
  @DisplayName("an execution that finished before the alert existed is stale")
  void oldExecutionIsStale() {
    ChangeEvent event =
        pipelineStatusEvent(status(WATERMARK - 40 * 24 * HOUR, WATERMARK - 40 * 24 * HOUR));
    assertTrue(AlertUtil.isStalePipelineExecution(event, WATERMARK));
  }

  @Test
  @DisplayName("a daily DAG's stale logical date must not silence a run that just failed")
  void logicalDateOlderThanWatermarkButTaskFinishedNow() {
    // Airflow's logical_date is the data-interval start, so a run executing today carries
    // yesterday's timestamp. Judging on timestamp would black out alerting for a full interval.
    ChangeEvent event = pipelineStatusEvent(status(WATERMARK - 24 * HOUR, WATERMARK + 2 * HOUR));
    assertFalse(AlertUtil.isStalePipelineExecution(event, WATERMARK));
  }

  @Test
  @DisplayName("top-level endTime wins over task times")
  void topLevelEndTimeIsPreferred() {
    PipelineStatus status = status(WATERMARK - 24 * HOUR, WATERMARK - 24 * HOUR);
    status.setEndTime(WATERMARK + HOUR);
    assertFalse(AlertUtil.isStalePipelineExecution(pipelineStatusEvent(status), WATERMARK));
  }

  @Test
  @DisplayName("no wall clock at all fails open rather than silencing")
  void missingWallClocksFailOpen() {
    PipelineStatus status =
        new PipelineStatus()
            .withTimestamp(WATERMARK - 40 * 24 * HOUR)
            .withExecutionStatus(StatusType.Failed)
            .withTaskStatus(Collections.emptyList());
    assertFalse(AlertUtil.isStalePipelineExecution(pipelineStatusEvent(status), WATERMARK));
  }

  @Test
  @DisplayName("a null watermark delivers everything, so upgrades do not silently suppress")
  void nullWatermarkDeliversEverything() {
    ChangeEvent event =
        pipelineStatusEvent(status(WATERMARK - 40 * 24 * HOUR, WATERMARK - 40 * 24 * HOUR));
    assertFalse(AlertUtil.isStalePipelineExecution(event, null));
  }

  @Test
  @DisplayName("non-pipeline events are untouched")
  void nonPipelineEventsAreUntouched() {
    ChangeEvent event =
        pipelineStatusEvent(status(WATERMARK - 40 * 24 * HOUR, WATERMARK - 40 * 24 * HOUR))
            .withEntityType(Entity.TABLE);
    assertFalse(AlertUtil.isStalePipelineExecution(event, WATERMARK));
  }

  @Test
  @DisplayName("only notification and observability subscriptions suppress history")
  void watermarkAppliesOnlyToAlertingSubscriptions() {
    assertTrue(
        AlertUtil.alertingWatermark(
                subscription(CreateEventSubscription.AlertType.OBSERVABILITY), WATERMARK)
            != null);
    assertTrue(
        AlertUtil.alertingWatermark(
                subscription(CreateEventSubscription.AlertType.NOTIFICATION), WATERMARK)
            != null);
    assertFalse(
        AlertUtil.alertingWatermark(
                subscription(CreateEventSubscription.AlertType.CUSTOM), WATERMARK)
            != null);
    assertFalse(
        AlertUtil.alertingWatermark(
                subscription(CreateEventSubscription.AlertType.GOVERNANCE_WORKFLOW_CHANGE_EVENT),
                WATERMARK)
            != null);
  }

  private static EventSubscription subscription(CreateEventSubscription.AlertType alertType) {
    return new EventSubscription().withId(UUID.randomUUID()).withAlertType(alertType);
  }

  @Test
  @DisplayName("an EXCLUDE rule must still drop a stale execution rather than deliver it")
  void staleEventIsDroppedUnderAnExcludeRule() {
    // The cut-off deliberately sits outside the rule engine. EXCLUDE rules compile to !(condition),
    // so moving this check into matchPipelineState would make such an alert fire on exactly the
    // backfilled executions it is meant to suppress.
    ChangeEvent stale =
        pipelineStatusEvent(status(WATERMARK - 40 * 24 * HOUR, WATERMARK - 40 * 24 * HOUR));
    EventFilterRule rule =
        new EventFilterRule()
            .withName("trigger")
            .withEffect(ArgumentsInput.Effect.EXCLUDE)
            .withCondition("matchPipelineState({'Failed'})")
            .withPrefixCondition(ArgumentsInput.PrefixCondition.AND);
    FilteringRules rules =
        new FilteringRules()
            .withResources(List.of("pipeline"))
            .withRules(Collections.emptyList())
            .withActions(List.of(rule));

    assertFalse(AlertUtil.checkIfChangeEventIsAllowed(stale, rules, WATERMARK));
  }
}
