package org.openmetadata.service.notifications.template.handlebars;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.HandlebarsException;
import com.github.jknack.handlebars.Template;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.service.notifications.template.NotificationTemplateProcessor;

@Slf4j
public class HandlebarsNotificationTemplateProcessor implements NotificationTemplateProcessor {

  private final Handlebars handlebars;

  public HandlebarsNotificationTemplateProcessor() {
    this.handlebars = HandlebarsProvider.getInstance();
  }

  @Override
  public String process(String templateString, Map<String, Object> context) {
    try {
      Template template = handlebars.compileInline(templateString);
      return template.apply(context);
    } catch (Exception e) {
      throw new RuntimeException("Failed to process template: " + e.getMessage(), e);
    }
  }

  @Override
  public NotificationTemplateValidationResponse validate(
      NotificationTemplateValidationRequest request) {
    String subjectError = null;
    String bodyError = null;

    // Validate template subject
    if (request.getTemplateSubject() != null && !request.getTemplateSubject().isEmpty()) {
      subjectError = validateTemplateString(request.getTemplateSubject());
    }

    // Validate template body
    if (request.getTemplateBody() != null && !request.getTemplateBody().isEmpty()) {
      bodyError = validateTemplateString(request.getTemplateBody());
    }

    boolean isValid = (subjectError == null) && (bodyError == null);

    return new NotificationTemplateValidationResponse()
        .withIsValid(isValid)
        .withSubjectError(subjectError)
        .withBodyError(bodyError);
  }

  private String validateTemplateString(String templateString) {
    try {
      handlebars.compileInline(templateString);
      return null;
    } catch (HandlebarsException e) {
      return formatHandlebarsError(e);
    } catch (Exception e) {
      return String.format("Template validation failed: %s", e.getMessage());
    }
  }

  private String formatHandlebarsError(HandlebarsException e) {
    String message = e.getMessage();

    if (e.getCause() != null && e.getCause().getMessage() != null) {
      String causeMessage = e.getCause().getMessage();
      if (causeMessage.contains("[") && causeMessage.contains("]")) {
        return String.format("Template syntax error: %s", message);
      }
    }

    return String.format("Template validation failed: %s", message);
  }

  @Override
  public List<HandlebarsHelperMetadata> getHelperMetadata() {
    return HandlebarsProvider.getAllHelperInstances().stream()
        .map(HandlebarsHelper::getMetadata)
        .toList();
  }
}
