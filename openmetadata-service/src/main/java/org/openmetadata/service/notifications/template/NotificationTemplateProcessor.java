/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.notifications.template;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;

/**
 * Interface for abstracting template engine operations.
 * This abstraction ensures that template engine implementations
 * (like Handlebars) are completely isolated from core business logic.
 */
public interface NotificationTemplateProcessor {

  /**
   * Process a template string with the given context.
   *
   * @param templateString The template string to process (body or subject)
   * @param context The context map for template processing
   * @return The processed template string
   */
  String process(String templateString, Map<String, Object> context);

  /**
   * Validates a notification template.
   *
   * @param request The validation request containing template body and subject
   * @return Validation response with field-specific results
   */
  NotificationTemplateValidationResponse validate(NotificationTemplateValidationRequest request);

  /**
   * Get metadata for all available template helpers.
   *
   * @return List of helper metadata with names, descriptions, and usage examples
   */
  List<HandlebarsHelperMetadata> getHelperMetadata();
}
