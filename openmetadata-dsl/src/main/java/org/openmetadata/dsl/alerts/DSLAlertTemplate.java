package org.openmetadata.dsl.alerts;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.Builder;
import lombok.Data;
import lombok.extern.jackson.Jacksonized;
import org.openmetadata.dsl.core.DSLAction;
import org.openmetadata.dsl.core.DSLCondition;
import org.openmetadata.dsl.core.DSLParser;

@Data
@Builder
@Jacksonized
public class DSLAlertTemplate {

  @JsonProperty("id")
  private String id;

  @JsonProperty("name")
  private String name;

  @JsonProperty("description")
  private String description;

  @JsonProperty("category")
  private String category;

  @JsonProperty("version")
  @Builder.Default
  private String version = "1.0.0";

  @JsonProperty("parameters")
  private List<Parameter> parameters;

  @JsonProperty("conditionTemplate")
  private String conditionTemplate;

  @JsonProperty("actionsTemplate")
  private String actionsTemplate;

  @JsonProperty("severity")
  @Builder.Default
  private DSLAlert.AlertSeverity severity = DSLAlert.AlertSeverity.MEDIUM;

  @JsonProperty("schedule")
  @Builder.Default
  private DSLAlert.AlertSchedule schedule = DSLAlert.AlertSchedule.REAL_TIME;

  @JsonProperty("throttleDuration")
  private Duration throttleDuration;

  @JsonProperty("throttleMaxAlerts")
  private Integer throttleMaxAlerts;

  @JsonProperty("tags")
  private List<String> tags;

  @JsonProperty("documentation")
  private String documentation;

  @JsonProperty("examples")
  private List<String> examples;

  @Data
  @Builder
  @Jacksonized
  public static class Parameter {
    @JsonProperty("name")
    private String name;

    @JsonProperty("type")
    private String type;

    @JsonProperty("description")
    private String description;

    @JsonProperty("required")
    private boolean required;

    @JsonProperty("defaultValue")
    private String defaultValue;

    @JsonProperty("validation")
    private String validation;

    @JsonProperty("options")
    private List<String> options;
  }

  public DSLAlert instantiate(Map<String, Object> parameters) {
    // Validate required parameters
    validateParameters(parameters);

    // Substitute parameters in templates
    String processedCondition = substituteParameters(conditionTemplate, parameters);
    String processedActions = substituteParameters(actionsTemplate, parameters);

    try {
      // Parse DSL condition
      DSLCondition condition = DSLParser.parseCondition(processedCondition);

      // Parse DSL actions
      List<DSLAction> actions = DSLParser.parseActions(processedActions);

      // Build the alert
      DSLAlertBuilder builder =
          DSLAlertBuilder.create()
              .name(substituteParameters(name, parameters))
              .description(substituteParameters(description, parameters))
              .when(condition)
              .severity(severity)
              .schedule(schedule);

      // Add actions
      for (DSLAction action : actions) {
        builder.then(action);
      }

      // Add throttling if specified
      if (throttleDuration != null && throttleMaxAlerts != null) {
        builder.throttle(throttleDuration, throttleMaxAlerts);
      }

      // Add tags
      if (tags != null) {
        builder.tags(tags.toArray(new String[0]));
      }

      // Add template metadata
      builder
          .metadata("templateId", id)
          .metadata("templateVersion", version)
          .metadata("instantiationParameters", parameters);

      return builder.build();

    } catch (Exception e) {
      throw new RuntimeException("Failed to instantiate template: " + e.getMessage(), e);
    }
  }

  private void validateParameters(Map<String, Object> providedParams) {
    for (Parameter param : parameters) {
      String name = param.getName();
      Object value = providedParams.get(name);

      if (param.isRequired() && value == null) {
        throw new IllegalArgumentException("Required parameter missing: " + name);
      }

      if (value == null && param.getDefaultValue() != null) {
        providedParams.put(name, param.getDefaultValue());
      }

      // Validate parameter type and constraints
      if (value != null && param.getValidation() != null) {
        validateParameterValue(name, value.toString(), param.getValidation());
      }
    }
  }

  private void validateParameterValue(String paramName, String value, String validation) {
    try {
      Pattern pattern = Pattern.compile(validation);
      if (!pattern.matcher(value).matches()) {
        throw new IllegalArgumentException(
            String.format(
                "Parameter '%s' value '%s' does not match validation pattern '%s'",
                paramName, value, validation));
      }
    } catch (Exception e) {
      throw new IllegalArgumentException(
          String.format(
              "Invalid validation pattern for parameter '%s': %s", paramName, e.getMessage()));
    }
  }

  private String substituteParameters(String template, Map<String, Object> parameters) {
    if (template == null) {
      return null;
    }

    String result = template;
    Pattern pattern = Pattern.compile("\\$\\{([^}]+)\\}");
    Matcher matcher = pattern.matcher(template);

    while (matcher.find()) {
      String paramName = matcher.group(1);
      Object paramValue = parameters.get(paramName);

      if (paramValue != null) {
        String replacement;
        if (paramValue instanceof String) {
          replacement = "\"" + paramValue + "\"";
        } else if (paramValue instanceof List) {
          @SuppressWarnings("unchecked")
          List<String> list = (List<String>) paramValue;
          replacement =
              "[" + String.join(", ", list.stream().map(s -> "\"" + s + "\"").toList()) + "]";
        } else {
          replacement = paramValue.toString();
        }

        result = result.replace("${" + paramName + "}", replacement);
      }
    }

    return result;
  }

  public List<String> getRequiredParameters() {
    return parameters.stream().filter(Parameter::isRequired).map(Parameter::getName).toList();
  }

  public List<String> getOptionalParameters() {
    return parameters.stream()
        .filter(param -> !param.isRequired())
        .map(Parameter::getName)
        .toList();
  }

  public Parameter getParameter(String name) {
    return parameters.stream()
        .filter(param -> name.equals(param.getName()))
        .findFirst()
        .orElse(null);
  }
}
