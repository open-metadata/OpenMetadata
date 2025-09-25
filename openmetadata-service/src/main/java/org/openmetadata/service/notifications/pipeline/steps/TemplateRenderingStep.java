/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.notifications.pipeline.steps;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.notifications.pipeline.NotificationPipelineContext;
import org.openmetadata.service.notifications.pipeline.NotificationPipelineStep;
import org.openmetadata.service.notifications.template.NotificationTemplateProcessor;
import org.openmetadata.service.util.email.EmailUtil;

/**
 * Step 1: Template rendering step
 */
public class TemplateRenderingStep implements NotificationPipelineStep {
  private final NotificationTemplateProcessor templateProcessor;

  public TemplateRenderingStep(NotificationTemplateProcessor templateProcessor) {
    this.templateProcessor = templateProcessor;
  }

  @Override
  public NotificationPipelineContext process(NotificationPipelineContext context) {
    // Render template body
    String renderedBody =
        templateProcessor.process(
            context.getTemplate().getTemplateBody(), buildEventContext(context.getEvent()));
    context.setRenderedBody(renderedBody);

    // Render subject if present
    if (context.getTemplate().getTemplateSubject() != null
        && !context.getTemplate().getTemplateSubject().isEmpty()) {
      String renderedSubject =
          templateProcessor.process(
              context.getTemplate().getTemplateSubject(), buildEventContext(context.getEvent()));
      context.setRenderedSubject(renderedSubject);
    }

    return context;
  }

  private Map<String, Object> buildEventContext(ChangeEvent event) {
    Map<String, Object> context = new HashMap<>();
    context.put("event", event);
    context.put("entity", event.getEntity());
    context.put("baseUrl", EmailUtil.getOMBaseURL());
    return context;
  }
}
