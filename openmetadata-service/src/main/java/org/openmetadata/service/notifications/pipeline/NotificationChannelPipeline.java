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

package org.openmetadata.service.notifications.pipeline;

import java.util.List;
// TODO: Uncomment when channel transformers are implemented
// import org.openmetadata.service.notifications.channels.EmailChannelTransformer;
// import org.openmetadata.service.notifications.channels.GChatChannelTransformer;
// import org.openmetadata.service.notifications.channels.SlackChannelTransformer;
// import org.openmetadata.service.notifications.channels.TeamsChannelTransformer;
import org.openmetadata.service.notifications.decorator.EmailNotificationMessageDecorator;
import org.openmetadata.service.notifications.pipeline.steps.DecorationStep;
import org.openmetadata.service.notifications.pipeline.steps.TemplateRenderingStep;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsNotificationTemplateProcessor;

/**
 * Enum defining pipeline configurations for each notification channel.
 * Each channel has its own specific pipeline with appropriate steps.
 */
public enum NotificationChannelPipeline {
  EMAIL {
    @Override
    public List<NotificationPipelineStep> buildPipeline() {
      return List.of(
          new TemplateRenderingStep(new HandlebarsNotificationTemplateProcessor()),
          new DecorationStep(new EmailNotificationMessageDecorator())
          // TODO: Uncomment when EmailChannelTransformer is implemented
          // new TransformationStep(new EmailChannelTransformer())
          );
    }
  },

  SLACK {
    @Override
    public List<NotificationPipelineStep> buildPipeline() {
      return List.of(
          new TemplateRenderingStep(new HandlebarsNotificationTemplateProcessor())
          // TODO: Uncomment when SlackChannelTransformer is implemented
          // new TransformationStep(new SlackChannelTransformer())
          );
    }
  },

  MS_TEAMS {
    @Override
    public List<NotificationPipelineStep> buildPipeline() {
      return List.of(
          new TemplateRenderingStep(new HandlebarsNotificationTemplateProcessor())
          // TODO: Uncomment when TeamsChannelTransformer is implemented
          // new TransformationStep(new TeamsChannelTransformer())
          );
    }
  },

  GCHAT {
    @Override
    public List<NotificationPipelineStep> buildPipeline() {
      return List.of(
          new TemplateRenderingStep(new HandlebarsNotificationTemplateProcessor())
          // TODO: Uncomment when GChatChannelTransformer is implemented
          // new TransformationStep(new GChatChannelTransformer())
          );
    }
  };

  /**
   * Build the pipeline specific to this channel.
   * @return List of pipeline steps in execution order
   */
  public abstract List<NotificationPipelineStep> buildPipeline();
}
