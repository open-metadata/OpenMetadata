package org.openmetadata.dsl.alerts;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.dsl.actions.Actions;
import org.openmetadata.dsl.conditions.Entity;
import org.openmetadata.dsl.conditions.TestResult;
import org.openmetadata.dsl.core.DSLAction;
import org.openmetadata.dsl.core.DSLCondition;

public class DSLAlertBuilder {
  private String name;
  private String description;
  private DSLCondition condition;
  private List<DSLAction> actions = new ArrayList<>();
  private DSLAlert.AlertSchedule schedule = DSLAlert.AlertSchedule.REAL_TIME;
  private DSLAlert.AlertSeverity severity = DSLAlert.AlertSeverity.MEDIUM;
  private Map<String, Object> metadata = new HashMap<>();
  private List<String> tags = new ArrayList<>();
  private List<String> owners = new ArrayList<>();
  private DSLAlert.AlertThrottling throttling;
  private boolean enabled = true;

  public static DSLAlertBuilder create() {
    return new DSLAlertBuilder();
  }

  public DSLAlertBuilder name(String name) {
    this.name = name;
    return this;
  }

  public DSLAlertBuilder description(String description) {
    this.description = description;
    return this;
  }

  public DSLAlertBuilder when(DSLCondition condition) {
    this.condition = condition;
    return this;
  }

  public DSLAlertBuilder then(DSLAction... actions) {
    for (DSLAction action : actions) {
      this.actions.add(action);
    }
    return this;
  }

  public DSLAlertBuilder then(Actions.NotificationAction... actionBuilders) {
    for (Actions.NotificationAction actionBuilder : actionBuilders) {
      this.actions.add(actionBuilder.build());
    }
    return this;
  }

  public DSLAlertBuilder schedule(DSLAlert.AlertSchedule schedule) {
    this.schedule = schedule;
    return this;
  }

  public DSLAlertBuilder severity(DSLAlert.AlertSeverity severity) {
    this.severity = severity;
    return this;
  }

  public DSLAlertBuilder enabled(boolean enabled) {
    this.enabled = enabled;
    return this;
  }

  public DSLAlertBuilder throttle(Duration duration, int maxAlerts) {
    this.throttling =
        DSLAlert.AlertThrottling.builder()
            .enabled(true)
            .duration(duration)
            .maxAlerts(maxAlerts)
            .build();
    return this;
  }

  public DSLAlertBuilder tags(String... tags) {
    for (String tag : tags) {
      this.tags.add(tag);
    }
    return this;
  }

  public DSLAlertBuilder owners(String... owners) {
    for (String owner : owners) {
      this.owners.add(owner);
    }
    return this;
  }

  public DSLAlertBuilder metadata(String key, Object value) {
    this.metadata.put(key, value);
    return this;
  }

  public DSLAlert build() {
    return DSLAlert.builder()
        .id(UUID.randomUUID())
        .name(name)
        .description(description)
        .condition(condition)
        .actions(actions)
        .schedule(schedule)
        .severity(severity)
        .metadata(metadata)
        .tags(tags)
        .owners(owners)
        .throttling(throttling)
        .enabled(enabled)
        .build();
  }

  // Convenient factory methods for common alert patterns
  public static DSLAlert dataQualityAlert() {
    return DSLAlertBuilder.create()
        .name("Data Quality Monitor")
        .description("Monitors test case failures for data quality issues")
        .when(Entity.ofType("testCase").and(TestResult.is("Failed")))
        .then(
            Actions.notification().slack("#data-quality").build(),
            Actions.notification().email("data-team@company.com").build())
        .severity(DSLAlert.AlertSeverity.HIGH)
        .tags("data-quality", "automated")
        .build();
  }

  public static DSLAlert schemaChangeAlert() {
    return DSLAlertBuilder.create()
        .name("Schema Change Monitor")
        .description("Monitors schema changes in production tables")
        .when(
            Entity.ofType("table")
                .and(Entity.hasTag("production"))
                .and(Entity.fieldChanged("columns")))
        .then(
            Actions.notification().slack("#schema-changes").build(),
            Actions.createTicket("JIRA").withDescription("Schema change detected").build())
        .severity(DSLAlert.AlertSeverity.MEDIUM)
        .throttle(Duration.ofHours(1), 5)
        .tags("schema", "production")
        .build();
  }

  public static DSLAlert pipelineFailureAlert() {
    return DSLAlertBuilder.create()
        .name("Pipeline Failure Monitor")
        .description("Monitors critical pipeline failures")
        .when(Entity.ofType("pipeline").and(Entity.hasTag("critical")).and(Entity.status("Failed")))
        .then(
            Actions.notification().pagerDuty("critical-alerts").build(),
            Actions.notification().slack("#pipeline-failures").build(),
            Actions.escalate().after(Duration.ofMinutes(15)).build())
        .severity(DSLAlert.AlertSeverity.CRITICAL)
        .tags("pipeline", "critical")
        .build();
  }
}
