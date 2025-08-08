package org.openmetadata.dsl.alerts;

import java.time.Duration;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class DefaultAlertTemplates {

  public static final String DATA_QUALITY_TEMPLATE = "data-quality-monitor";
  public static final String SCHEMA_CHANGE_TEMPLATE = "schema-change-monitor";
  public static final String PIPELINE_FAILURE_TEMPLATE = "pipeline-failure-monitor";
  public static final String OWNERSHIP_COMPLIANCE_TEMPLATE = "ownership-compliance";
  public static final String SLA_VIOLATION_TEMPLATE = "sla-violation";
  public static final String ANOMALY_DETECTION_TEMPLATE = "anomaly-detection";

  private static final Map<String, DSLAlertTemplate> templates = new HashMap<>();

  static {
    initializeTemplates();
  }

  private static void initializeTemplates() {
    // Data Quality Monitor Template
    templates.put(
        DATA_QUALITY_TEMPLATE,
        DSLAlertTemplate.builder()
            .id(DATA_QUALITY_TEMPLATE)
            .name("Data Quality Monitor")
            .description("Monitors test case failures and quality metrics")
            .category("Data Quality")
            .parameters(
                Arrays.asList(
                    DSLAlertTemplate.Parameter.builder()
                        .name("tables")
                        .type("string[]")
                        .description("List of table patterns to monitor")
                        .required(true)
                        .defaultValue(".*")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("owners")
                        .type("string[]")
                        .description("Owners to notify")
                        .required(true)
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("testResults")
                        .type("string[]")
                        .description("Test results to monitor")
                        .defaultValue("[\"Failed\", \"Aborted\"]")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("slackChannel")
                        .type("string")
                        .description("Slack channel for notifications")
                        .defaultValue("#data-quality")
                        .build()))
            .conditionTemplate(
                """
                Entity.ofType("testCase")
                    .belongsToTable(matching(${tables}))
                    .hasOwner(${owners})
                    .and(TestResult.in(${testResults}))
            """)
            .actionsTemplate(
                """
                [
                    Actions.notify().slack("${slackChannel}"),
                    Actions.notify().email("${owners}"),
                    Actions.createTicket("JIRA", "Data Quality Issue")
                ]
            """)
            .severity(DSLAlert.AlertSeverity.HIGH)
            .tags(Arrays.asList("data-quality", "automated"))
            .build());

    // Schema Change Monitor Template
    templates.put(
        SCHEMA_CHANGE_TEMPLATE,
        DSLAlertTemplate.builder()
            .id(SCHEMA_CHANGE_TEMPLATE)
            .name("Schema Change Monitor")
            .description("Monitors schema changes in critical tables")
            .category("Schema Management")
            .parameters(
                Arrays.asList(
                    DSLAlertTemplate.Parameter.builder()
                        .name("environment")
                        .type("string")
                        .description("Environment to monitor (prod, staging)")
                        .required(true)
                        .defaultValue("prod")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("criticality")
                        .type("string")
                        .description("Table criticality level")
                        .defaultValue("critical")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("notificationChannel")
                        .type("string")
                        .description("Notification channel")
                        .defaultValue("#schema-changes")
                        .build()))
            .conditionTemplate(
                """
                Entity.ofType("table")
                    .hasTag("${environment}")
                    .hasTag("${criticality}")
                    .and(Entity.fieldChanged("columns", "dataModel"))
            """)
            .actionsTemplate(
                """
                [
                    Actions.notify().slack("${notificationChannel}"),
                    Actions.createTicket("JIRA", "Schema Change Review Required"),
                    Actions.webhook("schema-approval-system")
                ]
            """)
            .severity(DSLAlert.AlertSeverity.MEDIUM)
            .throttleDuration(Duration.ofHours(1))
            .throttleMaxAlerts(5)
            .tags(Arrays.asList("schema", "compliance"))
            .build());

    // Pipeline Failure Monitor Template
    templates.put(
        PIPELINE_FAILURE_TEMPLATE,
        DSLAlertTemplate.builder()
            .id(PIPELINE_FAILURE_TEMPLATE)
            .name("Pipeline Failure Monitor")
            .description("Monitors critical pipeline failures with escalation")
            .category("Operations")
            .parameters(
                Arrays.asList(
                    DSLAlertTemplate.Parameter.builder()
                        .name("criticality")
                        .type("string")
                        .description("Pipeline criticality level")
                        .defaultValue("critical")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("escalationMinutes")
                        .type("number")
                        .description("Minutes before escalation")
                        .defaultValue("15")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("onCallTeam")
                        .type("string")
                        .description("On-call team for escalation")
                        .required(true)
                        .build()))
            .conditionTemplate(
                """
                Entity.ofType("pipeline")
                    .hasTag("${criticality}")
                    .and(PipelineStatus.in("Failed", "Aborted"))
            """)
            .actionsTemplate(
                """
                [
                    Actions.notify().slack("#pipeline-alerts"),
                    Actions.notify().pagerDuty("${onCallTeam}"),
                    Actions.escalate().after(Duration.ofMinutes(${escalationMinutes}))
                ]
            """)
            .severity(DSLAlert.AlertSeverity.CRITICAL)
            .tags(Arrays.asList("pipeline", "critical", "escalation"))
            .build());

    // Ownership Compliance Template
    templates.put(
        OWNERSHIP_COMPLIANCE_TEMPLATE,
        DSLAlertTemplate.builder()
            .id(OWNERSHIP_COMPLIANCE_TEMPLATE)
            .name("Ownership Compliance Monitor")
            .description("Monitors assets without proper ownership")
            .category("Governance")
            .parameters(
                Arrays.asList(
                    DSLAlertTemplate.Parameter.builder()
                        .name("entityTypes")
                        .type("string[]")
                        .description("Entity types to monitor")
                        .defaultValue("[\"table\", \"dashboard\", \"pipeline\"]")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("environment")
                        .type("string")
                        .description("Environment to monitor")
                        .defaultValue("production")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("governanceTeam")
                        .type("string")
                        .description("Governance team email")
                        .required(true)
                        .build()))
            .conditionTemplate(
                """
                Entity.ofTypes(${entityTypes})
                    .hasTag("${environment}")
                    .and(Entity.hasNoOwner())
                    .and(Entity.createdMoreThanDaysAgo(7))
            """)
            .actionsTemplate(
                """
                [
                    Actions.notify().email("${governanceTeam}"),
                    Actions.createTicket("JIRA", "Ownership Assignment Required"),
                    Actions.notify().slack("#governance")
                ]
            """)
            .severity(DSLAlert.AlertSeverity.MEDIUM)
            .schedule(DSLAlert.AlertSchedule.DAILY)
            .tags(Arrays.asList("governance", "ownership", "compliance"))
            .build());

    // SLA Violation Template
    templates.put(
        SLA_VIOLATION_TEMPLATE,
        DSLAlertTemplate.builder()
            .id(SLA_VIOLATION_TEMPLATE)
            .name("SLA Violation Monitor")
            .description("Monitors SLA violations for critical processes")
            .category("SLA Management")
            .parameters(
                Arrays.asList(
                    DSLAlertTemplate.Parameter.builder()
                        .name("slaHours")
                        .type("number")
                        .description("SLA threshold in hours")
                        .defaultValue("24")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("processTypes")
                        .type("string[]")
                        .description("Process types to monitor")
                        .defaultValue("[\"ingestionPipeline\", \"pipeline\"]")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("slaTeam")
                        .type("string")
                        .description("SLA monitoring team")
                        .required(true)
                        .build()))
            .conditionTemplate(
                """
                Entity.ofTypes(${processTypes})
                    .hasTag("sla-monitored")
                    .and(Entity.lastRunMoreThanHoursAgo(${slaHours}))
                    .and(Entity.status("Running", "Queued"))
            """)
            .actionsTemplate(
                """
                [
                    Actions.notify().email("${slaTeam}"),
                    Actions.notify().slack("#sla-violations"),
                    Actions.escalate().after(Duration.ofHours(1))
                ]
            """)
            .severity(DSLAlert.AlertSeverity.HIGH)
            .tags(Arrays.asList("sla", "performance", "escalation"))
            .build());

    // Anomaly Detection Template
    templates.put(
        ANOMALY_DETECTION_TEMPLATE,
        DSLAlertTemplate.builder()
            .id(ANOMALY_DETECTION_TEMPLATE)
            .name("Anomaly Detection Monitor")
            .description("Detects anomalies in data patterns and usage")
            .category("Monitoring")
            .parameters(
                Arrays.asList(
                    DSLAlertTemplate.Parameter.builder()
                        .name("anomalyTypes")
                        .type("string[]")
                        .description("Types of anomalies to detect")
                        .defaultValue("[\"volume\", \"freshness\", \"quality\"]")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("sensitivity")
                        .type("string")
                        .description("Anomaly detection sensitivity")
                        .defaultValue("medium")
                        .build(),
                    DSLAlertTemplate.Parameter.builder()
                        .name("monitoringTeam")
                        .type("string")
                        .description("Monitoring team contact")
                        .required(true)
                        .build()))
            .conditionTemplate(
                """
                Entity.ofType("table")
                    .hasTag("monitored")
                    .and(Anomaly.detected(${anomalyTypes}, "${sensitivity}"))
            """)
            .actionsTemplate(
                """
                [
                    Actions.notify().slack("#anomaly-alerts"),
                    Actions.notify().email("${monitoringTeam}"),
                    Actions.runAnalysis("anomaly-investigation")
                ]
            """)
            .severity(DSLAlert.AlertSeverity.MEDIUM)
            .tags(Arrays.asList("anomaly", "monitoring", "ml"))
            .build());
  }

  public static DSLAlertTemplate getTemplate(String templateId) {
    return templates.get(templateId);
  }

  public static List<DSLAlertTemplate> getAllTemplates() {
    return List.copyOf(templates.values());
  }

  public static List<DSLAlertTemplate> getTemplatesByCategory(String category) {
    return templates.values().stream()
        .filter(template -> category.equals(template.getCategory()))
        .toList();
  }

  public static DSLAlert createFromTemplate(String templateId, Map<String, Object> parameters) {
    DSLAlertTemplate template = templates.get(templateId);
    if (template == null) {
      throw new IllegalArgumentException("Template not found: " + templateId);
    }

    return template.instantiate(parameters);
  }

  public static List<String> getAvailableTemplates() {
    return List.copyOf(templates.keySet());
  }
}
