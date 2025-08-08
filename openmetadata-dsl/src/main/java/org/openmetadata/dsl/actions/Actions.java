package org.openmetadata.dsl.actions;

import java.time.Duration;
import java.util.Map;
import org.openmetadata.dsl.core.DSLAction;

public class Actions {

  public static NotificationAction notification() {
    return new NotificationAction();
  }

  public static WebhookAction webhook(String url) {
    return new WebhookAction(url);
  }

  public static TicketAction createTicket(String system) {
    return new TicketAction(system);
  }

  public static TicketAction createTicket(String system, String description) {
    return new TicketAction(system, description);
  }

  public static EscalationAction escalate() {
    return new EscalationAction();
  }

  public static ConditionalAction conditional() {
    return new ConditionalAction();
  }

  public static MetadataAction setMetadata() {
    return new MetadataAction();
  }

  public static AnalysisAction runAnalysis(String analysisType) {
    return new AnalysisAction(analysisType);
  }

  public static PlaybookAction runPlaybook(String playbookId) {
    return new PlaybookAction(playbookId);
  }

  public static ValidationAction runValidation(String validationType) {
    return new ValidationAction(validationType);
  }

  // Notification Action Builder
  public static class NotificationAction {
    private String channel;
    private String destination;
    private String template = "default";
    private String subject;
    private String urgency = "medium";

    public NotificationAction slack(String channel) {
      this.channel = "slack";
      this.destination = channel;
      return this;
    }

    public NotificationAction email(String email) {
      this.channel = "email";
      this.destination = email;
      return this;
    }

    public NotificationAction pagerDuty(String service) {
      this.channel = "pagerduty";
      this.destination = service;
      return this;
    }

    public NotificationAction withTemplate(String template) {
      this.template = template;
      return this;
    }

    public NotificationAction withSubject(String subject) {
      this.subject = subject;
      return this;
    }

    public NotificationAction withUrgency(String urgency) {
      this.urgency = urgency;
      return this;
    }

    public NotificationAction withMention(String mention) {
      // Store mention for Slack notifications
      return this;
    }

    public NotificationAction withSeverity(String severity) {
      this.urgency = severity;
      return this;
    }

    public NotificationAction withDetails(String details) {
      // Store details for notification
      return this;
    }

    public DSLAction build() {
      return DSLAction.builder()
          .type("notify")
          .expression(String.format("Actions.notify().%s(\"%s\")", channel, destination))
          .config(
              Map.of(
                  "channel", channel,
                  "destination", destination,
                  "template", template,
                  "subject", subject != null ? subject : "",
                  "urgency", urgency))
          .build();
    }
  }

  // Webhook Action Builder
  public static class WebhookAction {
    private final String url;
    private String method = "POST";
    private Map<String, Object> payload;
    private Duration timeout = Duration.ofSeconds(30);

    public WebhookAction(String url) {
      this.url = url;
    }

    public WebhookAction withMethod(String method) {
      this.method = method;
      return this;
    }

    public WebhookAction withPayload(Map<String, Object> payload) {
      this.payload = payload;
      return this;
    }

    public WebhookAction withTimeout(Duration timeout) {
      this.timeout = timeout;
      return this;
    }

    public DSLAction build() {
      return DSLAction.builder()
          .type("webhook")
          .expression(String.format("Actions.webhook(\"%s\")", url))
          .config(
              Map.of(
                  "url",
                  url,
                  "method",
                  method,
                  "timeout",
                  timeout.toSeconds(),
                  "payload",
                  payload != null ? payload : Map.of()))
          .build();
    }
  }

  // Ticket Action Builder
  public static class TicketAction {
    private final String system;
    private String project;
    private String type = "Task";
    private String priority = "Medium";
    private String assignee;
    private String description;

    public TicketAction(String system) {
      this.system = system;
    }

    public TicketAction(String system, String description) {
      this.system = system;
      this.description = description;
    }

    public TicketAction inProject(String project) {
      this.project = project;
      return this;
    }

    public TicketAction withType(String type) {
      this.type = type;
      return this;
    }

