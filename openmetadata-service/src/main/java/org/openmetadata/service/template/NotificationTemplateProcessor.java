package org.openmetadata.service.template;

import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;

/**
 * Interface for abstracting template engine operations.
 * This abstraction ensures that template engine implementations
 * (like Handlebars) are completely isolated from core business logic.
 */
public interface NotificationTemplateProcessor {

  /**
   * Validates a notification template.
   *
   * @param request The validation request containing template body and subject
   * @return Validation response with isValid flag and error message
   */
  NotificationTemplateValidationResponse validate(NotificationTemplateValidationRequest request);
}
