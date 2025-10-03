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

import org.openmetadata.service.notifications.channels.NotificationChannelTransformer;
import org.openmetadata.service.notifications.messages.NotificationMessage;
import org.openmetadata.service.notifications.pipeline.NotificationPipelineContext;
import org.openmetadata.service.notifications.pipeline.NotificationPipelineStep;

/**
 * Step 3: Transformation step to channel-specific format
 */
public class TransformationStep implements NotificationPipelineStep {
  private final NotificationChannelTransformer<? extends NotificationMessage> transformer;

  public TransformationStep(
      NotificationChannelTransformer<? extends NotificationMessage> transformer) {
    this.transformer = transformer;
  }

  @Override
  public NotificationPipelineContext process(NotificationPipelineContext context) {
    NotificationMessage message =
        transformer.transform(
            context.getRenderedBody(), context.getRenderedSubject(), context.getEvent());
    context.setMessage(message);
    return context;
  }
}