    public TicketAction withPriority(String priority) {
      this.priority = priority;
      return this;
    }

    public TicketAction assignTo(String assignee) {
      this.assignee = assignee;
      return this;
    }

    public TicketAction withDescription(String description) {
      this.description = description;
      return this;
    }

    public TicketAction withLabels(String... labels) {
      // Store labels for ticket creation
      return this;
    }

    public DSLAction build() {
      return DSLAction.builder()
          .type("ticket")
          .expression(String.format("Actions.createTicket(\"%s\")", system))
          .config(
              Map.of(
                  "system",
                  system,
                  "project",
                  project != null ? project : "",
                  "type",
                  type,
                  "priority",
                  priority,
                  "assignee",
                  assignee != null ? assignee : "",
                  "description",
                  description != null ? description : ""))
          .build();
    }
  }

  // Escalation Action Builder
  public static class EscalationAction {
    private Duration delay = Duration.ofMinutes(15);
    private String escalateTo;
    private String channel;

    public EscalationAction after(Duration delay) {
      this.delay = delay;
      return this;
    }

    public EscalationAction to(String escalateTo) {
      this.escalateTo = escalateTo;
      return this;
    }

    public EscalationAction viaSlack(String channel) {
      this.channel = channel;
      return this;
    }

    public DSLAction build() {
      return DSLAction.builder()
          .type("escalate")
          .expression(
              String.format("Actions.escalate().after(Duration.ofMinutes(%d))", delay.toMinutes()))
          .config(
              Map.of(
                  "delay", delay.toSeconds(),
                  "escalateTo", escalateTo != null ? escalateTo : "",
                  "channel", channel != null ? channel : ""))
          .build();
    }
  }

  // Helper classes for other action types
  public static class ConditionalAction {
    public DSLAction build() {
      return DSLAction.builder().type("conditional").expression("Actions.conditional()").build();
    }
  }

  public static class MetadataAction {
    public MetadataAction tag(String tag) {
      return this;
    }

    public MetadataAction description(String desc) {
      return this;
    }

    public DSLAction build() {
      return DSLAction.builder().type("metadata").expression("Actions.setMetadata()").build();
    }
  }

  public static class AnalysisAction {
    private final String analysisType;
    private Map<String, Object> parameters;

    public AnalysisAction(String analysisType) {
      this.analysisType = analysisType;
    }

    public AnalysisAction withParameters(Map<String, Object> parameters) {
      this.parameters = parameters;
      return this;
    }

    public DSLAction build() {
      return DSLAction.builder()
          .type("analysis")
          .expression(String.format("Actions.runAnalysis(\"%s\")", analysisType))
          .config(
              Map.of(
                  "analysisType",
                  analysisType,
                  "parameters",
                  parameters != null ? parameters : Map.of()))
          .build();
    }
  }

  public static class PlaybookAction {
    private final String playbookId;
    private Map<String, Object> parameters;

    public PlaybookAction(String playbookId) {
      this.playbookId = playbookId;
    }

    public PlaybookAction withParameters(Map<String, Object> parameters) {
      this.parameters = parameters;
      return this;
    }

    public DSLAction build() {
      return DSLAction.builder()
          .type("playbook")
          .expression(String.format("Actions.runPlaybook(\"%s\")", playbookId))
          .config(
              Map.of(
                  "playbookId",
                  playbookId,
                  "parameters",
                  parameters != null ? parameters : Map.of()))
          .build();
    }
  }

  public static class ValidationAction {
    private final String validationType;
    private String[] environments;

    public ValidationAction(String validationType) {
      this.validationType = validationType;
    }

    public ValidationAction withEnvironments(String... environments) {
      this.environments = environments;
      return this;
    }

    public DSLAction build() {
      return DSLAction.builder()
          .type("validation")
          .expression(String.format("Actions.runValidation(\"%s\")", validationType))
          .config(
              Map.of(
                  "validationType",
                  validationType,
                  "environments",
                  environments != null ? environments : new String[0]))
          .build();
    }
  }
}
